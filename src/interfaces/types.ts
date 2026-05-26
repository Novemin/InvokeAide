// 共通型(Phase 2 Interface契約 v0.1 §1.4 / §1.5 / §1.6 / §2.1 抜粋)
// 全 Provider / Service で共有される Result 型族 + メタ型
// 「未来縛らない」 原則: ErrorReason に 'unknown' を含む

// -- 時刻・ログ抽象 ------------------------------------------

export interface Clock {
  now(): Date;
}

export interface Logger {
  warn(msg: string, ctx?: object): void;
  error?(msg: string, ctx?: object): void;
  info?(msg: string, ctx?: object): void;
  debug?(msg: string, ctx?: object): void;
}

// -- LoadOptions(キャッシュ制御) ---------------------------

export interface LoadOptions {
  /**
   * true の場合、 キャッシュを無視して必ず Drive から取得する。
   * オフライン時は LoadResult.ok=false + reason='offline' + cached?(あれば)を返す。
   * 既定 false。
   */
  forceFresh?: boolean;

  /**
   * キャッシュが TTL を超過していても許容する(オフライン UX 優先)。
   * 既定 false。 既定では TTL 超過時に Drive 再取得を試みる。
   */
  allowStaleCache?: boolean;
}

// -- WatchCallback 共通型 -----------------------------------

export type WatchCallback<T> = (value: T) => void;
export type Unsubscribe = () => void;

// -- Result 型族 --------------------------------------------

export type LoadResult<T> =
  | { ok: true; value: T; meta: ResourceMeta }
  | { ok: false; reason: LoadErrorReason; cached?: T };

export type SaveResult =
  | { ok: true; meta: ResourceMeta }
  | { ok: false; reason: SaveErrorReason; pending?: boolean };

export type AppendResult =
  | { ok: true; meta: ResourceMeta }
  | { ok: false; reason: SaveErrorReason; pending?: boolean };

export type FlushResult =
  | { ok: true; flushed: number; skipped: number }
  | { ok: false; reason: SaveErrorReason | 'partial' | 'unknown'; flushed: number };

export type InitResult =
  | { ok: true }
  | { ok: false; reason: 'auth_missing' | 'drive_denied' | 'unknown' };

export type EnsureLayoutResult =
  | { ok: true; created: string[]; existed: string[] }
  | { ok: false; reason: 'auth' | 'rate_limit' | 'network' | 'unknown' };

/**
 * 読み込みエラーの理由列挙。
 * 'unknown' を含めることで「未来縛らない」 原則を型に適用。
 */
export type LoadErrorReason =
  | 'not_found'
  | 'parse_error'
  | 'auth'
  | 'rate_limit'
  | 'network'
  | 'offline'
  | 'unknown';

export type SaveErrorReason =
  | 'conflict'
  | 'auth'
  | 'rate_limit'
  | 'network'
  | 'offline'
  | 'quota'
  | 'unknown';

// -- メタ情報 -----------------------------------------------

export interface ResourceMeta {
  driveFileId: string;
  /** RFC3339 UTC */
  modifiedTime: string;
  etag: string;
  source: 'drive' | 'cache' | 'pending' | 'bundled';
}

// -- 同期状態 -----------------------------------------------

export interface SyncState {
  online: boolean;
  pendingWrites: number;
  lastSyncedAt: string | null;
  conflictsAwaitingReview: number;
  authStage: 'unauth' | 'stage1' | 'stage2';
}

// -- 競合イベント -------------------------------------------

export interface ConflictEvent {
  file: string;
  retainedPath: string;
  occurredAt: Date;
  ours: { modifiedTime: string; etag: string };
  theirs: { modifiedTime: string; etag: string };
}
