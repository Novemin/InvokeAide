// AuthProvider contract(Phase 2 Interface契約 v0.1 §4)
// Google OAuth フロー(Stage 機械 + Incremental Authorization)
// 実装(Uさん 担当): GoogleAuthProvider(本番)、 MockAuthProvider(テスト)
//
// Stage 機械(Uさん OAuth §3.1):
//   unauth → stage1(Drive + Tasks) → stage2(+ Calendar)
//
// 前提:
//   - initialize(deps) を呼ぶ前に他メソッドを呼ぶことは契約違反
//   - SecretStore.initialize() が先行している必要あり(refresh_token 保管に使う)
//
// 事後条件:
//   - currentStage() は副作用なし、 内部状態を返すだけ
//   - requestStage*Consent() 成功時は内部状態が更新され、 onStageChange リスナー
//     に新しい Stage が通知される

import type { Clock, Logger, Unsubscribe } from './types';
import type { SecretStore } from './SecretStore';

export interface AuthProvider {
  initialize(deps: AuthDeps): Promise<AuthInitResult>;
  currentStage(): AuthStage;
  /** Stage 0/0.5 → Stage 1 へ昇格、 Drive + Tasks スコープを要求 */
  requestStage1Consent(): Promise<AuthResult>;
  /** Stage 1 → Stage 2 へ昇格、 Calendar スコープを Incremental Authorization */
  requestCalendarConsent(): Promise<AuthResult>;
  /** access_token を返す(期限切れなら silent refresh) */
  getAccessToken(): Promise<AccessTokenResult>;
  /** silent refresh のみ強制(access_token を更新) */
  silentRefresh(): Promise<AccessTokenResult>;
  signOut(): Promise<void>;
  /** Q-U-j-5 (C2): cb の 2 引数目で cause を渡す(user_signout / refresh_failed 等を UI 側で区別) */
  onStageChange(cb: (stage: AuthStage, cause: StageChangeCause) => void): Unsubscribe;
  /** Q-U-j-6 (C3): 現在保持している granted scopes を返す。 unauth 時は null。 StorageProvider が drive_denied 判定に使う */
  getGrantedScopes(): Promise<string[] | null>;
}

export interface AuthDeps {
  secretStore: SecretStore;
  clock: Clock;
  logger?: Logger;
  /** OAuth クライアント設定(環境ごとに差し替え) */
  config: AuthConfig;
}

export interface AuthConfig {
  clientId: string;
  /**
   * OAuth client_secret(2026-06-06 追加)。
   * Google のトークンエンドポイントは confidential client(Web/Desktop)で client_secret を必須とする
   * (実機で 'client_secret is missing' を確認)。env(.env.local / VITE_GOOGLE_CLIENT_SECRET)から注入。
   * クライアントサイドに secret を含めることは本来非推奨だが、デスクトップアプリ型 OAuth では
   * Google が事実上許容している設計。任意(?)としつつ未設定だとトークン交換が 400 になる。
   */
  clientSecret?: string;
  /** 例: 'https://invokeaide-beta.pages.dev/auth/callback' */
  redirectUri: string;
  /** 例: ['openid', 'email', 'profile', 'drive.file', 'tasks'] */
  stage1Scopes: string[];
  /** 例: ['calendar.events'](2026-05-28 たかしさん判断: フル calendar ではなくイベントのみ。 専用サブカレンダーは作らずメインに集約) */
  stage2AdditionalScopes: string[];
}

export type AuthStage = 'unauth' | 'stage1' | 'stage2';

/**
 * onStageChange の cause 引数。
 * 「単純な signOut」 と「予期せぬ refresh 失効」 を UI 側で区別するため。
 * Q-U-j-5 (C2) で追加。 'unknown' で「未来縛らない」 原則に整合。
 */
export type StageChangeCause =
  | 'user_signout' // 明示的に signOut() が呼ばれた
  | 'refresh_failed' // silent refresh が失敗(token 失効)
  | 'consent_granted' // requestStage*Consent 成功で昇格
  | 'restored_from_storage' // initialize 時に refresh_token から復元
  | 'unknown';

export type AuthInitResult =
  | { ok: true; restored: boolean; stage: AuthStage }
  | { ok: false; reason: 'secret_store_unavailable' | 'config_invalid' | 'unknown' };

export type AuthResult =
  | { ok: true; granted: string[]; newStage: AuthStage }
  | { ok: false; reason: 'denied' | 'partial' | 'network' | 'unknown'; granted?: string[] };

export type AccessTokenResult =
  | { ok: true; token: string; expiresAt: number } // expiresAt: unix ms
  | { ok: false; reason: 'no_refresh_token' | 'refresh_failed' | 'network' | 'unknown' };
