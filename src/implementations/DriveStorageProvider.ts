// Skeleton for DriveStorageProvider (案2 配置, 2026-05-26)
// 実装本体は Q-U-j-6, Q-U-j-7 (Sさん 回答待ち) 解決 + AuthProvider + SecretStore 完成後に着手
// Q-U-j-8 確定済: PendingQueueStore / ConflictResolver は src/implementations/internal/ に切出し
// Q-U-j-9 確定済: IndexedDB キャッシュ TTL は階層化
//   - settings.json / index.json / profile.md = 60秒
//   - manual.md / characters/*.md / *.coaching.md = 1時間
//   - errors.md / conversations/*.md = キャッシュなし(追記専用)

import type {
  AppendResult,
  ConflictEvent,
  EnsureLayoutResult,
  FlushResult,
  InitResult,
  LoadOptions,
  LoadResult,
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

export class DriveStorageProvider implements StorageProvider {
  private deps: StorageDeps | null = null

  async initialize(deps: StorageDeps): Promise<InitResult> {
    this.deps = deps
    throw new Error('DriveStorageProvider.initialize() not implemented yet')
  }

  async ensureLayout(): Promise<EnsureLayoutResult> {
    void this.deps
    throw new Error('DriveStorageProvider.ensureLayout() not implemented yet')
  }

  async dispose(): Promise<void> {
    throw new Error('DriveStorageProvider.dispose() not implemented yet')
  }

  // -- 設定 (F3) ------------------------------------------------
  async loadSettings(_opts?: LoadOptions): Promise<LoadResult<Settings>> {
    throw new Error('DriveStorageProvider.loadSettings() not implemented yet')
  }

  async saveSettings(_settings: Settings): Promise<SaveResult> {
    throw new Error('DriveStorageProvider.saveSettings() not implemented yet')
  }

  watchSettings(_cb: WatchCallback<Settings>): Unsubscribe {
    throw new Error('DriveStorageProvider.watchSettings() not implemented yet')
  }

  // -- キャラ (F2 / F6 / F7) ------------------------------------
  async loadCharacterIndex(_opts?: LoadOptions): Promise<LoadResult<CharacterIndex>> {
    throw new Error('DriveStorageProvider.loadCharacterIndex() not implemented yet')
  }

  async saveCharacterIndex(_index: CharacterIndex): Promise<SaveResult> {
    throw new Error('DriveStorageProvider.saveCharacterIndex() not implemented yet')
  }

  async loadCharacterMd(_id: string, _opts?: LoadOptions): Promise<LoadResult<string>> {
    throw new Error('DriveStorageProvider.loadCharacterMd() not implemented yet')
  }

  async loadCoachingMd(_id: string, _opts?: LoadOptions): Promise<LoadResult<string>> {
    throw new Error('DriveStorageProvider.loadCoachingMd() not implemented yet')
  }

  async saveCharacterMd(_id: string, _md: string): Promise<SaveResult> {
    throw new Error('DriveStorageProvider.saveCharacterMd() not implemented yet')
  }

  async saveCoachingMd(_id: string, _md: string): Promise<SaveResult> {
    throw new Error('DriveStorageProvider.saveCoachingMd() not implemented yet')
  }

  async diffBundledVsDrive(_id: string): Promise<CharacterDiffResult> {
    throw new Error('DriveStorageProvider.diffBundledVsDrive() not implemented yet')
  }

  // -- プロファイル (F4) ----------------------------------------
  async loadProfile(_opts?: LoadOptions): Promise<LoadResult<Profile>> {
    throw new Error('DriveStorageProvider.loadProfile() not implemented yet')
  }

  async saveProfile(_profile: Profile): Promise<SaveResult> {
    throw new Error('DriveStorageProvider.saveProfile() not implemented yet')
  }

  // -- マニュアル (F5、 読みのみ) -------------------------------
  async loadManual(_opts?: LoadOptions): Promise<LoadResult<string>> {
    throw new Error('DriveStorageProvider.loadManual() not implemented yet')
  }

  // -- 履歴 (F8 / F9、 追記専用) --------------------------------
  async appendError(_entry: ErrorEntry): Promise<AppendResult> {
    throw new Error('DriveStorageProvider.appendError() not implemented yet')
  }

  async archiveConversation(_date: IsoDate, _content: string): Promise<AppendResult> {
    throw new Error('DriveStorageProvider.archiveConversation() not implemented yet')
  }

  async loadConversation(_date: IsoDate, _opts?: LoadOptions): Promise<LoadResult<string>> {
    throw new Error('DriveStorageProvider.loadConversation() not implemented yet')
  }

  async listConversationDates(): Promise<LoadResult<IsoDate[]>> {
    throw new Error('DriveStorageProvider.listConversationDates() not implemented yet')
  }

  // -- 同期・オフライン -----------------------------------------
  getSyncState(): SyncState {
    throw new Error('DriveStorageProvider.getSyncState() not implemented yet')
  }

  watchSyncState(_cb: WatchCallback<SyncState>): Unsubscribe {
    throw new Error('DriveStorageProvider.watchSyncState() not implemented yet')
  }

  async flushPending(): Promise<FlushResult> {
    throw new Error('DriveStorageProvider.flushPending() not implemented yet')
  }

  onConflict(_cb: (event: ConflictEvent) => void): Unsubscribe {
    throw new Error('DriveStorageProvider.onConflict() not implemented yet')
  }
}
