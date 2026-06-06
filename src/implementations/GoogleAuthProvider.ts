// GoogleAuthProvider — AuthProvider contract の本番実装
// 設計: docs/Phase2/Phase2_実装設計_v0.1_2026-05-25.md §2
// 確定回答: docs/Phase2/Phase2_QUj_Sさん_contract確認回答_v0.1_2026-05-26.md §4(Q-U-j-3) / §5(Q-U-j-5)
// Stage 機械: docs/Phase2/Phase2_OAuth_スコープ設計_v0.1_2026-05-19.md §3.1
//
// 役割: Google OAuth 2.0(Authorization Code + PKCE)で Stage 機械(unauth → stage1 → stage2)を管理。
//       refresh_token / grantedScopes / lastStage は SecretStore(完成済)に保管する。
//
// 確定方針:
//   - PKCE code_verifier は localStorage 保管(キー 'invokeaide.pkce.codeVerifier')、交換完了で即削除(Q-U-j-4)
//   - onStageChange の cb は cause 引数つき(C2 / Q-U-j-5)
//   - clientId / redirectUri / scopes は deps.config(AuthConfig)から注入、ハードコードしない(Q-U-j-3)
//   - Calendar スコープは calendar.events / 専用サブカレンダー無し(2026-05-28 確定)。
//     ただし本実装はスコープ値を持たず config 経由のため、ここに scope 定数は書かない。
//
// ⚠ 実装上の判断(要レビュー、報告書に記載):
//   ベータはリダイレクト型(popup 不使用、設計 §2.13)。フルページ遷移するため
//   requestStage1Consent() / requestCalendarConsent() は「リダイレクト開始」までを担い、
//   実際の code 交換・Stage 遷移は /auth/callback(Sさん B3 領域)から呼ぶ
//   公開メソッド handleAuthCallback() で完了する。contract 本体は変更していない。

import type { Unsubscribe } from '@/interfaces/types'
import type {
  AccessTokenResult,
  AuthConfig,
  AuthDeps,
  AuthInitResult,
  AuthProvider,
  AuthResult,
  AuthStage,
  StageChangeCause,
} from '@/interfaces/AuthProvider'

// Google OAuth トークンエンドポイントのレスポンス(必要分のみ)
interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  token_type?: string
}

// トークンエンドポイント呼び出しの失敗種別を内部で運ぶための型付きエラー
class AuthHttpError extends Error {
  readonly kind: 'network' | 'invalid_grant' | 'http'
  readonly status?: number
  /** 診断用: トークンエンドポイントの応答本文(Google の { error, error_description }) */
  readonly detail?: string
  constructor(kind: 'network' | 'invalid_grant' | 'http', status?: number, detail?: string) {
    super(`AuthHttpError:${kind}${status != null ? `:${status}` : ''}${detail ? ` ${detail}` : ''}`)
    this.kind = kind
    this.status = status
    this.detail = detail
  }
}

export class GoogleAuthProvider implements AuthProvider {
  private static readonly AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
  private static readonly TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
  // Q-U-j-4 確定: PKCE code_verifier の localStorage キー
  private static readonly PKCE_VERIFIER_KEY = 'invokeaide.pkce.codeVerifier'
  // リダイレクト前に「どの Stage の同意フロー中か」を控える(callback 完了時に参照、本実装で導入)
  private static readonly PKCE_PENDING_STAGE_KEY = 'invokeaide.pkce.pendingStage'
  // access_token 期限切れ判定のバッファ(設計 §2.8: 60秒)
  private static readonly TOKEN_EXPIRY_BUFFER_MS = 60_000

  private deps: AuthDeps | null = null
  private currentStageValue: AuthStage = 'unauth'
  private accessTokenCache: { token: string; expiresAt: number } | null = null
  private stageChangeListeners: Array<(stage: AuthStage, cause: StageChangeCause) => void> = []

  // -- ライフサイクル -------------------------------------------

  async initialize(deps: AuthDeps): Promise<AuthInitResult> {
    this.deps = deps

    // 1. SecretStore が初期化済みか(contract §4 前提: SecretStore.initialize 先行)
    const hasKey = await deps.secretStore.hasMasterKey()
    if (!hasKey) {
      return { ok: false, reason: 'secret_store_unavailable' }
    }

    // 2. config 検証
    if (!this.isConfigValid(deps.config)) {
      return { ok: false, reason: 'config_invalid' }
    }

    // 3. refresh_token があれば復元を試みる
    let refreshToken: string | null = null
    try {
      refreshToken = await deps.secretStore.getSecret('oauth.refreshToken')
    } catch (err) {
      deps.logger?.error?.('AuthProvider.initialize: getSecret failed', { err: this.serializeError(err) })
      return { ok: false, reason: 'unknown' }
    }

    if (!refreshToken) {
      this.currentStageValue = 'unauth'
      return { ok: true, restored: false, stage: 'unauth' }
    }

    const refreshed = await this.silentRefresh()
    if (!refreshed.ok) {
      // 復元失敗: 失効した secret を片付けて unauth で初期化(silentRefresh 内で setStage 済の場合あり)
      this.currentStageValue = 'unauth'
      return { ok: true, restored: false, stage: 'unauth' }
    }

    const stage = await this.resolveRestoredStage()
    this.setStage(stage, 'restored_from_storage')
    return { ok: true, restored: true, stage }
  }

  currentStage(): AuthStage {
    // 副作用なしで内部状態を返すだけ(contract §4 事後条件)
    return this.currentStageValue
  }

  // -- 同意フロー(リダイレクト型) -----------------------------

  async requestStage1Consent(): Promise<AuthResult> {
    if (!this.deps) {
      return { ok: false, reason: 'unknown' }
    }
    return this.beginConsentRedirect('stage1', this.deps.config.stage1Scopes, false)
  }

  async requestCalendarConsent(): Promise<AuthResult> {
    if (!this.deps) {
      return { ok: false, reason: 'unknown' }
    }
    // Incremental Authorization(calendar.events を追加要求、include_granted_scopes=true)
    return this.beginConsentRedirect('stage2', this.deps.config.stage2AdditionalScopes, true)
  }

  /**
   * /auth/callback(Sさん B3 領域)から呼ばれる完了ハンドラ。
   * contract には含まれない、本クラス固有の公開メソッド(指示文 §4「code を受け取って交換する関数」)。
   * ルーティング自体は B3 が実装し、抽出した code(または error)を本メソッドに渡す。
   */
  async handleAuthCallback(params: { code?: string; error?: string }): Promise<AuthResult> {
    const deps = this.deps
    if (!deps) {
      return { ok: false, reason: 'unknown' }
    }

    const pendingStage = this.readPendingStage()
    const verifier = this.readPkceVerifier()

    // ユーザー拒否 / code 欠落
    if (params.error || !params.code) {
      this.clearPkceState()
      return { ok: false, reason: 'denied' }
    }
    if (!verifier) {
      // code_verifier が無い = フロー不整合(別タブ / localStorage クリア等)
      this.clearPkceState()
      return { ok: false, reason: 'unknown' }
    }

    let tokens: TokenResponse
    try {
      tokens = await this.exchangeCodeForTokens(params.code, verifier, deps.config)
    } catch (err) {
      this.clearPkceState()
      if (err instanceof AuthHttpError && err.kind === 'network') {
        return { ok: false, reason: 'network' }
      }
      deps.logger?.error?.('AuthProvider.handleAuthCallback: exchange failed', {
        err: this.serializeError(err),
        status: err instanceof AuthHttpError ? err.status : undefined,
        // 診断: Google が返した原因(client_secret 欠落 / redirect_uri 不一致 等)
        detail: err instanceof AuthHttpError ? err.detail : undefined,
      })
      return { ok: false, reason: 'unknown' }
    }
    // code_verifier は交換完了で即削除(Q-U-j-4)
    this.clearPkceState()

    const newGranted = tokens.scope ? tokens.scope.split(' ').filter(Boolean) : []
    // stage2(Incremental)は既存 grantedScopes と統合
    const granted =
      pendingStage === 'stage2' ? await this.mergeGrantedScopes(newGranted) : newGranted

    // stage1 で Drive(drive.file)が拒否されたケース(設計 §2.6: partial を granted つきで返す)
    if (pendingStage === 'stage1' && !this.scopesIncludeDrive(granted)) {
      await this.persistTokens(tokens, granted, pendingStage)
      this.cacheAccessToken(tokens)
      this.setStage('stage1', 'consent_granted')
      return { ok: false, reason: 'partial', granted }
    }

    await this.persistTokens(tokens, granted, pendingStage)
    this.cacheAccessToken(tokens)
    this.setStage(pendingStage, 'consent_granted')
    return { ok: true, granted, newStage: pendingStage }
  }

  // -- アクセストークン -----------------------------------------

  async getAccessToken(): Promise<AccessTokenResult> {
    if (!this.deps) {
      return { ok: false, reason: 'unknown' }
    }
    const cache = this.accessTokenCache
    const now = this.deps.clock.now().getTime()
    if (cache && cache.expiresAt > now + GoogleAuthProvider.TOKEN_EXPIRY_BUFFER_MS) {
      return { ok: true, token: cache.token, expiresAt: cache.expiresAt }
    }
    // 期限切れ(または未キャッシュ)は silent refresh に委譲(呼出側は期限を気にしなくてよい)
    return this.silentRefresh()
  }

  async silentRefresh(): Promise<AccessTokenResult> {
    const deps = this.deps
    if (!deps) {
      return { ok: false, reason: 'unknown' }
    }

    const refreshToken = await deps.secretStore.getSecret('oauth.refreshToken')
    if (!refreshToken) {
      return { ok: false, reason: 'no_refresh_token' }
    }

    try {
      const tokens = await this.refreshAccessToken(refreshToken, deps.config)
      const expiresAt = this.computeExpiry(tokens.expires_in)
      this.accessTokenCache = { token: tokens.access_token, expiresAt }
      return { ok: true, token: tokens.access_token, expiresAt }
    } catch (err) {
      if (err instanceof AuthHttpError) {
        if (err.kind === 'invalid_grant') {
          // refresh_token 失効 → secret 破棄 + unauth へ(cause: refresh_failed)
          await this.discardAuthSecrets()
          this.accessTokenCache = null
          this.setStage('unauth', 'refresh_failed')
          return { ok: false, reason: 'refresh_failed' }
        }
        if (err.kind === 'network') {
          return { ok: false, reason: 'network' }
        }
      }
      deps.logger?.error?.('AuthProvider.silentRefresh failed', { err: this.serializeError(err) })
      return { ok: false, reason: 'unknown' }
    }
  }

  // -- サインアウト / リスナー / scope ------------------------

  async signOut(): Promise<void> {
    await this.discardAuthSecrets()
    this.accessTokenCache = null
    this.setStage('unauth', 'user_signout')
  }

  onStageChange(cb: (stage: AuthStage, cause: StageChangeCause) => void): Unsubscribe {
    this.stageChangeListeners.push(cb)
    return () => {
      const idx = this.stageChangeListeners.indexOf(cb)
      if (idx >= 0) {
        this.stageChangeListeners.splice(idx, 1)
      }
    }
  }

  async getGrantedScopes(): Promise<string[] | null> {
    if (!this.deps) {
      return null
    }
    const raw = await this.deps.secretStore.getSecret('oauth.grantedScopes')
    if (!raw) {
      return null
    }
    return raw.split(',').filter(Boolean)
  }

  // -- 内部ヘルパー: Stage 通知 --------------------------------

  private setStage(stage: AuthStage, cause: StageChangeCause): void {
    this.currentStageValue = stage
    for (const cb of [...this.stageChangeListeners]) {
      try {
        cb(stage, cause)
      } catch (err) {
        this.deps?.logger?.warn('AuthProvider.onStageChange listener threw', {
          err: this.serializeError(err),
        })
      }
    }
  }

  // -- 内部ヘルパー: 同意リダイレクト --------------------------

  private async beginConsentRedirect(
    target: AuthStage,
    scopes: string[],
    incremental: boolean,
  ): Promise<AuthResult> {
    const deps = this.deps
    if (!deps) {
      return { ok: false, reason: 'unknown' }
    }
    try {
      const verifier = this.generateCodeVerifier()
      const challenge = await this.computeCodeChallenge(verifier)
      this.writePkceState(verifier, target)
      const url = this.buildAuthUrl(deps.config, scopes, challenge, incremental)
      globalThis.location.assign(url)
    } catch (err) {
      this.clearPkceState()
      deps.logger?.error?.('AuthProvider.beginConsentRedirect failed', {
        err: this.serializeError(err),
      })
      return { ok: false, reason: 'unknown' }
    }
    // フルページ遷移するため、ここで制御は実質戻らない。
    // 実結果は handleAuthCallback() + onStageChange() 経由で surface する。
    return new Promise<AuthResult>(() => {
      /* 遷移によりページは unload される(意図的に未解決) */
    })
  }

  // -- 内部ヘルパー: トークンエンドポイント --------------------

  private async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    config: AuthConfig,
  ): Promise<TokenResponse> {
    return this.postToken({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      client_id: config.clientId,
      // confidential client(Web/Desktop)では Google が client_secret を必須とする
      // (2026-06-06 実機で 'client_secret is missing' を確認)。secret 注記は AuthConfig 参照。
      client_secret: config.clientSecret ?? '',
      redirect_uri: config.redirectUri,
    })
  }

  private async refreshAccessToken(refreshToken: string, config: AuthConfig): Promise<TokenResponse> {
    return this.postToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
      // refresh_token 交換も confidential client では client_secret が必須
      // (これが無いと silentRefresh / getAccessToken が同じ 400 で失敗する)
      client_secret: config.clientSecret ?? '',
    })
  }

  private async postToken(fields: Record<string, string>): Promise<TokenResponse> {
    let res: Response
    try {
      res = await fetch(GoogleAuthProvider.TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields).toString(),
      })
    } catch {
      // fetch 自体の失敗(オフライン / DNS 等)はネットワーク扱い
      throw new AuthHttpError('network')
    }
    if (!res.ok) {
      // 診断: 原因特定のため応答本文(Google の { error, error_description })を読む。
      // 例: 'invalid_request: client_secret is missing' / 'redirect_uri_mismatch'
      const detail = await this.readErrorDetail(res)
      // 400 / 401 は invalid_grant(refresh_token 失効・code 不正)として扱う
      if (res.status === 400 || res.status === 401) {
        throw new AuthHttpError('invalid_grant', res.status, detail)
      }
      throw new AuthHttpError('http', res.status, detail)
    }
    return (await res.json()) as TokenResponse
  }

  /**
   * トークンエンドポイントのエラー応答本文を診断用に抽出する(失敗しても undefined を返すのみ)。
   * Google は { error, error_description } の JSON を返す。秘匿情報は含まれない想定。
   */
  private async readErrorDetail(res: Response): Promise<string | undefined> {
    let text: string
    try {
      text = await res.text()
    } catch {
      return undefined
    }
    if (!text) return undefined
    try {
      const json = JSON.parse(text) as { error?: string; error_description?: string }
      const parts = [json.error, json.error_description].filter(Boolean)
      return parts.length > 0 ? parts.join(': ') : text.slice(0, 200)
    } catch {
      return text.slice(0, 200)
    }
  }

  private buildAuthUrl(
    config: AuthConfig,
    scopes: string[],
    codeChallenge: string,
    incremental: boolean,
  ): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    })
    if (incremental) {
      params.set('include_granted_scopes', 'true')
    }
    return `${GoogleAuthProvider.AUTH_ENDPOINT}?${params.toString()}`
  }

  // -- 内部ヘルパー: secret 永続化 ----------------------------

  private async persistTokens(
    tokens: TokenResponse,
    grantedScopes: string[],
    stage: AuthStage,
  ): Promise<void> {
    const ss = this.deps!.secretStore
    // refresh_token は Incremental 時に返らないこともあるため、ある時だけ更新
    if (tokens.refresh_token) {
      await ss.putSecret('oauth.refreshToken', tokens.refresh_token)
    }
    await ss.putSecret('oauth.grantedScopes', grantedScopes.join(','))
    await ss.putSecret('oauth.lastStage', stage)
  }

  private async discardAuthSecrets(): Promise<void> {
    const ss = this.deps?.secretStore
    if (!ss) {
      return
    }
    await ss.removeSecret('oauth.refreshToken')
    await ss.removeSecret('oauth.grantedScopes')
    await ss.removeSecret('oauth.lastStage')
  }

  private async mergeGrantedScopes(newScopes: string[]): Promise<string[]> {
    const existing = (await this.getGrantedScopes()) ?? []
    return Array.from(new Set([...existing, ...newScopes]))
  }

  private async resolveRestoredStage(): Promise<AuthStage> {
    // lastStage を主に、grantedScopes で裏取り(設計 §2.5)
    const last = await this.deps!.secretStore.getSecret('oauth.lastStage')
    if (last === 'stage2' || last === 'stage1') {
      return last
    }
    const granted = (await this.getGrantedScopes()) ?? []
    if (this.scopesIncludeCalendar(granted)) {
      return 'stage2'
    }
    if (this.scopesIncludeDrive(granted)) {
      return 'stage1'
    }
    return 'unauth'
  }

  // -- 内部ヘルパー: scope 判定 -------------------------------

  private scopesIncludeDrive(scopes: string[]): boolean {
    return scopes.some((s) => s.includes('drive.file'))
  }

  private scopesIncludeCalendar(scopes: string[]): boolean {
    return scopes.some((s) => s.includes('calendar.events'))
  }

  // -- 内部ヘルパー: PKCE / localStorage ----------------------

  private generateCodeVerifier(): string {
    const bytes = new Uint8Array(32)
    globalThis.crypto.getRandomValues(bytes)
    return this.base64UrlEncode(bytes.buffer)
  }

  private async computeCodeChallenge(verifier: string): Promise<string> {
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(verifier),
    )
    return this.base64UrlEncode(digest)
  }

  private base64UrlEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (const b of bytes) {
      binary += String.fromCharCode(b)
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  private writePkceState(verifier: string, stage: AuthStage): void {
    try {
      globalThis.localStorage.setItem(GoogleAuthProvider.PKCE_VERIFIER_KEY, verifier)
      globalThis.localStorage.setItem(GoogleAuthProvider.PKCE_PENDING_STAGE_KEY, stage)
    } catch (err) {
      this.deps?.logger?.warn('AuthProvider.writePkceState: localStorage failed', {
        err: this.serializeError(err),
      })
    }
  }

  private readPkceVerifier(): string | null {
    try {
      return globalThis.localStorage.getItem(GoogleAuthProvider.PKCE_VERIFIER_KEY)
    } catch {
      return null
    }
  }

  private readPendingStage(): AuthStage {
    try {
      const v = globalThis.localStorage.getItem(GoogleAuthProvider.PKCE_PENDING_STAGE_KEY)
      if (v === 'stage1' || v === 'stage2') {
        return v
      }
    } catch {
      /* ignore */
    }
    return 'stage1'
  }

  private clearPkceState(): void {
    try {
      globalThis.localStorage.removeItem(GoogleAuthProvider.PKCE_VERIFIER_KEY)
      globalThis.localStorage.removeItem(GoogleAuthProvider.PKCE_PENDING_STAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  // -- 内部ヘルパー: その他 ----------------------------------

  private cacheAccessToken(tokens: TokenResponse): void {
    this.accessTokenCache = {
      token: tokens.access_token,
      expiresAt: this.computeExpiry(tokens.expires_in),
    }
  }

  private computeExpiry(expiresInSec: number): number {
    const now = this.deps!.clock.now().getTime()
    return now + expiresInSec * 1000
  }

  private isConfigValid(config: AuthConfig | undefined): boolean {
    return (
      !!config &&
      !!config.clientId &&
      !!config.redirectUri &&
      Array.isArray(config.stage1Scopes) &&
      config.stage1Scopes.length > 0 &&
      Array.isArray(config.stage2AdditionalScopes) &&
      config.stage2AdditionalScopes.length > 0
    )
  }

  private serializeError(err: unknown): { name: string; message: string } {
    if (err instanceof Error) {
      return { name: err.name, message: err.message }
    }
    return { name: 'unknown', message: String(err) }
  }
}
