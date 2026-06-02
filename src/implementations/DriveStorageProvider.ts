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

  private deps: StorageDeps | null = null
  // 論理パス → driveFileId の解決メモ(段階1は in-memory のみ。永続キャッシュは段階2)
  private fileIdMap: Map<string, string> = new Map()
  // 論理パス → 最後に観測した etag(段階2e の LWW If-Match 競合検知で消費)
  private etagMap: Map<string, string> = new Map()
  // ローカルキャッシュ層(段階2a)。initialize で生成、利用不可環境では null(キャッシュ無し劣化運用)
  private cache: IndexedDbCache | null = null

  // -- ライフサイクル ---------------------------------------

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

  async dispose(): Promise<void> {
    // 段階2a: キャッシュを flush(現状 write-through で即返り)してから接続を閉じる。
    //   段階2e で PendingQueue flush / watcher 解除を追加する。
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

  watchSettings(_cb: WatchCallback<Settings>): Unsubscribe {
    throw new Error('DriveStorageProvider.watchSettings() not implemented yet (段階2)')
  }

  // -- キャラ (F2 index.json / F6 / F7) ---------------------
  // loadCharacterIndex / saveCharacterIndex は段階2b(settings 同型の JSON)。
  // loadCharacterMd / saveCharacterMd / loadCoachingMd / saveCoachingMd / diffBundledVsDrive は段階2c。
  async loadCharacterIndex(opts?: LoadOptions): Promise<LoadResult<CharacterIndex>> {
    return this.loadConfigFile<CharacterIndex>(
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
      const meta = await this.putConfigFile(
        'index.json',
        DriveStorageProvider.P_INDEX,
        'application/json',
        body,
        'F2',
      )
      await this.cache?.set(DriveStorageProvider.P_INDEX, toSave, meta)
      return { ok: true, meta }
    } catch (err) {
      // 412 競合検知のみ(本処理は段階2e、saveSettings 参照)
      if (err instanceof DriveHttpError && err.kind === 'conflict') {
        return { ok: false, reason: 'conflict' }
      }
      return { ok: false, reason: this.toSaveReason(err) }
    }
  }

  async loadCharacterMd(_id: string, _opts?: LoadOptions): Promise<LoadResult<string>> {
    // 段階2: Drive 404 時に bundled アセット fallback(source:'bundled', C4)
    throw new Error('DriveStorageProvider.loadCharacterMd() not implemented yet (段階2)')
  }

  async loadCoachingMd(_id: string, _opts?: LoadOptions): Promise<LoadResult<string>> {
    throw new Error('DriveStorageProvider.loadCoachingMd() not implemented yet (段階2)')
  }

  async saveCharacterMd(_id: string, _md: string): Promise<SaveResult> {
    throw new Error('DriveStorageProvider.saveCharacterMd() not implemented yet (段階2)')
  }

  async saveCoachingMd(_id: string, _md: string): Promise<SaveResult> {
    throw new Error('DriveStorageProvider.saveCoachingMd() not implemented yet (段階2)')
  }

  async diffBundledVsDrive(_id: string): Promise<CharacterDiffResult> {
    throw new Error('DriveStorageProvider.diffBundledVsDrive() not implemented yet (段階2)')
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
      const meta = await this.putConfigFile(
        'profile.md',
        DriveStorageProvider.P_PROFILE,
        'text/markdown',
        body,
        'F4',
      )
      await this.cache?.set(DriveStorageProvider.P_PROFILE, profile, meta)
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

  // -- 履歴 (F8 / F9、追記専用) — 段階2 ---------------------
  async appendError(_entry: ErrorEntry): Promise<AppendResult> {
    throw new Error('DriveStorageProvider.appendError() not implemented yet (段階2)')
  }

  async archiveConversation(_date: IsoDate, _content: string): Promise<AppendResult> {
    throw new Error('DriveStorageProvider.archiveConversation() not implemented yet (段階2)')
  }

  async loadConversation(_date: IsoDate, _opts?: LoadOptions): Promise<LoadResult<string>> {
    throw new Error('DriveStorageProvider.loadConversation() not implemented yet (段階2)')
  }

  async listConversationDates(): Promise<LoadResult<IsoDate[]>> {
    throw new Error('DriveStorageProvider.listConversationDates() not implemented yet (段階2)')
  }

  // -- 同期・オフライン — 段階2 -----------------------------
  getSyncState(): SyncState {
    throw new Error('DriveStorageProvider.getSyncState() not implemented yet (段階2)')
  }

  watchSyncState(_cb: WatchCallback<SyncState>): Unsubscribe {
    throw new Error('DriveStorageProvider.watchSyncState() not implemented yet (段階2)')
  }

  async flushPending(): Promise<FlushResult> {
    throw new Error('DriveStorageProvider.flushPending() not implemented yet (段階2)')
  }

  onConflict(_cb: (event: ConflictEvent) => void): Unsubscribe {
    throw new Error('DriveStorageProvider.onConflict() not implemented yet (段階2)')
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

  // -- LWW 競合解決(骨格、本実装は段階2e) ------------------

  /**
   * LWW 競合(412)の解決。段階2e で internal/ConflictResolver に委譲して本実装する:
   *   1. ours(ローカル保存待ちだった内容)を config/conflicts/<timestamp>-<file> に退避
   *   2. ConflictEvent(retainedPath / occurredAt / ours / theirs)を組み立てて発火
   *   3. キャッシュを theirs(Drive 側)で更新、watchers に theirs を通知
   * 段階2a では未実装。saveSettings の 412 検知は reason:'conflict' を返すに留める。
   */
  private async handleConflict(
    _logicalPath: string,
    _ours: { modifiedTime: string; etag: string },
    _theirs: { modifiedTime: string; etag: string },
  ): Promise<void> {
    throw new Error('DriveStorageProvider.handleConflict() not implemented yet (段階2e)')
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
