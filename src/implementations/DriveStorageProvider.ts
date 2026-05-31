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
//   ▼▼ 段階2に回す(別指示文):
//     - IndexedDbCache(キャッシュ層) / PendingQueue(オフライン保存待ち) /
//       ConflictResolver(LWW 競合解決、If-Match/412/handleConflict) … src/implementations/internal/
//     - bundled アセット fallback(loadCharacterMd 等の 404 fallback、source:'bundled')
//     - watch 系(watchSettings / watchSyncState / onConflict)、flushPending、getSyncState
//     - キャラ/プロファイル/マニュアル/履歴の各 load/save(下記スケルトン据え置き)
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

// Drive API のエラーを種別つきで内部に運ぶ(呼出側で Result reason に変換)
class DriveHttpError extends Error {
  readonly kind: 'auth' | 'rate_limit' | 'network' | 'not_found' | 'http'
  readonly status?: number
  constructor(kind: 'auth' | 'rate_limit' | 'network' | 'not_found' | 'http', status?: number) {
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
  private static readonly P_LOGS = 'MIYU_App_Data/logs'
  private static readonly P_CONVERSATIONS = 'MIYU_App_Data/logs/conversations'
  private static readonly P_SETTINGS = 'MIYU_App_Data/config/settings.json'

  private deps: StorageDeps | null = null
  // 論理パス → driveFileId の解決メモ(段階1は in-memory のみ。永続キャッシュは段階2)
  private fileIdMap: Map<string, string> = new Map()

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

    // 3. 段階1ではキャッシュ / PendingQueue の初期化は無し(段階2で IndexedDbCache 等を復元)
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
    // 段階1は最小実装: 内部状態をクリア(段階2でキャッシュ flush / watcher 解除を追加)
    this.fileIdMap.clear()
    this.deps = null
  }

  // -- 設定 (F3 settings.json) ------------------------------

  async loadSettings(_opts?: LoadOptions): Promise<LoadResult<Settings>> {
    const deps = this.deps
    if (!deps) {
      return { ok: false, reason: 'unknown' }
    }
    // ★段階1: キャッシュ無し(cache hit 経路 / allowStaleCache / forceFresh は段階2で作り込む)
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
      return { ok: true, value, meta }
    } catch (err) {
      return { ok: false, reason: this.toLoadReason(err) }
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

      // ★段階2: ここに LWW 競合検知(読込時 etag を保持 → If-Match 付き PATCH → 412 で handleConflict)を足す。
      //         段階1は素直に作成 / 上書きする。
      let res: Response
      if (!existingId) {
        res = await this.driveCreateFile(configId, 'settings.json', 'application/json', body, 'F3')
      } else {
        res = await this.driveUpdateContent(existingId, 'application/json', body)
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
      return { ok: true, meta }
    } catch (err) {
      return { ok: false, reason: this.toSaveReason(err) }
    }
  }

  watchSettings(_cb: WatchCallback<Settings>): Unsubscribe {
    throw new Error('DriveStorageProvider.watchSettings() not implemented yet (段階2)')
  }

  // -- キャラ (F2 / F6 / F7) — 段階2 ------------------------
  async loadCharacterIndex(_opts?: LoadOptions): Promise<LoadResult<CharacterIndex>> {
    throw new Error('DriveStorageProvider.loadCharacterIndex() not implemented yet (段階2)')
  }

  async saveCharacterIndex(_index: CharacterIndex): Promise<SaveResult> {
    throw new Error('DriveStorageProvider.saveCharacterIndex() not implemented yet (段階2)')
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

  // -- プロファイル (F4) — 段階2 ----------------------------
  async loadProfile(_opts?: LoadOptions): Promise<LoadResult<Profile>> {
    throw new Error('DriveStorageProvider.loadProfile() not implemented yet (段階2)')
  }

  async saveProfile(_profile: Profile): Promise<SaveResult> {
    throw new Error('DriveStorageProvider.saveProfile() not implemented yet (段階2)')
  }

  // -- マニュアル (F5、読みのみ) — 段階2 --------------------
  async loadManual(_opts?: LoadOptions): Promise<LoadResult<string>> {
    throw new Error('DriveStorageProvider.loadManual() not implemented yet (段階2)')
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
    opts?: { body?: BodyInit; contentType?: string },
  ): Promise<Response> {
    const token = await this.acquireAccessToken()

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
    if (opts?.contentType) {
      headers['Content-Type'] = opts.contentType
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

  /** 既存ファイルの内容を置換(PATCH media。appProperties は据え置き) */
  private async driveUpdateContent(
    fileId: string,
    contentType: string,
    content: string,
  ): Promise<Response> {
    const url = `${DriveStorageProvider.DRIVE_UPLOAD}/${fileId}?uploadType=media&fields=id,modifiedTime,version`
    return this.driveApi('PATCH', url, { body: content, contentType })
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
