// コンポジションルート(S2-1)
// アプリ全体で共有する Provider/Store の singleton を、契約が要求する初期化順序で配線する。
//
// 初期化順序(契約上の前提):
//   1. SecretStore.initialize()  … 端末派生鍵(masterKey)を生成/復元
//   2. AuthProvider.initialize() … SecretStore.hasMasterKey()==true が前提(AuthProvider contract §4)
//
// 方針:
//   - getServices() は遅延・冪等。初回呼び出しで一度だけ初期化し、以降は同じ Promise を返す。
//   - auth は具象 GoogleAuthProvider 型で公開する。/auth/callback 完了に使う handleAuthCallback()
//     は AuthProvider contract に含まれない本クラス固有メソッドのため(GoogleAuthProvider コメント §16-20)。
//   - Clock / Logger / AuthConfig はここで一元注入する(各実装にハードコードしない、Q-U-j-3)。

import type { Clock, Logger } from '@/interfaces/types'
import type { SecretStore, SecretStoreInitResult } from '@/interfaces/SecretStore'
import type { AuthConfig, AuthInitResult } from '@/interfaces/AuthProvider'
import { IndexedDbSecretStore } from '@/implementations/IndexedDbSecretStore'
import { GoogleAuthProvider } from '@/implementations/GoogleAuthProvider'

// Clock 抽象遵守(直接 new Date() を実装側に書かない、テスト容易性)。contract: now(): Date
const clock: Clock = {
  now: () => new Date(),
}

// 最小ロガー(本番では収集しない。開発時の console 出力のみ)
const logger: Logger = {
  warn: (msg, ctx) => console.warn(msg, ctx ?? ''),
  error: (msg, ctx) => console.error(msg, ctx ?? ''),
  info: (msg, ctx) => console.info(msg, ctx ?? ''),
  debug: (msg, ctx) => console.debug(msg, ctx ?? ''),
}

/**
 * OAuth クライアント設定を環境変数から組み立てる。
 * スコープは 2026-05-28 確定方針に従う(drive.file / tasks / calendar.events、制限付きスコープなし)。
 * clientId / redirectUri が空でも GoogleAuthProvider.initialize() が config_invalid を返すだけで、
 * 例外は投げない(設定画面で「未設定」を表示できる)。
 */
function buildAuthConfig(): AuthConfig {
  const env = import.meta.env
  return {
    clientId: (env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '',
    redirectUri: (env.VITE_GOOGLE_REDIRECT_URI as string | undefined) ?? '',
    // Stage1: ログイン情報 + Drive(drive.file) + Tasks
    stage1Scopes: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/tasks',
    ],
    // Stage2(Incremental): カレンダーイベントのみ(専用サブカレンダー無し、メイン集約)
    stage2AdditionalScopes: ['https://www.googleapis.com/auth/calendar.events'],
  }
}

/** AuthProvider.initialize を SecretStore 失敗で省略した場合の擬似結果 */
type AuthInitOutcome = AuthInitResult | { ok: false; reason: 'skipped_secret_store' }

export interface AppServices {
  secretStore: SecretStore
  /** handleAuthCallback() を使うため具象型で公開する */
  auth: GoogleAuthProvider
  status: {
    secretStore: SecretStoreInitResult
    auth: AuthInitOutcome
  }
}

let servicesPromise: Promise<AppServices> | null = null

/**
 * アプリ共有サービスを取得する(遅延初期化・冪等)。
 * 初期化に失敗しても reject せず、status に結果を載せて返す(UI 側で分岐できるように)。
 */
export function getServices(): Promise<AppServices> {
  if (!servicesPromise) {
    servicesPromise = initServices()
  }
  return servicesPromise
}

async function initServices(): Promise<AppServices> {
  const secretStore = new IndexedDbSecretStore()
  const auth = new GoogleAuthProvider()

  const secretStoreResult = await secretStore.initialize({ clock, logger })

  let authResult: AuthInitOutcome
  if (!secretStoreResult.ok) {
    // SecretStore が使えない環境では AuthProvider 初期化を省略(前提を満たさないため)
    authResult = { ok: false, reason: 'skipped_secret_store' }
  } else {
    authResult = await auth.initialize({ secretStore, clock, logger, config: buildAuthConfig() })
  }

  return {
    secretStore,
    auth,
    status: { secretStore: secretStoreResult, auth: authResult },
  }
}

/** テスト用: singleton をリセットする(本番コードからは呼ばない) */
export function __resetServicesForTest(): void {
  servicesPromise = null
}
