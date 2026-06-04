// DriveStorageProvider — StorageProvider contract の本番実装
// 設計: docs/Phase2/Phase2_実装設計_v0.1_2026-05-25.md §3
//       docs/Phase2/Phase2_Drive_ファイルレイアウト設計_v0.1_2026-05-19.md(F1-F9)
//
// ▼ 本ファイルは「段階1(土台部分)」のみ実装(指示文_DriveStorageProvider実装GO_段階1_2026-05-31)。
//   Drive に繋がって設定を読み書きできる最小の形を作る。
//
//   段階1で実装:
//     - initialize       : auth stage / drive.file スコープ確認 → deps 保存
//     - ensureLayout     : MIYU_App_Data/ のフォルダ階層を冪等作成(★フォルダのみ。
//                          中身ファイルの seeding は段階2 = bundled アセット対応とセット)
//     - dispose          : 最小(内部状態クリア)
//     - loadSettings     : Drive から settings.json を読む(★キャッシュ無し)
//     - saveSettings     : settings.json を Drive へ保存(★LWW 競合検知無し、初回は遅延作成)
//     - 内部: driveApi / findChild / ensureFolder / resolve 系
//
//   ▼ 段階2a(本コミット)で追加:
//     - IndexedDbCache(キャッシュ層、src/implementations/internal/)を initialize で生成・dispose で close
//     - loadSettings をキャッシュ経由に改修(forceFresh / allowStaleCache 経路、TTL は cache-config)
//     - saveSettings に If-Match / 412 / handleConflict の「骨格」を配線(本実装は段階2e)
//     - ensureLayout に archive/ と conflicts/ フォルダ作成を追加
//     - etagMap フィールド追加(段階2e の LWW で消費)
//
//   ▼▼ 段階2(以降の別指示文)に回す:
//     - PendingQueue(オフライン保存待ち、段階2e) /
//       ConflictResolver(LWW 競合解決、If-Match/412/handleConflict 本実装、段階2e) … internal/
//     - bundled アセット fallback(loadCharacterMd 等の 404 fallback、source:'bundled'、段階2c)
//     - watch 系(watchSettings / watchSyncState / onConflict)、flushPending、getSyncState(段階2f)
//     - キャラ/プロファイル/マニュアル/履歴の各 load/save(段階2b/2c/2d、下記スケルトン据え置き)
//   依存先(完成済): IndexedDbSecretStore / GoogleAuthProvider

import type {
  AppendResult,
  ConflictEvent,
  EnsureLayoutResult,
  FlushResult,
  InitResult,
  LoadOptions,
  LoadResult,
  ResourceMeta,
  SaveResult,
  SyncState,
  Unsubscribe,
  WatchCallback,
} from '@/interfaces/types'
import type {
  CharacterDiffResult,
  CharacterIndex,
  ErrorEntry,
  IsoDate,
  Profile,
  Settings,
} from '@/interfaces/domain'
import type { StorageDeps, StorageProvider } from '@/interfaces/StorageProvider'
import { IndexedDbCache } from './internal/IndexedDbCache'
import { resolveCacheTtlMs } from './internal/cache-config'
import { PendingQueueStore } from './internal/PendingQueueStore'
import { ConflictResolver } from './internal/ConflictResolver'
import {
  getBundledCharacterMd,
  getBundledCoachingMd,
  listBundledCharacterIds,
} from '@/assets/characters/registry'
// index.ts wiring(エルトン GO 2026-06-04): 同梱 index を seedDefaults / loadCharacterIndex fallback で消費。
import { BUNDLED_CHARACTER_INDEX } from '@/assets/characters'

// Drive API のエラーを種別つきで内部に運ぶ(呼出側で Result reason に変換)
// 'conflict' は段階2a で追加(412 Precondition Failed = If-Match 不一致、段階2e で本処理)
type DriveErrorKind = 'auth' | 'rate_limit' | 'network' | 'not_found' | 'conflict' | 'http'

class DriveHttpError extends Error {
  readonly kind: DriveErrorKind
  readonly status?: number
  constructor(kind: DriveErrorKind, status?: number) {
    super(`DriveHttpError:${kind}${status != null ? `:${status}` : ''}`)
    this.kind = kind
    this.status = status
  }
}

export class DriveStorageProvider implements StorageProvider {
  private static readonly DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files'
  private static readonly DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
  private static readonly FOLDER_MIME = 'application/vnd.google-apps.folder'
  // §3.4: appProperties の役割識別キー
  private static readonly ROLE_PROP = 'invokeaide.role'
  // multipart 作成時の境界(settings JSON には出現しない固定値)
  private static readonly MULTIPART_BOUNDARY = 'invokeaide_boundary_8f3a1c'

  // 論理パス(F1-F9 レイアウト準拠、内部キャッシュキーにも使う)
  private static readonly P_ROOT = 'MIYU_App_Data'
  private static readonly P_CONFIG = 'MIYU_App_Data/config'
  private static readonly P_CHARACTERS = 'MIYU_App_Data/config/characters'
  private static readonly P_ARCHIVE = 'MIYU_App_Data/config/archive'
  private static readonly P_CONFLICTS = 'MIYU_App_Data/config/conflicts'
  private static readonly P_LOGS = 'MIYU_App_Data/logs'
  private static readonly P_CONVERSATIONS = 'MIYU_App_Data/logs/conversations'
  private static readonly P_SETTINGS = 'MIYU_App_Data/config/settings.json'
  private static readonly P_INDEX = 'MIYU_App_Data/config/index.json'
  private static readonly P_PROFILE = 'MIYU_App_Data/config/profile.md'
  private static readonly P_MANUAL = 'MIYU_App_Data/config/manual.md'
  private static readonly P_ERRORS = 'MIYU_App_Data/logs/errors.md'

  private deps: StorageDeps | null = null
  // 論理パス → driveFileId の解決メモ(段階1は in-memory のみ。永続キャッシュは段階2)
  private fileIdMap: Map<string, string> = new Map()
  // 論理パス → 最後に観測した etag(段階2e の LWW If-Match 競合検知で消費)
  private etagMap: Map<string, string> = new Map()
  // ローカルキャッシュ層(段階2a)。initialize で生成、利用不可環境では null(キャッシュ無し劣化運用)
  private cache: IndexedDbCache | null = null
  // オフライン書込みキュー(段階2e)。フィールド初期化子で保持(コンストラクタ不要)。
  private readonly pendingQueue = new PendingQueueStore()
  // version比較によるread-before-write楽観ロックの判定器(段階2e)。
  private readonly conflictResolver = new ConflictResolver()
  // キュー件数の in-memory ミラー。同期 getSyncState 用(getAll は IndexedDB=非同期で待てないため)。
  private pendingCount = 0
  // 最後にフラッシュがクリーンに捌けた時刻(RFC3339)。getSyncState.lastSyncedAt 用。
  private lastSyncedAt: string | null = null

  // -- watch / 競合通知(段階2f) --------------------------------
  // contract: watchSettings / watchSyncState / onConflict。GoogleAuthProvider.onStageChange と同型で
  //   listeners 配列 + unsubscribe クロージャ。型は contract に厳密一致させる。
  private settingsListeners: WatchCallback<Settings>[] = []
  private syncStateListeners: WatchCallback<SyncState>[] = []
  private conflictListeners: Array<(event: ConflictEvent) => void> = []
  // 競合(handleConflict が conflicts/ へ退避した未レビュー件数)。getSyncState.conflictsAwaitingReview。
  private conflictCount = 0
  // online 復帰時の自動 flush ハンドラ。dispose で removeEventListener するため参照を保持。
  private onlineHandler: (() => void) | null = null

  // -- ライフサイクル ---------------------------------------

  constructor() {
    // online 復帰でオフライン保留キューを自動フラッシュ(段階2f)。
    // SSR / 非 DOM 環境(window 不在)では登録しない劣化運用に倒す。
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this.onlineHandler = () => {
        // initialize 前(deps 未確立)の発火では未認証 flush を避けて何もしない。
        if (this.deps) {
          void this.flushPending()
        }
      }
      window.addEventListener('online', this.onlineHandler)
    }
  }

  async initialize(deps: StorageDeps): Promise<InitResult> {
    this.deps = deps

    // 1. auth stage 確認(unauth なら未認証)
    if (deps.auth.currentStage() === 'unauth') {
      return { ok: false, reason: 'auth_missing' }
    }

    // 2. Drive(drive.file)スコープ拒否の検出(C3 / Q-U-j-6: getGrantedScopes)
    try {
      const scopes = await deps.auth.getGrantedScopes()
      const hasDriveFile = scopes?.some((s) => s.includes('drive.file')) ?? false
      if (!hasDriveFile) {
        return { ok: false, reason: 'drive_denied' }
      }
    } catch (err) {
      deps.logger?.error?.('DriveStorageProvider.initialize: getGrantedScopes failed', {
        err: this.serializeError(err),
      })
      return { ok: false, reason: 'unknown' }
    }

    // 3. キャッシュ層を初期化(段階2a)。
    //    IndexedDB 利用不可(Private Browsing 等)でも致命とせず、Drive 直アクセスで継続する
    //    (キャッシュ無し劣化運用)。InitResult の reason は auth/drive 系のみのため ok:true を返す。
    //    PendingQueue 復元は段階2e。
    const cache = new IndexedDbCache({
      clock: deps.clock,
      logger: deps.logger,
      ttlResolver: resolveCacheTtlMs,
    })
    try {
      await cache.initialize()
      this.cache = cache
    } catch (err) {
      deps.logger?.warn('DriveStorageProvider.initialize: cache unavailable, running without cache', {
        err: this.serializeError(err),
      })
      this.cache = null
    }

    // 4. PendingQueue の件数を同期 getSyncState 用に復元(段階2e)。
    //    getAll は IndexedDB=非同期のため initialize 時に一度だけ読み、pendingCount にミラーする。
    //    IndexedDB 利用不可環境では 0 のまま(キュー無し劣化運用)。
    try {
      const pending = await this.pendingQueue.getAll()
      this.pendingCount = pending.length
    } catch (err) {
      deps.logger?.warn('DriveStorageProvider.initialize: pending queue restore skipped', {
        err: this.serializeError(err),
      })
      this.pendingCount = 0
    }

    return { ok: true }
  }

  async ensureLayout(): Promise<EnsureLayoutResult> {
    const deps = this.deps
    if (!deps) {
      return { ok: false, reason: 'unknown' }
    }

    const created: string[] = []
    const existed: string[] = []
    const track = (r: { created: boolean }, logicalPath: string): void => {
      ;(r.created ? created : existed).push(logicalPath)
    }

    try {
      // ★段階1: フォルダ階層のみを冪等作成(中身ファイルの seeding は段階2 = bundled 対応とセット)
      const root = await this.ensureFolder(DriveStorageProvider.P_ROOT, 'MIYU_App_Data', 'root', 'F0')
      track(root, DriveStorageProvider.P_ROOT)

      const config = await this.ensureFolder(DriveStorageProvider.P_CONFIG, 'config', root.id, 'config')
      track(config, DriveStorageProvider.P_CONFIG)

      const characters = await this.ensureFolder(
        DriveStorageProvider.P_CHARACTERS,
        'characters',
        config.id,
        'characters',
      )
      track(characters, DriveStorageProvider.P_CHARACTERS)

      // archive/ と conflicts/ は config 直下(レイアウト §3.4)。
      // conflicts/ は段階2e の LWW 競合退避先になるため、土台のうちに作っておく。
      const archive = await this.ensureFolder(
        DriveStorageProvider.P_ARCHIVE,
        'archive',
        config.id,
        'archive',
      )
      track(archive, DriveStorageProvider.P_ARCHIVE)

      const conflicts = await this.ensureFolder(
        DriveStorageProvider.P_CONFLICTS,
        'conflicts',
        config.id,
        'conflicts',
      )
      track(conflicts, DriveStorageProvider.P_CONFLICTS)

      const logs = await this.ensureFolder(DriveStorageProvider.P_LOGS, 'logs', root.id, 'logs')
      track(logs, DriveStorageProvider.P_LOGS)

      const conversations = await this.ensureFolder(
        DriveStorageProvider.P_CONVERSATIONS,
        'conversations',
        logs.id,
        'conversations',
      )
      track(conversations, DriveStorageProvider.P_CONVERSATIONS)

      // 段階2: README.md / index.json / settings.json / profile.md / manual.md /
      //        characters/*.md / errors.md のデフォルト内容生成(bundled アセット対応とセット)。
      //        ※ README 配置は Q-U-c-1(たかしさん判断保留)のため段階1では作らない。
      return { ok: true, created, existed }
    } catch (err) {
      return { ok: false, reason: this.toEnsureReason(err) }
    }
  }

  /**
   * 同梱デフォルトを Drive へ初回 seeding する(contract 外のクラス固有メソッド、index.ts wiring)。
   * 設計: docs/Phase2/Phase2_Drive_ファイルレイアウト設計_v0.1 §6 初回作成フロー(冪等)。
   *
   * ▼ スコープ(エルトン GO 2026-06-04、Uさん 推奨どおり):
   *   B-2 最小 seeding — config/index.json + config/characters/<id>.md / <id>.coaching.md のみ。
   *   settings.json は saveSettings の遅延作成に委譲、profile.md / manual.md / errors.md は対象外。
   *   B-2a: consents を seeding で捏造しないため settings.json をここでは作らない
   *         (規約・年齢同意は ConsentService = Stage 0→0.5 の責務)。§6.2 フル13手順との差分は意図的。
   *
   * ▼ 冪等(§6.1 ステート判定 ⓐ初回 / ⓒ部分復元):
   *   各ファイルは存在確認し「無ければ同梱から作成・有れば触らない(ユーザー編集を保護)」。
   *   → フォルダ無し(初回)も主要ファイル欠落(部分復元)も同じループで満たす。
   *
   * 前提: initialize() 済み。フォルダ階層は本メソッド内で冪等確保するため ensureLayout() 前後どちらでも可。
   * 返り値: EnsureLayoutResult を流用(created=今回 seed した論理パス / existed=既存でスキップした論理パス)。
   */
  async seedDefaults(): Promise<EnsureLayoutResult> {
    const deps = this.deps
    if (!deps) {
      return { ok: false, reason: 'unknown' }
    }

    const created: string[] = []
    const existed: string[] = []
    const track = (r: 'created' | 'existed', logicalPath: string): void => {
      ;(r === 'created' ? created : existed).push(logicalPath)
    }

    try {
      // フォルダ階層を冪等確保(characters 確保で root/config も連鎖確保される)。
      const charsId = await this.ensureCharactersFolderId()
      const configId = await this.ensureConfigFolderId()

      // 1. config/index.json(F2) — 同梱 BUNDLED_CHARACTER_INDEX をデフォルトに。
      track(
        await this.seedFileIfAbsent(
          configId,
          'index.json',
          DriveStorageProvider.P_INDEX,
          'application/json',
          JSON.stringify(BUNDLED_CHARACTER_INDEX, null, 2),
          'F2',
        ),
        DriveStorageProvider.P_INDEX,
      )

      // 2. config/characters/<id>.md(F6) / <id>.coaching.md(F7) — 同梱から。
      for (const id of listBundledCharacterIds()) {
        const charMd = getBundledCharacterMd(id)
        if (charMd !== null) {
          const fileName = `${id}.md`
          const logicalPath = `${DriveStorageProvider.P_CHARACTERS}/${fileName}`
          track(
            await this.seedFileIfAbsent(charsId, fileName, logicalPath, 'text/markdown', charMd, 'F6'),
            logicalPath,
          )
        }
        const coachingMd = getBundledCoachingMd(id)
        if (coachingMd !== null) {
          const fileName = `${id}.coaching.md`
          const logicalPath = `${DriveStorageProvider.P_CHARACTERS}/${fileName}`
          track(
            await this.seedFileIfAbsent(
              charsId,
              fileName,
              logicalPath,
              'text/markdown',
              coachingMd,
              'F7',
            ),
            logicalPath,
          )
        }
      }

      return { ok: true, created, existed }
    } catch (err) {
      return { ok: false, reason: this.toEnsureReason(err) }
    }
  }

  async dispose(): Promise<void> {
    // 段階2f: online 自動 flush ハンドラを解除してから後始末する。
    if (this.onlineHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler)
    }
    this.onlineHandler = null
    // 段階2a: キャッシュを flush(現状 write-through で即返り)してから接続を閉じる。
    if (this.cache) {
      try {
        await this.cache.flush()
      } catch (err) {
        this.deps?.logger?.warn('DriveStorageProvider.dispose: cache flush failed', {
          err: this.serializeError(err),
        })
      }
      this.cache.close()
      this.cache = null
    }
    this.fileIdMap.clear()
    this.etagMap.clear()
    // 段階2f: watch 購読者をクリア(teardown 後の通知漏れ防止)。
    this.settingsListeners = []
    this.syncStateListeners = []
    this.conflictListeners = []
    this.deps = null
  }

  // -- 設定 (F3 settings.json) ------------------------------

  async loadSettings(opts?: LoadOptions): Promise<LoadResult<Settings>> {
    const deps = this.deps
    if (!deps) {
      return { ok: false, reason: 'unknown' }
    }

    const forceFresh = opts?.forceFresh ?? false
    const allowStaleCache = opts?.allowStaleCache ?? false

    // 1. キャッシュ参照(段階2a)。forceFresh 時はスキップして必ず Drive を見る。
    //    fresh(TTL 内)、または allowStaleCache 指定時の stale ヒットを採用。
    if (!forceFresh && this.cache) {
      const hit = await this.cache.get<Settings>(DriveStorageProvider.P_SETTINGS)
      if (hit && (hit.fresh || allowStaleCache)) {
        return { ok: true, value: hit.value, meta: { ...hit.meta, source: 'cache' } }
      }
    }

    // 2. Drive 取得
    try {
      const fileId = await this.resolveSettingsFileId()
      if (!fileId) {
        return { ok: false, reason: 'not_found' }
      }

      const res = await this.driveApi(
        'GET',
        `${DriveStorageProvider.DRIVE_FILES}/${fileId}?alt=media`,
      )
      const text = await res.text()

      let value: Settings
      try {
        value = JSON.parse(text) as Settings
      } catch {
        return { ok: false, reason: 'parse_error' }
      }

      const meta = await this.fetchFileMeta(fileId)
      // etag を保持(段階2e の If-Match)、キャッシュを更新
      if (meta.etag) {
        this.etagMap.set(DriveStorageProvider.P_SETTINGS, meta.etag)
      }
      await this.cache?.set(DriveStorageProvider.P_SETTINGS, value, meta)
      return { ok: true, value, meta }
    } catch (err) {
      const reason = this.toLoadReason(err)
      // offline / rate_limit 時は最後にキャッシュした値を cached として添える(§3.5)
      if (reason === 'offline' || reason === 'rate_limit') {
        const stale = this.cache
          ? await this.cache.get<Settings>(DriveStorageProvider.P_SETTINGS)
          : null
        if (stale) {
          return { ok: false, reason, cached: stale.value }
        }
      }
      return { ok: false, reason }
    }
  }

  async saveSettings(settings: Settings): Promise<SaveResult> {
    const deps = this.deps
    if (!deps) {
      return { ok: false, reason: 'unknown' }
    }
    try {
      // 引き継ぎメモ §2: lastUpdated を必ず更新、schemaVersion は '1' リテラル固定
      const toSave: Settings = {
        ...settings,
        schemaVersion: '1',
        lastUpdated: deps.clock.now().toISOString(),
      }
      const body = JSON.stringify(toSave, null, 2)

      // オフライン時は Drive に書かずキューへ積む(段階2e)。content は実際に書く body。
      if (!navigator.onLine) {
        return await this.enqueueOffline(DriveStorageProvider.P_SETTINGS, body)
      }

      // config フォルダを冪等確保(段階1では saveSettings 初回に settings.json を遅延作成)
      const configId = await this.ensureConfigFolderId()
      const existingId = await this.findChildId(configId, 'settings.json', false)

      // 段階2a: LWW 競合検知の「骨格」を配線する。
      //   読込時に保持した etag を If-Match に載せ、412 を検知して handleConflict に流す——
      //   という本実装は段階2e。ここでは ifMatch の配線・412→reason:'conflict' の検知のみ用意する。
      //   ★ 現状 etagMap の値は Drive の version 番号であり、HTTP If-Match が期待する ETag とは別物。
      //     version を If-Match に載せると正常更新まで 412 で弾かれかねないため、2a では
      //     ライブ経路に載せない(ifMatch=undefined)。version↔ETag の整合は段階2e の設計判断(報告参照)。
      const ifMatch: string | undefined = undefined

      let res: Response
      if (!existingId) {
        res = await this.driveCreateFile(configId, 'settings.json', 'application/json', body, 'F3')
      } else {
        res = await this.driveUpdateContent(existingId, 'application/json', body, ifMatch)
      }

      const json = (await res.json()) as {
        id: string
        modifiedTime?: string
        version?: string
      }
      this.fileIdMap.set(DriveStorageProvider.P_SETTINGS, json.id)

      const meta: ResourceMeta = {
        driveFileId: json.id,
        modifiedTime: json.modifiedTime ?? toSave.lastUpdated,
        etag: json.version ?? '',
        source: 'drive',
      }
      // etag を保持(段階2e の If-Match)、キャッシュを更新
      if (meta.etag) {
        this.etagMap.set(DriveStorageProvider.P_SETTINGS, meta.etag)
      }
      await this.cache?.set(DriveStorageProvider.P_SETTINGS, toSave, meta)
      // 段階2f: 設定購読者へ新値、同期購読者へ最新 SyncState を通知。
      this.notifySettings(toSave)
      this.notifySyncState()
      return { ok: true, meta }
    } catch (err) {
      // 412 競合の検知(段階2a)。本処理 = ours を conflicts/ に退避 + ConflictEvent 発火は
      //   段階2e。骨格として handleConflict の呼出口だけ配線しておく(中身は未実装で throw、
      //   ここで握って warn に留め、契約どおり reason:'conflict' を返す)。
      if (err instanceof DriveHttpError && err.kind === 'conflict') {
        try {
          await this.handleConflict(
            DriveStorageProvider.P_SETTINGS,
            { modifiedTime: '', etag: this.etagMap.get(DriveStorageProvider.P_SETTINGS) ?? '' },
            { modifiedTime: '', etag: '' },
          )
        } catch (conflictErr) {
          deps.logger?.warn('DriveStorageProvider.saveSettings: handleConflict pending (段階2e)', {
            err: this.serializeError(conflictErr),
          })
        }
        return { ok: false, reason: 'conflict' }
      }
      return { ok: false, reason: this.toSaveReason(err) }
    }
  }

  // 段階2f: 設定購読。saveSettings 成功時に新値を通知(notifySettings)。
  watchSettings(cb: WatchCallback<Settings>): Unsubscribe {
    this.settingsListeners.push(cb)
    return () => {
      this.settingsListeners = this.settingsListeners.filter((l) => l !== cb)
    }
  }

  // -- キャラ (F2 index.json / F6 / F7) ---------------------
  // loadCharacterIndex / saveCharacterIndex は段階2b(settings 同型の JSON)。
  // loadCharacterMd / saveCharacterMd / loadCoachingMd / saveCoachingMd / diffBundledVsDrive は段階2c。
  async loadCharacterIndex(opts?: LoadOptions): Promise<LoadResult<CharacterIndex>> {
    const result = await this.loadConfigFile<CharacterIndex>(
      'index.json',
      DriveStorageProvider.P_INDEX,
      opts,
      (text) => {
        try {
          return { ok: true, value: JSON.parse(text) as CharacterIndex }
        } catch {
          return { ok: false }
        }
      },
    )
    // index.ts wiring(A-1): Drive 未配置(初回起動・未 seed)時は同梱 index を bundled で返す。
    //   loadCharacterMd の bundledResult と対称。fallback は not_found のみ——
    //   parse_error(JSON 破損)の default fallback + .broken 退避は別ステップ(エルトン GO で対象外)。
    //   offline / rate_limit + stale cache は loadConfigFile が cached を添えて返すため、ここでは触らない。
    if (!result.ok && result.reason === 'not_found') {
      return {
        ok: true,
        value: BUNDLED_CHARACTER_INDEX,
        meta: { driveFileId: '', modifiedTime: '', etag: '', source: 'bundled' },
      }
    }
    return result
  }

  async saveCharacterIndex(index: CharacterIndex): Promise<SaveResult> {
    const deps = this.deps
    if (!deps) {
      return { ok: false, reason: 'unknown' }
    }
    try {
      // settings 同様 lastUpdated を必ず更新、schemaVersion は '1' リテラル固定
      const toSave: CharacterIndex = {
        ...index,
        schemaVersion: '1',
        lastUpdated: deps.clock.now().toISOString(),
      }
      const body = JSON.stringify(toSave, null, 2)

      // オフライン時は Drive に書かずキューへ積む(段階2e)。
      if (!navigator.onLine) {
        return await this.enqueueOffline(DriveStorageProvider.P_INDEX, body)
      }

      const meta = await this.putConfigFile(
        'index.json',
        DriveStorageProvider.P_INDEX,
        'application/json',
        body,
        'F2',
      )
      await this.cache?.set(DriveStorageProvider.P_INDEX, toSave, meta)
      this.notifySyncState() // 段階2f
      return { ok: true, meta }
    } catch (err) {
      // 412 競合検知のみ(本処理は段階2e、saveSettings 参照)
      if (err instanceof DriveHttpError && err.kind === 'conflict') {
        return { ok: false, reason: 'conflict' }
      }
      return { ok: false, reason: this.toSaveReason(err) }
    }
  }

  // F6 <id>.md / F7 <id>.coaching.md(段階2c)。Drive 404 時は bundled アセット fallback。
  async loadCharacterMd(id: string, opts?: LoadOptions): Promise<LoadResult<string>> {
    return this.loadCharacterFile(
      `${id}.md`,
      `${DriveStorageProvider.P_CHARACTERS}/${id}.md`,
      opts,
      getBundledCharacterMd(id),
    )
  }

  async loadCoachingMd(id: string, opts?: LoadOptions): Promise<LoadResult<string>> {
    return this.loadCharacterFile(
      `${id}.coaching.md`,
      `${DriveStorageProvider.P_CHARACTERS}/${id}.coaching.md`,
      opts,
      getBundledCoachingMd(id),
    )
  }

  async saveCharacterMd(id: string, md: string): Promise<SaveResult> {
    return this.saveCharacterFile(`${id}.md`, `${DriveStorageProvider.P_CHARACTERS}/${id}.md`, md, 'F6')
  }

  async saveCoachingMd(id: string, md: string): Promise<SaveResult> {
    return this.saveCharacterFile(
      `${id}.coaching.md`,
      `${DriveStorageProvider.P_CHARACTERS}/${id}.coaching.md`,
      md,
      'F7',
    )
  }

  /**
   * 同梱版と Drive 版のキャラ MD を version で比較し、差分結果を返す(段階2c)。
   * ★副作用なし(純粋な差分照会)。bundled_newer のときに Drive を上書きするかは呼出側の判断で、
   *   上書きが必要なら applyBundledOverwrite(id) を呼ぶ(確定方針 ④: キャラ MD はアプリ側が正)。
   * version は MD フロントマターの `version: <整数>`。CharacterDiffResult は string 表現。
   */
  async diffBundledVsDrive(id: string): Promise<CharacterDiffResult> {
    const bundled = getBundledCharacterMd(id)
    if (bundled === null) {
      // 同梱に無い = ユーザー/Drive 固有キャラ。アプリ側から押し出す対象はない。
      return { kind: 'drive_only' }
    }
    const bundledVersion = this.parseFrontmatterVersion(bundled) ?? 0

    // Drive 側を fallback 無しで読む(存在しなければ driveText=null)
    let driveText: string | null = null
    try {
      const logicalPath = `${DriveStorageProvider.P_CHARACTERS}/${id}.md`
      const fileId = await this.resolveCharacterFileId(`${id}.md`, logicalPath)
      if (fileId) {
        const res = await this.driveApi(
          'GET',
          `${DriveStorageProvider.DRIVE_FILES}/${fileId}?alt=media`,
        )
        driveText = await res.text()
      }
    } catch (err) {
      if (!(err instanceof DriveHttpError && err.kind === 'not_found')) {
        // 取得不能(auth/network/rate_limit 等)→ 差分判定できない。安全側で 'same'(押し出さない)。
        this.deps?.logger?.warn('DriveStorageProvider.diffBundledVsDrive: drive read failed', {
          id,
          err: this.serializeError(err),
        })
        return { kind: 'same' }
      }
      // not_found は driveText=null のまま継続
    }

    if (driveText === null) {
      // Drive 未配置 → 同梱の方が新しい(driveVersion なし)
      return { kind: 'bundled_newer', bundledVersion: String(bundledVersion) }
    }

    const driveVersion = this.parseFrontmatterVersion(driveText)
    if (driveVersion === null || bundledVersion > driveVersion) {
      // bundled が新しい(または Drive 側 version 不明)
      return {
        kind: 'bundled_newer',
        bundledVersion: String(bundledVersion),
        ...(driveVersion === null ? {} : { driveVersion: String(driveVersion) }),
      }
    }
    return { kind: 'same' }
  }

  /**
   * 同梱版キャラ MD で Drive 版を上書きする(contract 外のクラス固有メソッド、段階2c)。
   * diffBundledVsDrive が bundled_newer を返したとき、呼出側がこれを呼んで反映する。
   *   (副作用を diff から分離。確定方針 ④: キャラ MD はアプリ側が正、上書き OK)
   * 同梱に該当 id が無い場合は何も上書きできないため reason:'unknown' を返す。
   */
  async applyBundledOverwrite(id: string): Promise<SaveResult> {
    const bundled = getBundledCharacterMd(id)
    if (bundled === null) {
      this.deps?.logger?.warn('DriveStorageProvider.applyBundledOverwrite: no bundled md', { id })
      return { ok: false, reason: 'unknown' }
    }
    return this.saveCharacterMd(id, bundled)
  }

  // -- プロファイル (F4 profile.md) — 段階2b -----------------
  // profile.md は YAML フロントマター + body。Profile 型({frontmatter, body})へ相互変換する。
  async loadProfile(opts?: LoadOptions): Promise<LoadResult<Profile>> {
    return this.loadConfigFile<Profile>(
      'profile.md',
      DriveStorageProvider.P_PROFILE,
      opts,
      // フロントマター解析は寛容(壊れていても body 全体として扱う)ため parse は常に成功
      (text) => ({ ok: true, value: this.parseProfileMd(text) }),
    )
  }

  async saveProfile(profile: Profile): Promise<SaveResult> {
    const deps = this.deps
    if (!deps) {
      return { ok: false, reason: 'unknown' }
    }
    try {
      const body = this.serializeProfileMd(profile)

      // オフライン時は Drive に書かずキューへ積む(段階2e)。
      if (!navigator.onLine) {
        return await this.enqueueOffline(DriveStorageProvider.P_PROFILE, body)
      }

      const meta = await this.putConfigFile(
        'profile.md',
        DriveStorageProvider.P_PROFILE,
        'text/markdown',
        body,
        'F4',
      )
      await this.cache?.set(DriveStorageProvider.P_PROFILE, profile, meta)
      this.notifySyncState() // 段階2f
      return { ok: true, meta }
    } catch (err) {
      if (err instanceof DriveHttpError && err.kind === 'conflict') {
        return { ok: false, reason: 'conflict' }
      }
      return { ok: false, reason: this.toSaveReason(err) }
    }
  }

  // -- マニュアル (F5 manual.md、読みのみ) — 段階2b ---------
  // 生テキストをそのまま返す。saveManual は contract に無い(マニュアルは読み専用)。
  async loadManual(opts?: LoadOptions): Promise<LoadResult<string>> {
    return this.loadConfigFile<string>(
      'manual.md',
      DriveStorageProvider.P_MANUAL,
      opts,
      (text) => ({ ok: true, value: text }),
    )
  }

  // -- 履歴 (F8 conversations / F9 errors.md、追記専用) — 段階2d --
  // 追記専用・キャッシュなし(TTL=null)。Drive にネイティブ追記が無いため read-modify-write。
  // 末尾追記の競合検知(If-Match/412)は段階2e。

  async appendError(entry: ErrorEntry): Promise<AppendResult> {
    const deps = this.deps
    if (!deps) {
      return { ok: false, reason: 'unknown' }
    }
    try {
      const block = this.formatErrorEntry(entry)
      const logsId = await this.ensureLogsFolderId()
      const meta = await this.appendToLogFile(
        logsId,
        'errors.md',
        DriveStorageProvider.P_ERRORS,
        block,
        'F9',
      )
      return { ok: true, meta }
    } catch (err) {
      if (err instanceof DriveHttpError && err.kind === 'conflict') {
        return { ok: false, reason: 'conflict' }
      }
      return { ok: false, reason: this.toSaveReason(err) }
    }
  }

  async archiveConversation(date: IsoDate, content: string): Promise<AppendResult> {
    const deps = this.deps
    if (!deps) {
      return { ok: false, reason: 'unknown' }
    }
    try {
      const fileName = this.conversationFileName(date)
      const logicalPath = `${DriveStorageProvider.P_CONVERSATIONS}/${fileName}`
      const convId = await this.ensureConversationsFolderId()
      // 同日内の追加分は同ファイルへ末尾追記(設計 §4.7)
      const meta = await this.appendToLogFile(convId, fileName, logicalPath, content, 'F8')
      return { ok: true, meta }
    } catch (err) {
      if (err instanceof DriveHttpError && err.kind === 'conflict') {
        return { ok: false, reason: 'conflict' }
      }
      return { ok: false, reason: this.toSaveReason(err) }
    }
  }

  async loadConversation(date: IsoDate, _opts?: LoadOptions): Promise<LoadResult<string>> {
    const deps = this.deps
    if (!deps) {
      return { ok: false, reason: 'unknown' }
    }
    // 会話ログはキャッシュ対象外(TTL=null)。opts に関係なく常に Drive を読む。
    try {
      const fileName = this.conversationFileName(date)
      const logicalPath = `${DriveStorageProvider.P_CONVERSATIONS}/${fileName}`
      const fileId = await this.resolveConversationFileId(fileName, logicalPath)
      if (!fileId) {
        return { ok: false, reason: 'not_found' }
      }
      const res = await this.driveApi(
        'GET',
        `${DriveStorageProvider.DRIVE_FILES}/${fileId}?alt=media`,
      )
      const text = await res.text()
      const meta = await this.fetchFileMeta(fileId)
      return { ok: true, value: text, meta }
    } catch (err) {
      return { ok: false, reason: this.toLoadReason(err) }
    }
  }

  async listConversationDates(): Promise<LoadResult<IsoDate[]>> {
    const deps = this.deps
    if (!deps) {
      return { ok: false, reason: 'unknown' }
    }
    try {
      const convId = await this.findFolderId(['MIYU_App_Data', 'logs', 'conversations'])
      if (!convId) {
        // フォルダ未作成 = まだ会話ログ無し。not_found ではなく空配列を返す。
        return {
          ok: true,
          value: [],
          meta: { driveFileId: '', modifiedTime: '', etag: '', source: 'drive' },
        }
      }
      const children = await this.listChildren(convId)
      const dates: IsoDate[] = []
      for (const child of children) {
        const m = /^会話ログ_(\d{4}-\d{2}-\d{2})\.md$/.exec(child.name)
        if (m) {
          dates.push(m[1])
        }
      }
      dates.sort()
      return {
        ok: true,
        value: dates,
        meta: { driveFileId: convId, modifiedTime: '', etag: '', source: 'drive' },
      }
    } catch (err) {
      return { ok: false, reason: this.toLoadReason(err) }
    }
  }

  // -- 同期・オフライン — 段階2 -----------------------------
  getSyncState(): SyncState {
    return {
      online: navigator.onLine,
      pendingWrites: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      // 段階2f: handleConflict が conflicts/ へ退避した未レビュー件数を反映。
      // ★ in-memory カウンタのため、再起動後の初期復元(conflicts/ 列挙→件数復元)は別ステップ(申し送り)。
      conflictsAwaitingReview: this.conflictCount,
      authStage: this.deps?.auth.currentStage() ?? 'unauth',
    }
  }

  // 段階2f: 同期状態購読。save 成功 / flushPending 完了 / handleConflict 完了時に最新 SyncState を通知。
  watchSyncState(cb: WatchCallback<SyncState>): Unsubscribe {
    this.syncStateListeners.push(cb)
    return () => {
      this.syncStateListeners = this.syncStateListeners.filter((l) => l !== cb)
    }
  }

  async flushPending(): Promise<FlushResult> {
    const entries = await this.pendingQueue.getAll()
    let flushed = 0
    let skipped = 0

    for (const entry of entries) {
      // logicalPath から fileId を解決(汎用 resolver は作らず per-resource を振り分け)。
      const fileId = await this.resolveFileIdForPath(entry.logicalPath)
      if (!fileId) {
        // fileId 未解決(対象外パス / Drive 上に未作成 等)。破棄してキューから除く。
        skipped++
        await this.pendingQueue.remove(entry.id)
        this.pendingCount = Math.max(0, this.pendingCount - 1)
        continue
      }

      // version比較によるread-before-write楽観ロック(2e-3)。
      const result = await this.conflictResolver.resolve(
        fileId,
        entry.knownVersion,
        entry.enqueuedAt,
        async (fid) => {
          const res = await this.driveApi(
            'GET',
            `${DriveStorageProvider.DRIVE_FILES}/${fid}?fields=version`,
          )
          const json = (await res.json()) as { version?: string }
          return json.version ?? '0'
        },
      )

      if (result.action === 'write') {
        await this.writeContentForPath(entry.logicalPath, entry.content)
        await this.pendingQueue.remove(entry.id)
        flushed++
        this.pendingCount = Math.max(0, this.pendingCount - 1)
      } else if (result.action === 'skip') {
        // LWW で負け(Drive 側が新しい)。破棄する。
        console.warn(`[flushPending] skipped: ${entry.logicalPath} - ${result.reason}`)
        await this.pendingQueue.remove(entry.id)
        skipped++
        this.pendingCount = Math.max(0, this.pendingCount - 1)
      } else {
        // error: version 取得失敗等。キューから除去せず次回フラッシュでリトライ(pendingCount 据え置き)。
        console.warn(`[flushPending] error: ${entry.logicalPath} - ${result.reason}`)
      }
    }

    const ok = entries.length === 0 || flushed + skipped === entries.length
    if (ok) {
      // クリーンに捌けたタイミングを最終同期時刻として記録(SyncState.lastSyncedAt 用)。
      // 契約の lastSyncedAt は string|null のため Date.now() の数値ではなく RFC3339 文字列で持つ。
      this.lastSyncedAt = this.deps?.clock.now().toISOString() ?? this.lastSyncedAt
      this.notifySyncState() // 段階2f: pendingWrites / lastSyncedAt の変化を通知
      return { ok: true, flushed, skipped }
    }
    // error が残存(リトライ対象あり)。reason は契約の許容値 'partial' を使う(詳細は warn 済)。
    this.notifySyncState() // 段階2f: 部分フラッシュでも pendingWrites は減っているため通知
    return { ok: false, reason: 'partial', flushed }
  }

  // 段階2f: 競合購読。handleConflict が ConflictEvent を発火する。
  onConflict(cb: (event: ConflictEvent) => void): Unsubscribe {
    this.conflictListeners.push(cb)
    return () => {
      this.conflictListeners = this.conflictListeners.filter((l) => l !== cb)
    }
  }

  // -- watch 通知ヘルパー(段階2f) --------------------------------
  // listener の例外は購読者側の責務だが、他の購読者・本処理を巻き込まないよう握って warn に留める。

  /** watchSettings 購読者へ最新の Settings を通知(saveSettings 成功時)。 */
  private notifySettings(value: Settings): void {
    for (const cb of this.settingsListeners) {
      try {
        cb(value)
      } catch (err) {
        this.deps?.logger?.warn('DriveStorageProvider.notifySettings: listener threw', {
          err: this.serializeError(err),
        })
      }
    }
  }

  /** watchSyncState 購読者へ現在の SyncState を通知(save / flush / conflict 後)。 */
  private notifySyncState(): void {
    if (this.syncStateListeners.length === 0) {
      return
    }
    const state = this.getSyncState()
    for (const cb of this.syncStateListeners) {
      try {
        cb(state)
      } catch (err) {
        this.deps?.logger?.warn('DriveStorageProvider.notifySyncState: listener threw', {
          err: this.serializeError(err),
        })
      }
    }
  }

  /** onConflict 購読者へ競合イベントを通知。 */
  private notifyConflict(event: ConflictEvent): void {
    for (const cb of this.conflictListeners) {
      try {
        cb(event)
      } catch (err) {
        this.deps?.logger?.warn('DriveStorageProvider.notifyConflict: listener threw', {
          err: this.serializeError(err),
        })
      }
    }
  }

  // ============================================================
  // 内部ヘルパー(段階1)
  // ============================================================

  // -- Drive API 呼び出し(access_token 自動取得 + エラー振り分け) --

  private async driveApi(
    method: string,
    url: string,
    opts?: { body?: BodyInit; contentType?: string; headers?: Record<string, string> },
  ): Promise<Response> {
    const token = await this.acquireAccessToken()

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
    if (opts?.contentType) {
      headers['Content-Type'] = opts.contentType
    }
    if (opts?.headers) {
      Object.assign(headers, opts.headers)
    }

    let res: Response
    try {
      res = await fetch(url, { method, headers, body: opts?.body })
    } catch {
      throw new DriveHttpError('network')
    }

    if (res.ok) {
      return res
    }
    throw this.httpErrorFromStatus(res.status)
  }

  private async acquireAccessToken(): Promise<string> {
    const result = await this.deps!.auth.getAccessToken()
    if (result.ok) {
      return result.token
    }
    // access_token 取得失敗 → ネットワーク以外は auth 扱い
    if (result.reason === 'network') {
      throw new DriveHttpError('network')
    }
    throw new DriveHttpError('auth')
  }

  private httpErrorFromStatus(status: number): DriveHttpError {
    if (status === 401 || status === 403) {
      return new DriveHttpError('auth', status)
    }
    if (status === 429) {
      return new DriveHttpError('rate_limit', status)
    }
    if (status === 404) {
      return new DriveHttpError('not_found', status)
    }
    // 412 Precondition Failed = If-Match 不一致 = LWW 競合(段階2e で本処理)
    if (status === 412) {
      return new DriveHttpError('conflict', status)
    }
    return new DriveHttpError('http', status)
  }

  // -- ファイル / フォルダ解決 -------------------------------

  /** 親フォルダ直下の name 一致を1件探す(§3.4: appProperties は作成時に付与) */
  private async findChild(
    parentId: string,
    name: string,
    folderOnly: boolean,
  ): Promise<{ id: string } | null> {
    const clauses = [
      `name='${name.replace(/'/g, "\\'")}'`,
      `'${parentId}' in parents`,
      'trashed=false',
    ]
    if (folderOnly) {
      clauses.push(`mimeType='${DriveStorageProvider.FOLDER_MIME}'`)
    }
    const q = encodeURIComponent(clauses.join(' and '))
    const url = `${DriveStorageProvider.DRIVE_FILES}?q=${q}&fields=files(id,name)&spaces=drive&pageSize=1`
    const res = await this.driveApi('GET', url)
    const json = (await res.json()) as { files?: Array<{ id: string; name: string }> }
    const first = json.files?.[0]
    return first ? { id: first.id } : null
  }

  private async findChildId(
    parentId: string,
    name: string,
    folderOnly: boolean,
  ): Promise<string | null> {
    const child = await this.findChild(parentId, name, folderOnly)
    return child?.id ?? null
  }

  /** フォルダを冪等に確保(あれば created:false、無ければ作成して created:true) */
  private async ensureFolder(
    logicalPath: string,
    name: string,
    parentId: string,
    role: string,
  ): Promise<{ id: string; created: boolean }> {
    const cached = this.fileIdMap.get(logicalPath)
    if (cached) {
      return { id: cached, created: false }
    }
    const existing = await this.findChild(parentId, name, true)
    if (existing) {
      this.fileIdMap.set(logicalPath, existing.id)
      return { id: existing.id, created: false }
    }
    const metadata = {
      name,
      mimeType: DriveStorageProvider.FOLDER_MIME,
      parents: [parentId],
      appProperties: { [DriveStorageProvider.ROLE_PROP]: role },
    }
    const res = await this.driveApi('POST', `${DriveStorageProvider.DRIVE_FILES}?fields=id`, {
      body: JSON.stringify(metadata),
      contentType: 'application/json',
    })
    const json = (await res.json()) as { id: string }
    this.fileIdMap.set(logicalPath, json.id)
    return { id: json.id, created: true }
  }

  /** MIYU_App_Data/config を冪等確保し、その fileId を返す(saveSettings 用) */
  private async ensureConfigFolderId(): Promise<string> {
    const root = await this.ensureFolder(DriveStorageProvider.P_ROOT, 'MIYU_App_Data', 'root', 'F0')
    const config = await this.ensureFolder(
      DriveStorageProvider.P_CONFIG,
      'config',
      root.id,
      'config',
    )
    return config.id
  }

  /** MIYU_App_Data/config/conflicts を冪等確保し fileId を返す(handleConflict 退避先、段階2f)。 */
  private async ensureConflictsFolderId(): Promise<string> {
    const configId = await this.ensureConfigFolderId()
    const conflicts = await this.ensureFolder(
      DriveStorageProvider.P_CONFLICTS,
      'conflicts',
      configId,
      'conflicts',
    )
    return conflicts.id
  }

  /** settings.json の fileId を解決(読み取り専用、無ければ null。作成はしない) */
  private async resolveSettingsFileId(): Promise<string | null> {
    const cached = this.fileIdMap.get(DriveStorageProvider.P_SETTINGS)
    if (cached) {
      return cached
    }
    const configId = await this.findFolderId(['MIYU_App_Data', 'config'])
    if (!configId) {
      return null
    }
    const fileId = await this.findChildId(configId, 'settings.json', false)
    if (fileId) {
      this.fileIdMap.set(DriveStorageProvider.P_SETTINGS, fileId)
    }
    return fileId
  }

  /**
   * config 直下の任意ファイル(index.json / profile.md / manual.md 等)の fileId を解決。
   * 読み取り専用、無ければ null(作成はしない)。段階2b で追加。
   */
  private async resolveConfigChildFileId(
    fileName: string,
    logicalPath: string,
  ): Promise<string | null> {
    const cached = this.fileIdMap.get(logicalPath)
    if (cached) {
      return cached
    }
    const configId = await this.findFolderId(['MIYU_App_Data', 'config'])
    if (!configId) {
      return null
    }
    const fileId = await this.findChildId(configId, fileName, false)
    if (fileId) {
      this.fileIdMap.set(logicalPath, fileId)
    }
    return fileId
  }

  /** ルートから順にフォルダを辿って末端の fileId を返す(無ければ null、作成はしない) */
  private async findFolderId(segments: string[]): Promise<string | null> {
    let parent = 'root'
    let logical = ''
    for (const seg of segments) {
      logical = logical ? `${logical}/${seg}` : seg
      const cached = this.fileIdMap.get(logical)
      if (cached) {
        parent = cached
        continue
      }
      const child = await this.findChild(parent, seg, true)
      if (!child) {
        return null
      }
      this.fileIdMap.set(logical, child.id)
      parent = child.id
    }
    return parent
  }

  // -- ファイル作成 / 更新 / メタ取得 ------------------------

  /** multipart で新規ファイル作成(メタデータ + 内容 + appProperties role) */
  private async driveCreateFile(
    parentId: string,
    name: string,
    contentType: string,
    content: string,
    role: string,
  ): Promise<Response> {
    const boundary = DriveStorageProvider.MULTIPART_BOUNDARY
    const metadata = {
      name,
      parents: [parentId],
      mimeType: contentType,
      appProperties: { [DriveStorageProvider.ROLE_PROP]: role },
    }
    const multipartBody =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${contentType}; charset=UTF-8\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--`
    const url = `${DriveStorageProvider.DRIVE_UPLOAD}?uploadType=multipart&fields=id,modifiedTime,version`
    return this.driveApi('POST', url, {
      body: multipartBody,
      contentType: `multipart/related; boundary=${boundary}`,
    })
  }

  /**
   * 既存ファイルの内容を置換(PATCH media。appProperties は据え置き)。
   * 段階2a: ifMatch 指定時は If-Match ヘッダで楽観的ロックを掛ける(不一致は 412 = 'conflict')。
   *   現状は呼出側が ifMatch を載せていない(version↔ETag 整合が段階2e の宿題)。
   */
  private async driveUpdateContent(
    fileId: string,
    contentType: string,
    content: string,
    ifMatch?: string,
  ): Promise<Response> {
    const url = `${DriveStorageProvider.DRIVE_UPLOAD}/${fileId}?uploadType=media&fields=id,modifiedTime,version`
    const headers = ifMatch ? { 'If-Match': ifMatch } : undefined
    return this.driveApi('PATCH', url, { body: content, contentType, headers })
  }

  /** ファイルの modifiedTime / version(etag 相当)を取得 */
  private async fetchFileMeta(fileId: string): Promise<ResourceMeta> {
    const url = `${DriveStorageProvider.DRIVE_FILES}/${fileId}?fields=id,modifiedTime,version,md5Checksum`
    const res = await this.driveApi('GET', url)
    const json = (await res.json()) as {
      id: string
      modifiedTime?: string
      version?: string
      md5Checksum?: string
    }
    return {
      driveFileId: json.id,
      modifiedTime: json.modifiedTime ?? '',
      etag: json.version ?? json.md5Checksum ?? '',
      source: 'drive',
    }
  }

  /**
   * seedDefaults 用: parent 直下に fileName が無ければ content で新規作成して 'created'、
   * 既存なら fileIdMap を温めて 'existed'(既存は上書きしない=ユーザー編集を保護)。
   * putConfigFile / putCharacterFile が create-or-update なのに対し、こちらは create-only。
   */
  private async seedFileIfAbsent(
    parentId: string,
    fileName: string,
    logicalPath: string,
    contentType: string,
    content: string,
    role: string,
  ): Promise<'created' | 'existed'> {
    const existing = await this.findChildId(parentId, fileName, false)
    if (existing) {
      this.fileIdMap.set(logicalPath, existing)
      return 'existed'
    }
    const res = await this.driveCreateFile(parentId, fileName, contentType, content, role)
    const json = (await res.json()) as { id: string }
    this.fileIdMap.set(logicalPath, json.id)
    return 'created'
  }

  // -- config 直下ファイルの共通 read / write(段階2b) -------
  // loadSettings / saveSettings(段階2a)と同型の処理を、index.json / profile.md /
  // manual.md でも使えるよう汎用化したもの。parse / serialize のみ各メソッドで差し替える。
  // (将来 loadSettings / saveSettings 自身もこの口に寄せられるが、2a 実装を据え置くため今回は触らない)

  /**
   * config 直下ファイルをキャッシュ経由で読む共通処理。
   * cache hit(fresh または allowStaleCache)→ cached を返す。miss → Drive 取得 + cache 更新。
   * parse はテキストを T へ変換し、失敗時は { ok: false }(= reason:'parse_error')。
   */
  private async loadConfigFile<T>(
    fileName: string,
    logicalPath: string,
    opts: LoadOptions | undefined,
    parse: (text: string) => { ok: true; value: T } | { ok: false },
  ): Promise<LoadResult<T>> {
    const deps = this.deps
    if (!deps) {
      return { ok: false, reason: 'unknown' }
    }

    const forceFresh = opts?.forceFresh ?? false
    const allowStaleCache = opts?.allowStaleCache ?? false

    if (!forceFresh && this.cache) {
      const hit = await this.cache.get<T>(logicalPath)
      if (hit && (hit.fresh || allowStaleCache)) {
        return { ok: true, value: hit.value, meta: { ...hit.meta, source: 'cache' } }
      }
    }

    try {
      const fileId = await this.resolveConfigChildFileId(fileName, logicalPath)
      if (!fileId) {
        return { ok: false, reason: 'not_found' }
      }

      const res = await this.driveApi(
        'GET',
        `${DriveStorageProvider.DRIVE_FILES}/${fileId}?alt=media`,
      )
      const text = await res.text()
      const parsed = parse(text)
      if (!parsed.ok) {
        return { ok: false, reason: 'parse_error' }
      }

      const meta = await this.fetchFileMeta(fileId)
      if (meta.etag) {
        this.etagMap.set(logicalPath, meta.etag)
      }
      await this.cache?.set(logicalPath, parsed.value, meta)
      return { ok: true, value: parsed.value, meta }
    } catch (err) {
      const reason = this.toLoadReason(err)
      if (reason === 'offline' || reason === 'rate_limit') {
        const stale = this.cache ? await this.cache.get<T>(logicalPath) : null
        if (stale) {
          return { ok: false, reason, cached: stale.value }
        }
      }
      return { ok: false, reason }
    }
  }

  /**
   * config 直下ファイルを作成 or 上書きし、結果 meta を返す(段階2b)。
   * 段階2a と同じく If-Match は骨格のみ(ifMatch=undefined、version↔ETag 整合は段階2e)。
   * 412(conflict)は DriveHttpError として throw され、呼出側で reason:'conflict' に変換する。
   */
  private async putConfigFile(
    fileName: string,
    logicalPath: string,
    contentType: string,
    body: string,
    role: string,
  ): Promise<ResourceMeta> {
    const configId = await this.ensureConfigFolderId()
    const existingId = await this.findChildId(configId, fileName, false)

    const ifMatch: string | undefined = undefined // version↔ETag 整合は段階2e

    let res: Response
    if (!existingId) {
      res = await this.driveCreateFile(configId, fileName, contentType, body, role)
    } else {
      res = await this.driveUpdateContent(existingId, contentType, body, ifMatch)
    }

    const json = (await res.json()) as {
      id: string
      modifiedTime?: string
      version?: string
    }
    this.fileIdMap.set(logicalPath, json.id)

    const meta: ResourceMeta = {
      driveFileId: json.id,
      modifiedTime: json.modifiedTime ?? '',
      etag: json.version ?? '',
      source: 'drive',
    }
    if (meta.etag) {
      this.etagMap.set(logicalPath, meta.etag)
    }
    return meta
  }

  // -- profile.md(F4)フロントマター 相互変換(段階2b) ------
  // フロントマターはフラットな key: value(文字列のみ)を想定。js-yaml 非依存の最小実装。

  /** profile.md テキストを Profile({frontmatter, body})へ解析(壊れていても body として吸収)。 */
  private parseProfileMd(text: string): Profile {
    const frontmatter: Record<string, string> = {}
    let body = text

    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text)
    if (match) {
      body = match[2]
      for (const line of match[1].split(/\r?\n/)) {
        const idx = line.indexOf(':')
        if (idx <= 0) {
          continue
        }
        const key = line.slice(0, idx).trim()
        let value = line.slice(idx + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        if (key) {
          frontmatter[key] = value
        }
      }
    }

    return { frontmatter, body }
  }

  /** Profile を profile.md テキスト(YAML フロントマター + body)へ直列化。 */
  private serializeProfileMd(profile: Profile): string {
    const lines: string[] = ['---']
    for (const [key, raw] of Object.entries(profile.frontmatter)) {
      if (raw === undefined || raw === null) {
        continue
      }
      const value = String(raw)
      // : # を含む / 前後空白がある値は安全のためダブルクォートで囲む
      const needsQuote = /[:#]/.test(value) || value.trim() !== value
      lines.push(`${key}: ${needsQuote ? JSON.stringify(value) : value}`)
    }
    lines.push('---')
    return `${lines.join('\n')}\n${profile.body}`
  }

  // -- characters/ 配下ファイルの read / write + bundled fallback(段階2c) --

  /**
   * config/characters/ 直下の MD をキャッシュ経由で読む。
   * Drive 未配置(resolve null または 404)時は bundled アセットを source:'bundled' で返す。
   * bundled fallback はキャッシュに書かない(キャッシュは Drive 実体の写しのみに保つ)。
   */
  private async loadCharacterFile(
    fileName: string,
    logicalPath: string,
    opts: LoadOptions | undefined,
    bundled: string | null,
  ): Promise<LoadResult<string>> {
    const deps = this.deps
    if (!deps) {
      return { ok: false, reason: 'unknown' }
    }

    const forceFresh = opts?.forceFresh ?? false
    const allowStaleCache = opts?.allowStaleCache ?? false

    if (!forceFresh && this.cache) {
      const hit = await this.cache.get<string>(logicalPath)
      if (hit && (hit.fresh || allowStaleCache)) {
        return { ok: true, value: hit.value, meta: { ...hit.meta, source: 'cache' } }
      }
    }

    try {
      const fileId = await this.resolveCharacterFileId(fileName, logicalPath)
      if (!fileId) {
        // Drive 未配置 → bundled fallback
        return this.bundledResult(bundled)
      }

      const res = await this.driveApi(
        'GET',
        `${DriveStorageProvider.DRIVE_FILES}/${fileId}?alt=media`,
      )
      const text = await res.text()

      const meta = await this.fetchFileMeta(fileId)
      if (meta.etag) {
        this.etagMap.set(logicalPath, meta.etag)
      }
      await this.cache?.set(logicalPath, text, meta)
      return { ok: true, value: text, meta }
    } catch (err) {
      if (err instanceof DriveHttpError && err.kind === 'not_found') {
        return this.bundledResult(bundled)
      }
      const reason = this.toLoadReason(err)
      if (reason === 'offline' || reason === 'rate_limit') {
        const stale = this.cache ? await this.cache.get<string>(logicalPath) : null
        if (stale) {
          return { ok: false, reason, cached: stale.value }
        }
      }
      return { ok: false, reason }
    }
  }

  /** bundled fallback を LoadResult へ。bundled が無ければ not_found。 */
  private bundledResult(bundled: string | null): LoadResult<string> {
    if (bundled === null) {
      return { ok: false, reason: 'not_found' }
    }
    return {
      ok: true,
      value: bundled,
      meta: { driveFileId: '', modifiedTime: '', etag: '', source: 'bundled' },
    }
  }

  /** config/characters/ 直下の MD を Drive 保存(2b の config 保存と同型、etag 保持 + cache 更新)。 */
  private async saveCharacterFile(
    fileName: string,
    logicalPath: string,
    md: string,
    role: string,
  ): Promise<SaveResult> {
    const deps = this.deps
    if (!deps) {
      return { ok: false, reason: 'unknown' }
    }
    try {
      // オフライン時は Drive に書かずキューへ積む(段階2e)。saveCharacterMd / saveCoachingMd
      // 双方がここを通るため、両 overwrite 系を1箇所のオフライン分岐でカバーする。
      if (!navigator.onLine) {
        return await this.enqueueOffline(logicalPath, md)
      }
      const meta = await this.putCharacterFile(fileName, logicalPath, md, role)
      await this.cache?.set(logicalPath, md, meta)
      this.notifySyncState() // 段階2f
      return { ok: true, meta }
    } catch (err) {
      if (err instanceof DriveHttpError && err.kind === 'conflict') {
        return { ok: false, reason: 'conflict' }
      }
      return { ok: false, reason: this.toSaveReason(err) }
    }
  }

  /** MIYU_App_Data/config/characters を冪等確保し、その fileId を返す。 */
  private async ensureCharactersFolderId(): Promise<string> {
    const root = await this.ensureFolder(DriveStorageProvider.P_ROOT, 'MIYU_App_Data', 'root', 'F0')
    const config = await this.ensureFolder(
      DriveStorageProvider.P_CONFIG,
      'config',
      root.id,
      'config',
    )
    const characters = await this.ensureFolder(
      DriveStorageProvider.P_CHARACTERS,
      'characters',
      config.id,
      'characters',
    )
    return characters.id
  }

  /** characters/ 直下ファイルの fileId 解決(読み取り専用、無ければ null)。 */
  private async resolveCharacterFileId(
    fileName: string,
    logicalPath: string,
  ): Promise<string | null> {
    const cached = this.fileIdMap.get(logicalPath)
    if (cached) {
      return cached
    }
    const charsId = await this.findFolderId(['MIYU_App_Data', 'config', 'characters'])
    if (!charsId) {
      return null
    }
    const fileId = await this.findChildId(charsId, fileName, false)
    if (fileId) {
      this.fileIdMap.set(logicalPath, fileId)
    }
    return fileId
  }

  /** characters/ 直下ファイルを作成 or 上書きし meta を返す(putConfigFile の characters 版)。 */
  private async putCharacterFile(
    fileName: string,
    logicalPath: string,
    body: string,
    role: string,
  ): Promise<ResourceMeta> {
    const charsId = await this.ensureCharactersFolderId()
    const existingId = await this.findChildId(charsId, fileName, false)

    const ifMatch: string | undefined = undefined // version↔ETag 整合は段階2e

    let res: Response
    if (!existingId) {
      res = await this.driveCreateFile(charsId, fileName, 'text/markdown', body, role)
    } else {
      res = await this.driveUpdateContent(existingId, 'text/markdown', body, ifMatch)
    }

    const json = (await res.json()) as {
      id: string
      modifiedTime?: string
      version?: string
    }
    this.fileIdMap.set(logicalPath, json.id)

    const meta: ResourceMeta = {
      driveFileId: json.id,
      modifiedTime: json.modifiedTime ?? '',
      etag: json.version ?? '',
      source: 'drive',
    }
    if (meta.etag) {
      this.etagMap.set(logicalPath, meta.etag)
    }
    return meta
  }

  // -- オフライン書込みキュー / フラッシュ補助(段階2e) -------

  /**
   * オフライン書込みをキューへ積み、pendingCount を進めて pending 結果を返す。
   * overwrite 系 save の先頭分岐から呼ぶ。content は実際に Drive へ書く予定の文字列、
   * knownVersion は積んだ時点で観測している version(無ければ '0')。
   */
  private async enqueueOffline(logicalPath: string, content: string): Promise<SaveResult> {
    const knownVersion = this.etagMap.get(logicalPath) ?? '0'
    await this.pendingQueue.enqueue({
      logicalPath,
      content,
      enqueuedAt: Date.now(),
      knownVersion,
    })
    this.pendingCount++
    // Drive へはまだ書いていない。契約の pending フラグで「キュー済・同期待ち」を伝える。
    return { ok: false, reason: 'offline', pending: true }
  }

  /**
   * 論理パスから fileId を解決する(flushPending 用)。汎用 resolver は新設せず、
   * 既存の per-resource resolver を logicalPath で振り分ける(2e-4 確定方針: ディスパッチ表なし)。
   * overwrite 系5種(settings / profile / index / characters 配下 md)のみ対応。
   */
  private async resolveFileIdForPath(logicalPath: string): Promise<string | null> {
    switch (logicalPath) {
      case DriveStorageProvider.P_SETTINGS:
        return this.resolveSettingsFileId()
      case DriveStorageProvider.P_PROFILE:
        return this.resolveConfigChildFileId('profile.md', DriveStorageProvider.P_PROFILE)
      case DriveStorageProvider.P_INDEX:
        return this.resolveConfigChildFileId('index.json', DriveStorageProvider.P_INDEX)
      default:
        if (logicalPath.startsWith(`${DriveStorageProvider.P_CHARACTERS}/`)) {
          const fileName = logicalPath.slice(DriveStorageProvider.P_CHARACTERS.length + 1)
          return this.resolveCharacterFileId(fileName, logicalPath)
        }
        return null
    }
  }

  /**
   * 論理パスに content を上書き書込みする(flushPending 用)。resolveFileIdForPath と同じ振り分けで
   * 既存の writer(putConfigFile / putCharacterFile)を呼ぶ。append 系は 2e-4 スコープ外。
   */
  private async writeContentForPath(logicalPath: string, content: string): Promise<void> {
    switch (logicalPath) {
      case DriveStorageProvider.P_SETTINGS:
        await this.putConfigFile(
          'settings.json',
          DriveStorageProvider.P_SETTINGS,
          'application/json',
          content,
          'F3',
        )
        return
      case DriveStorageProvider.P_PROFILE:
        await this.putConfigFile(
          'profile.md',
          DriveStorageProvider.P_PROFILE,
          'text/markdown',
          content,
          'F4',
        )
        return
      case DriveStorageProvider.P_INDEX:
        await this.putConfigFile(
          'index.json',
          DriveStorageProvider.P_INDEX,
          'application/json',
          content,
          'F2',
        )
        return
      default:
        if (logicalPath.startsWith(`${DriveStorageProvider.P_CHARACTERS}/`)) {
          const fileName = logicalPath.slice(DriveStorageProvider.P_CHARACTERS.length + 1)
          // .coaching.md は F7、それ以外のキャラ md は F6(saveCharacterMd / saveCoachingMd と一致)。
          const role = fileName.endsWith('.coaching.md') ? 'F7' : 'F6'
          await this.putCharacterFile(fileName, logicalPath, content, role)
          return
        }
        throw new Error(`writeContentForPath: unsupported logicalPath ${logicalPath}`)
    }
  }

  /** MD フロントマターから `version: <整数>` を取り出す。無ければ null。 */
  private parseFrontmatterVersion(text: string): number | null {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
    if (!match) {
      return null
    }
    for (const line of match[1].split(/\r?\n/)) {
      const m = /^\s*version\s*:\s*(\d+)\s*$/.exec(line)
      if (m) {
        return parseInt(m[1], 10)
      }
    }
    return null
  }

  // -- 履歴 (logs/) の read / append ヘルパー(段階2d) -------

  /** ErrorEntry を errors.md 追記用の markdown ブロックへ整形。 */
  private formatErrorEntry(entry: ErrorEntry): string {
    const lines: string[] = []
    lines.push(`## [${entry.occurredAt.toISOString()}] ${entry.category} / ${entry.kind}`)
    lines.push(entry.message)
    if (entry.context !== undefined) {
      lines.push(`- context: ${JSON.stringify(entry.context)}`)
    }
    if (entry.resolution !== undefined) {
      lines.push(`- resolution: ${entry.resolution}`)
    }
    if (entry.relatedDoc !== undefined) {
      lines.push(`- relatedDoc: ${entry.relatedDoc}`)
    }
    return lines.join('\n')
  }

  /** 会話ログのファイル名(F8: 会話ログ_YYYY-MM-DD.md)。 */
  private conversationFileName(date: IsoDate): string {
    return `会話ログ_${date}.md`
  }

  /** MIYU_App_Data/logs を冪等確保し fileId を返す。 */
  private async ensureLogsFolderId(): Promise<string> {
    const root = await this.ensureFolder(DriveStorageProvider.P_ROOT, 'MIYU_App_Data', 'root', 'F0')
    const logs = await this.ensureFolder(DriveStorageProvider.P_LOGS, 'logs', root.id, 'logs')
    return logs.id
  }

  /** MIYU_App_Data/logs/conversations を冪等確保し fileId を返す。 */
  private async ensureConversationsFolderId(): Promise<string> {
    const logsId = await this.ensureLogsFolderId()
    const conv = await this.ensureFolder(
      DriveStorageProvider.P_CONVERSATIONS,
      'conversations',
      logsId,
      'conversations',
    )
    return conv.id
  }

  /** conversations/ 直下ファイルの fileId 解決(読み取り専用、無ければ null)。 */
  private async resolveConversationFileId(
    fileName: string,
    logicalPath: string,
  ): Promise<string | null> {
    const cached = this.fileIdMap.get(logicalPath)
    if (cached) {
      return cached
    }
    const convId = await this.findFolderId(['MIYU_App_Data', 'logs', 'conversations'])
    if (!convId) {
      return null
    }
    const fileId = await this.findChildId(convId, fileName, false)
    if (fileId) {
      this.fileIdMap.set(logicalPath, fileId)
    }
    return fileId
  }

  /**
   * 追記専用ファイルへ block を末尾追記する(read-modify-write、Drive にネイティブ追記が無いため)。
   * 既存が無ければ新規作成。競合検知(If-Match/412)は段階2e。
   */
  private async appendToLogFile(
    parentFolderId: string,
    fileName: string,
    logicalPath: string,
    block: string,
    role: string,
  ): Promise<ResourceMeta> {
    const existingId = await this.findChildId(parentFolderId, fileName, false)

    let res: Response
    if (!existingId) {
      res = await this.driveCreateFile(parentFolderId, fileName, 'text/markdown', block, role)
    } else {
      const cur = await this.driveApi(
        'GET',
        `${DriveStorageProvider.DRIVE_FILES}/${existingId}?alt=media`,
      )
      const curText = await cur.text()
      const merged = curText.length > 0 ? `${curText}\n${block}` : block
      res = await this.driveUpdateContent(existingId, 'text/markdown', merged)
    }

    const json = (await res.json()) as {
      id: string
      modifiedTime?: string
      version?: string
    }
    this.fileIdMap.set(logicalPath, json.id)

    const meta: ResourceMeta = {
      driveFileId: json.id,
      modifiedTime: json.modifiedTime ?? '',
      etag: json.version ?? '',
      source: 'drive',
    }
    if (meta.etag) {
      this.etagMap.set(logicalPath, meta.etag)
    }
    return meta
  }

  /** 親フォルダ直下の全ファイルを列挙(ページネーション対応)。 */
  private async listChildren(parentId: string): Promise<Array<{ id: string; name: string }>> {
    const out: Array<{ id: string; name: string }> = []
    let pageToken: string | undefined
    do {
      const q = encodeURIComponent(`'${parentId}' in parents and trashed=false`)
      let url = `${DriveStorageProvider.DRIVE_FILES}?q=${q}&fields=nextPageToken,files(id,name)&spaces=drive&pageSize=100`
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`
      }
      const res = await this.driveApi('GET', url)
      const json = (await res.json()) as {
        nextPageToken?: string
        files?: Array<{ id: string; name: string }>
      }
      if (json.files) {
        out.push(...json.files)
      }
      pageToken = json.nextPageToken
    } while (pageToken)
    return out
  }

  // -- LWW 競合解決(骨格、本実装は段階2e) ------------------

  /**
   * LWW 競合の解決(段階2f 本実装)。コメント L1638-1641 の想定挙動どおり:
   *   1. ours を config/conflicts/<timestamp>-<file> に退避(競合レコードとして)
   *   2. キャッシュを無効化し、次回 load で Drive 側(theirs)を取得させる
   *   3. ConflictEvent(file / retainedPath / occurredAt / ours / theirs)を組み立てて発火
   *      + conflictCount を加算 → SyncState 変化を通知
   *
   * ★ 設計判断(エルトン確認事項):
   *   - 現行の呼出(saveSettings 412 検知)は ours/theirs としてメタデータ(etag/modifiedTime)のみ渡す。
   *     シグネチャに content が無いため、退避ファイルは「ours の本文」ではなく競合レコード(JSON)を残す。
   *     本文退避が要件なら handleConflict に content を渡す拡張が要る(= 2a の saveSettings 呼出変更=要承認)。
   *   - 「キャッシュを theirs で更新」は theirs 本文を持たないため、cache.delete による無効化で代替
   *     (次回 load=Drive=theirs と end-state は同じ)。型付き watcher への theirs 直接通知は同理由で見送り、
   *     watchSyncState への状態通知に留める。
   */
  private async handleConflict(
    logicalPath: string,
    ours: { modifiedTime: string; etag: string },
    theirs: { modifiedTime: string; etag: string },
  ): Promise<void> {
    const deps = this.deps
    if (!deps) {
      return
    }
    const occurredAt = deps.clock.now()

    // 競合レビュー待ち件数を加算(getSyncState.conflictsAwaitingReview)。
    this.conflictCount++

    // 1. ours を config/conflicts/ に退避(競合レコード)。retainedPath を控える。
    const safeName = logicalPath.replace(/[^A-Za-z0-9._-]/g, '_')
    const stamp = occurredAt.toISOString().replace(/[:.]/g, '-')
    const retainedFileName = `${stamp}-${safeName}`
    const retainedPath = `${DriveStorageProvider.P_CONFLICTS}/${retainedFileName}`
    const record = JSON.stringify(
      { logicalPath, occurredAt: occurredAt.toISOString(), ours, theirs },
      null,
      2,
    )
    try {
      const conflictsId = await this.ensureConflictsFolderId()
      await this.driveCreateFile(
        conflictsId,
        retainedFileName,
        'application/json',
        record,
        'conflict',
      )
    } catch (err) {
      deps.logger?.warn('DriveStorageProvider.handleConflict: retain failed', {
        logicalPath,
        err: this.serializeError(err),
      })
    }

    // 2. キャッシュを無効化(次回 load で Drive 側 = theirs を取得させる)。
    try {
      await this.cache?.delete(logicalPath)
    } catch (err) {
      deps.logger?.warn('DriveStorageProvider.handleConflict: cache invalidate failed', {
        logicalPath,
        err: this.serializeError(err),
      })
    }

    // 3. ConflictEvent を発火 + SyncState 変化(conflictsAwaitingReview)を通知。
    this.notifyConflict({
      file: logicalPath,
      retainedPath,
      occurredAt,
      ours,
      theirs,
    })
    this.notifySyncState()
  }

  // -- エラー → Result reason 変換 ---------------------------

  private toEnsureReason(err: unknown): 'auth' | 'rate_limit' | 'network' | 'unknown' {
    return this.mapDriveReason(err, 'ensure')
  }

  private toLoadReason(
    err: unknown,
  ): 'not_found' | 'auth' | 'rate_limit' | 'network' | 'offline' | 'unknown' {
    if (err instanceof DriveHttpError && err.kind === 'not_found') {
      return 'not_found'
    }
    return this.mapDriveReason(err, 'load')
  }

  private toSaveReason(
    err: unknown,
  ): 'auth' | 'rate_limit' | 'network' | 'offline' | 'quota' | 'unknown' {
    return this.mapDriveReason(err, 'save')
  }

  private mapDriveReason(
    err: unknown,
    op: 'ensure' | 'load' | 'save',
  ): 'auth' | 'rate_limit' | 'network' | 'unknown' {
    if (err instanceof DriveHttpError) {
      if (err.kind === 'auth') return 'auth'
      if (err.kind === 'rate_limit') return 'rate_limit'
      if (err.kind === 'network') return 'network'
    }
    this.deps?.logger?.error?.(`DriveStorageProvider.${op} failed`, {
      err: this.serializeError(err),
    })
    return 'unknown'
  }

  private serializeError(err: unknown): { name: string; message: string } {
    if (err instanceof Error) {
      return { name: err.name, message: err.message }
    }
    return { name: 'unknown', message: String(err) }
  }
}
