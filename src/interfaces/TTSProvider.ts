// TTSProvider contract(Phase 1 技術スタック決定提案 v0.4 §2.10 / §1.5 ベース、 新規起草)
// 音声合成プロバイダ抽象。 VOICEVOX Cloud Run + Web Speech API フォールバックを切替可能に
// 実装(Uさん 担当): VoicevoxProvider(Cloud Run 経由)、 WebSpeechProvider(ブラウザ標準)
//
// 前提:
//   - 各 Provider は dispose() 呼出後の操作を契約違反として扱う
//   - synthesize() は throw せず Promise.resolve で TTSResult を返す
//
// 事後条件:
//   - synthesize().ok=true の場合、 audioBuffer は再生可能な音声データ(MIME は mimeType で返す)
//   - isAvailable() は副作用なし、 Provider が現環境で使えるか検査のみ

export interface TTSProvider {
  /** 'voicevox' | 'webspeech' | string(将来拡張) */
  readonly providerId: string;
  synthesize(text: string, options: TTSOptions): Promise<TTSResult>;
  /** Provider が現環境で使えるかの軽量チェック(Web Speech API なら window.speechSynthesis 等) */
  isAvailable(): Promise<boolean>;
  dispose(): Promise<void>;
}

export interface TTSOptions {
  /** VOICEVOX 用、 Web Speech では無視 */
  speakerId?: number;
  /** 1.0 = 等速、 2.0 = 倍速、 0.5 = 半速 */
  speedScale?: number;
  /** -0.15 〜 0.15 程度の範囲(VOICEVOX 仕様準拠) */
  pitchScale?: number;
  /** 1.0 = 既定音量 */
  volumeScale?: number;
  /** 1.0 = 既定イントネーション、 0.0 で抑揚なし */
  intonationScale?: number;
  /** 'wav' | 'mp3' | 'ogg' | string(将来拡張)、 Provider が対応する形式を返す */
  preferredFormat?: 'wav' | 'mp3' | 'ogg' | string;
}

export type TTSResult =
  | { ok: true; audioBuffer: ArrayBuffer; mimeType: string; durationMs: number }
  | { ok: false; reason: TTSErrorReason };

/**
 * TTS エラー理由列挙。
 * 'unknown' を含めることで「未来縛らない」 原則を型に適用。
 */
export type TTSErrorReason =
  | 'not_available' // Provider 自体が使えない(Web Speech 非対応ブラウザ等)
  | 'unsupported_speaker' // VOICEVOX で指定 speakerId が存在しない
  | 'rate_limit' // Cloud Run / API レート制限
  | 'network' // ネットワーク障害
  | 'auth' // 認証失敗(将来 BYOK 型 TTS 追加時用)
  | 'invalid_text' // 入力テキストが空 / 長すぎる等
  | 'unknown';
