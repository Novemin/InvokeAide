// 「作成 → 検証 → 削除」 セットを安全に実行するヘルパー
// 例外発生時も削除を試みる finally パターン
// 削除失敗時は警告ログのみで、 検証結果自体は返す

/**
 * @param {() => Promise<T>} createFn  リソースを作成する関数
 * @param {(resource: T) => Promise<R>} verifyFn  検証を行う関数
 * @param {(resource: T) => Promise<void>} deleteFn  リソースを削除する関数
 * @returns {Promise<R>}  verifyFn の戻り値
 */
export async function withCleanup(createFn, verifyFn, deleteFn) {
  let resource = null;
  let cleanupError = null;
  try {
    resource = await createFn();
    return await verifyFn(resource);
  } finally {
    if (resource) {
      try {
        await deleteFn(resource);
      } catch (err) {
        cleanupError = err;
        console.warn(
          `⚠️  cleanup 失敗: ${err.message}。 検証用アカウントを手動で確認してください。`,
        );
      }
    }
    if (cleanupError) {
      // cleanup 失敗は警告のみで、 verify の結果は呼出側に返す
    }
  }
}
