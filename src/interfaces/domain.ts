// Drive ファイル形態のドメイン型(Phase 2 Interface契約 v0.1 §2.1 抜粋)
// StorageProvider が読み書きする SoT データ構造

export type IsoDate = string; // 'YYYY-MM-DD'
export type WeekdayMask = number; // bit 0=Sun … 6=Sat
export type AiProviderId = 'gemini' | 'claude' | 'openai' | string;

// -- 設定 ---------------------------------------------------

export interface Settings {
  schemaVersion: '1';
  lastUpdated: string;
  currentCharacterId: string;
  coaching: {
    enabled: boolean;
    /** 'HH:MM' */
    notificationTime: string;
    frequency: 'daily' | 'weekday' | 'custom';
    customDays?: WeekdayMask;
    calendarConnected: boolean;
  };
  calendar: {
    // メインカレンダー集約。将来の設定用に名前空間を維持
    // (2026-05-28 確定: 専用サブカレンダーは作らず calendar.events でメインに集約)
  };
  ai: {
    provider: AiProviderId;
    modelHint: string | null;
  };
  tts: {
    preferVoicevox: boolean;
    voicevoxEndpoint: string | null;
    fallbackWebSpeech: boolean;
  };
  ui: {
    fontScale: number;
    reducedMotion: boolean;
  };
  consents: {
    termsVersion: string;
    termsAcceptedAt: string;
    ageConfirmedAt: string;
    privacyVersion: string;
  };
}

// -- キャラ -------------------------------------------------

export interface CharacterIndex {
  schemaVersion: '1';
  lastUpdated: string;
  characters: CharacterEntry[];
}

export interface CharacterEntry {
  id: string;
  displayName: string;
  characterMdPath: string;
  coachingMdPath: string;
  voicevoxSpeakerId: number;
  voicevoxCreditLine: string;
  description: string;
  bundledInBeta: boolean;
}

export type CharacterDiffResult =
  | { kind: 'same' }
  | { kind: 'drive_only' }
  | { kind: 'bundled_newer'; bundledVersion: string; driveVersion?: string };

// -- プロファイル -------------------------------------------

export interface Profile {
  frontmatter: {
    displayName?: string;
    birthDate?: string;
    birthTime?: string;
    birthPlace?: string;
    horoscopeSystem?: 'western' | 'kyusei' | 'animal' | 'none' | string;
    horoscopeFrequency?: 'weekly' | 'daily' | 'off';
  };
  body: string;
}

// -- エラーログ ---------------------------------------------

export interface ErrorEntry {
  occurredAt: Date;
  category: ErrorCategory;
  kind: string;
  message: string;
  context?: object;
  resolution?: string;
  relatedDoc?: string;
}

export type ErrorCategory =
  | 'OAuth'
  | 'Drive API'
  | 'Calendar API'
  | 'Tasks API'
  | 'Gemini API'
  | 'VOICEVOX'
  | 'UI'
  | 'Sync'
  | 'Other'
  | 'unknown'
  | string;
