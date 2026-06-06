# 引き継ぎ帳：InvokeAide ── 2026-06-03

**作成**: 技術顧問エルトン（Claude.ai）
**宛先**: 次回チャットのエルトン
**担当CC**: PC2（ノートPC）/ InvokeAide開発担当（Sさん・Tさん・Uさん）
**リポジトリ**: github.com/Novemin/InvokeAide（private）

---

## 本日の大きな成果：DriveStorage 段階2f 完了・push済み

DriveStorageProvider 段階2は **2a〜2f すべて完了** しました。
origin/main = HEAD = **9f94da5**

### 本日のcommit

| commit | 内容 | 担当 |
|---|---|---|
| 6f41a30 | push（Sさんの voicevoxSpeakerId 実機確認コメント） | U（push代行） |
| 9f94da5 | 段階2f（watch系3メソッド本実装・handleConflict・online自動flush） | U |

---

## 段階2fで実装した内容

### 実装した4点

**① watch系3メソッド本実装**（throw → listenersパターン）
- watchSettings / watchSyncState / onConflict
- GoogleAuthProviderのonStageChangeパターンに倣い実装
- 各メソッド用のprivate listeners配列 + unsubscribeクロージャ

**② handleConflict 本実装**
- conflicts/<timestamp>-<file> に競合レコードJSON退避
- キャッシュをdelete無効化（次回load=Drive=theirs）
- ConflictEventをonConflict listenersに通知

**③ getSyncState の conflictsAwaitingReview 配線**
- ハードコード0を解消
- private conflictCount フィールドで管理

**④ window.addEventListener('online', flushPending) 追加**
- コンストラクタで登録、dispose()でremoveEventListener
- initialize前（deps未確立）の発火は未認証flushを避けるガード付き

### 確定した設計判断（重要）
- handleConflictの本文退避：ours/theirsがメタデータのみのため、競合レコードJSON退避 + キャッシュdelete無効化で実装（本文退避は対象外）
- watchSettingsの通知はsaveSettingsのみ（型整合上）
- conflictCountはin-memoryのみ（再起動後の復元は別ステップ申し送り）

---

## ⚠️ 次回の最優先：index.ts wiring

### index.ts wiringでやること
- 初回Drive seeding
- loadCharacterIndexのbundled fallback

### その後
- VoicevoxTTSProvider 本実装（synthesize / synthesizeAndPlay）

---

## 残課題（PENDING）

| 課題 | 内容 | 優先度 |
|---|---|---|
| **index.ts wiring** | 初回Drive seeding・loadCharacterIndexのbundled fallback | 高・次回 |
| append系のオフラインキュー対応 | 段階2eで対象外にした分。別ステップ化 | 中 |
| VoicevoxTTSProvider 本実装 | スケルトンのまま（synthesize/play未実装） | 中 |
| 単体テストのMock配置 | tests/mocks vs tests/helpers、Tさん確認事項 | 中 |
| 仕様書v1.5改訂（エルトン宿題） | §7.3「専用カレンダー自動作成」→「メインカレンダー集約」等 | 高 |
| conflictCountの再起動後復元 | conflicts/列挙→件数復元。別ステップ申し送り | 低 |
| domain.ts lint 1件 | calendar:{}空ブロック（意図的・既存コミット済み）。スコープ外 | 低 |

### 解決済み（PENDINGから消す）
- ~~DriveStorage 段階2a〜2f~~ ✅ 全完了・push済み（9f94da5）
- ~~voicevoxSpeakerId 実機確認~~ ✅ 3キャラ全て一致確認済み

---

## 運用メモ

- **Uさんの作業傾向**：慎重・正確。事前に食い違い点を洗い出してから実装する。申し送り事項も明確
- **Sさんの本日の作業**：なし（6f41a30は前回セッション分のpush代行のみ）
- **Tさんは本日稼働なし**（memory/T_progress.mdに作業メモが残置中）
- **指示文の鉄則**：①設計原典を参照させる ②実装前に現状確認を報告させる ③スコープ外を明示 ④commitは指示で明確化

---

## 次回の入り

1. このチャットを開いたらまずUさんを起動して現状確認を報告させる
2. index.ts wiringの設計をUさんと確認してからGO
3. 仕様書v1.5改訂（エルトン宿題）も並行で進めるか判断
4. Tさんのmemory/T_progress.mdの残作業も次回確認
