// ConflictResolver — version比較によるread-before-write楽観ロックの判定器(段階2e-3)
// 設計: 競合検知方式 = version比較によるread-before-write楽観ロック(2e-1 確定)
//       PendingQueueStore.ts(2e-2)が溜めた書込みを flushPending が反映する際の可否判定に使う
//
// 責務:
//   - 書込み直前に Drive の最新 version を取得し、積んだ時点の knownVersion と比較する
//   - 一致 → 'write'(安全に上書き) / Drive 側が新しい → 'skip'(LWW で負け) / 取得失敗 → 'error'
//
// 非責務(本ファイルのスコープ外):
//   - Drive API の直接呼出し(fetchVersion を DI で受け取り、API 依存を持たない)
//   - DriveStorageProvider 本体への配線 / flushPending の実装
//
// version は Drive の単調増加整数(文字列で保持)。比較は parseInt で数値化して行う。

/** resolve() の判定結果。 */
export type ConflictResult =
  | { action: 'write' } //                    安全に書き込んでよい
  | { action: 'skip'; reason: string } //     競合: 今回はスキップ(LWW で負け)
  | { action: 'error'; reason: string } //    取得失敗など想定外エラー

export class ConflictResolver {
  /**
   * 書き込み前に Drive の最新 version を取得し、knownVersion と比較する。
   *
   * @param fileId       - Drive のファイル ID
   * @param knownVersion - etagMap に保存していた version 文字列
   * @param enqueuedAt   - PendingEntry のタイムスタンプ(将来の LWW 拡張用に受け取るが今は使わない)
   * @param fetchVersion - Drive API 呼び出し関数(テスト容易性のため DI)
   * @returns ConflictResult
   */
  async resolve(
    fileId: string,
    knownVersion: string,
    enqueuedAt: number, // 将来の LWW 拡張用(タイムスタンプ基準の解決)。現ロジックでは未使用。
    fetchVersion: (fileId: string) => Promise<string>,
  ): Promise<ConflictResult> {
    // enqueuedAt は将来の LWW 拡張(タイムスタンプ基準解決)用に受け取るが、現ロジックでは未使用。
    // noUnusedParameters を満たしつつ引数名を仕様どおり維持するため void 参照に留める。
    void enqueuedAt

    let currentVersion: string
    try {
      currentVersion = await fetchVersion(fileId)
    } catch (err) {
      // 取得失敗は throw せず error として返す(呼出側 = flushPending がハンドリング)。
      return { action: 'error', reason: this.errorMessage(err) }
    }

    // 文字列として一致するなら確実に同一 version → そのまま書き込む。
    if (currentVersion === knownVersion) {
      return { action: 'write' }
    }

    // version は単調増加整数。Drive 側が進んでいれば LWW で負け = スキップ。
    if (parseInt(currentVersion, 10) > parseInt(knownVersion, 10)) {
      return { action: 'skip', reason: 'Drive side is newer (LWW)' }
    }

    // それ以外(currentVersion が小さい等、理論上起きない)は安全側で書き込む。
    return { action: 'write' }
  }

  private errorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message
    }
    return String(err)
  }
}
