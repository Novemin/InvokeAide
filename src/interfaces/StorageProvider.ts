// StorageProvider contract(Phase 2 Interface契約 v0.1 §2)
// Drive ファイル抽象 + ローカルキャッシュ + pending queue + 競合検知
// 実装(Uさん 担当): DriveStorage(本番)、 MemoryStorage(テスト)、 FlakyStorage(オフライン UX 検証)
//
// 前提:
//   - initialize() を呼ぶ前に他のメソッドを呼ぶことは契約違反
//   - dispose() 後の呼び出しは契約違反(リジェクトする)
//
// 事後条件:
//   - すべての Result 型は throw せず Promise.resolve で返す
//   - LoadResult.ok=false でも cached が undefined でない場合、 cached は最後に
//     キャッシュにあった値(Drive アクセス前)を表す

import type {
  AppendResult,
  Clock,
  ConflictEvent,
  EnsureLayoutResult,
  FlushResult,
  InitResult,
  LoadOptions,
  LoadResult,
  Logger,
  SaveResult,
  SyncState,
  Unsubscribe,
  WatchCallback,
} from './types';
import type {
  CharacterDiffResult,
  CharacterIndex,
  ErrorEntry,
  IsoDate,
  Profile,
  Settings,
} from './domain';
import type { AuthProvider } from './AuthProvider';
import type { SecretStore } from './SecretStore';

export interface StorageProvider {
  // -- ライフサイクル ---------------------------------------
  initialize(deps: StorageDeps): Promise<InitResult>;
  ensureLayout(): Promise<EnsureLayoutResult>;
  dispose(): Promise<void>;

  // -- 設定(F3 settings.json) ----------------------------
  loadSettings(opts?: LoadOptions): Promise<LoadResult<Settings>>;
  saveSettings(settings: Settings): Promise<SaveResult>;
  watchSettings(cb: WatchCallback<Settings>): Unsubscribe;

  // -- キャラ(F2 index.json / F6 / F7) -------------------
  loadCharacterIndex(opts?: LoadOptions): Promise<LoadResult<CharacterIndex>>;
  saveCharacterIndex(index: CharacterIndex): Promise<SaveResult>;
  loadCharacterMd(id: string, opts?: LoadOptions): Promise<LoadResult<string>>;
  loadCoachingMd(id: string, opts?: LoadOptions): Promise<LoadResult<string>>;
  saveCharacterMd(id: string, md: string): Promise<SaveResult>;
  saveCoachingMd(id: string, md: string): Promise<SaveResult>;
  diffBundledVsDrive(id: string): Promise<CharacterDiffResult>;

  // -- プロファイル(F4 profile.md) ----------------------
  loadProfile(opts?: LoadOptions): Promise<LoadResult<Profile>>;
  saveProfile(profile: Profile): Promise<SaveResult>;

  // -- マニュアル(F5 manual.md、 読みのみ) ---------------
  loadManual(opts?: LoadOptions): Promise<LoadResult<string>>;

  // -- 履歴(F8 / F9、 追記専用) --------------------------
  appendError(entry: ErrorEntry): Promise<AppendResult>;
  archiveConversation(date: IsoDate, content: string): Promise<AppendResult>;
  loadConversation(date: IsoDate, opts?: LoadOptions): Promise<LoadResult<string>>;
  listConversationDates(): Promise<LoadResult<IsoDate[]>>;

  // -- 同期・オフライン -----------------------------------
  getSyncState(): SyncState;
  watchSyncState(cb: WatchCallback<SyncState>): Unsubscribe;
  flushPending(): Promise<FlushResult>;
  onConflict(cb: (event: ConflictEvent) => void): Unsubscribe;
}

export interface StorageDeps {
  auth: AuthProvider;
  secretStore: SecretStore;
  clock: Clock;
  logger?: Logger;
}
