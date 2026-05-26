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
  /**
   * Q-U-j-13 (C6): Provider 自身が何をできるかを宣言。 readonly、 constructor で固定。
   * 動的に変わらない(初期化後の capability 変化なし)。
   */
  readonly capabilities: TTSCapabilities;
  /**
   * capabilities.synthesize=true の場合のみ実装される(例: VoicevoxTTSProvider)。
   * ArrayBuffer 取得型、 再生は呼出側責任(Web Audio API or <audio> element)。
   */
  synthesize?(text: string, options: TTSOptions): Promise<TTSResult>;
  /**
   * capabilities.synthesizeAndPlay=true の場合のみ実装される(例: WebSpeechTTSProvider v1.1)。
   * 合成+再生一体型、 ArrayBuffer は返さない(Web Speech API の制約)。
   */
  synthesizeAndPlay?(text: string, options: TTSOptions): Promise<PlayResult>;
  /** Provider が現環境で使えるかの軽量チェック(Web Speech API なら window.speechSynthesis 等) */
  isAvailable(): Promise<boolean>;
  dispose(): Promise<void>;
}

/**
 * TTSProvider が宣言する capability。 readonly で constructor 固定、 動的に変わらない。
 * Q-U-j-13 (C6) で追加。
 *
 * ベータ v1.0:
 *   - VoicevoxTTSProvider: { synthesize: true, synthesizeAndPlay: false }
 *   - WebSpeechTTSProvider: 未実装(v1.1 で { synthesize: false, synthesizeAndPlay: true })
 */
export interface TTSCapabilities {
  synthesize: boolean;
  synthesizeAndPlay: boolean;
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
 * synthesizeAndPlay() の戻り値(再生完了通知型)。
 * Q-U-j-13 (C6) で追加。 WebSpeechTTSProvider v1.1 等が返す。
 * audioBuffer は返さない(合成+再生一体型のため取得不可)。
 */
export type PlayResult =
  | { ok: true; durationMs: number }
  | { ok: false; reason: TTSErrorReason };

/**
 * TTS エラー理由列挙。
 * 'unknown' を含めることで「未来縛らない」 原則を型に適用。
 */
export type TTSErrorReason =
  | 'not_available' // Provider 自体が使えない(Web Speech 非対応ブラウザ等)
  | 'unsupported_speaker' // VOICEVOX で指定 speakerId が存在しない
  | 'speaker_required' // Q-U-j-10 (C5): speakerId 未指定。 呼出側責任を明示、 ChatService 等が必ず渡す pattern を強制
  | 'rate_limit' // Cloud Run / API レート制限
  | 'network' // ネットワーク障害
  | 'auth' // 認証失敗(将来 BYOK 型 TTS 追加時用)
  | 'invalid_text' // 入力テキストが空 / 長すぎる等
  | 'unknown';
