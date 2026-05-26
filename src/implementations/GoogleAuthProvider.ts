// Skeleton for GoogleAuthProvider (案2 配置, 2026-05-26 / contract v0.2 適用後)
// 実装本体は Q-U-j-3, Q-U-j-5 (Sさん 回答済、 contract v0.2 反映済) + SecretStore 完成後に着手
// Q-U-j-4 確定済: PKCE code_verifier は localStorage 保管 (キー 'invokeaide.pkce.codeVerifier')、
//                  コールバック完了時に即削除
// C2 (Q-U-j-5): onStageChange callback に cause 引数追加 (StageChangeCause)
// C3 (Q-U-j-6): getGrantedScopes() を追加

import type { Unsubscribe } from '@/interfaces/types'
import type {
  AccessTokenResult,
  AuthDeps,
  AuthInitResult,
  AuthProvider,
  AuthResult,
  AuthStage,
  StageChangeCause,
} from '@/interfaces/AuthProvider'

export class GoogleAuthProvider implements AuthProvider {
  private deps: AuthDeps | null = null

  async initialize(deps: AuthDeps): Promise<AuthInitResult> {
    this.deps = deps
    throw new Error('GoogleAuthProvider.initialize() not implemented yet')
  }

  currentStage(): AuthStage {
    void this.deps
    throw new Error('GoogleAuthProvider.currentStage() not implemented yet')
  }

  async requestStage1Consent(): Promise<AuthResult> {
    throw new Error('GoogleAuthProvider.requestStage1Consent() not implemented yet')
  }

  async requestCalendarConsent(): Promise<AuthResult> {
    throw new Error('GoogleAuthProvider.requestCalendarConsent() not implemented yet')
  }

  async getAccessToken(): Promise<AccessTokenResult> {
    throw new Error('GoogleAuthProvider.getAccessToken() not implemented yet')
  }

  async silentRefresh(): Promise<AccessTokenResult> {
    throw new Error('GoogleAuthProvider.silentRefresh() not implemented yet')
  }

  async signOut(): Promise<void> {
    throw new Error('GoogleAuthProvider.signOut() not implemented yet')
  }

  onStageChange(_cb: (stage: AuthStage, cause: StageChangeCause) => void): Unsubscribe {
    throw new Error('GoogleAuthProvider.onStageChange() not implemented yet')
  }

  async getGrantedScopes(): Promise<string[] | null> {
    throw new Error('GoogleAuthProvider.getGrantedScopes() not implemented yet')
  }
}
