# 引き継ぎ帳：InvokeAide ── 2026-05-31

**作成**: 技術顧問エルトン（Claude.ai）
**宛先**: 次回チャットのエルトン
**担当CC**: PC2（ノートPC）/ InvokeAide開発担当（Sさん・Tさん・Uさん）
**リポジトリ**: github.com/Novemin/InvokeAide（private）

---

## ⚠️ 明日の朝イチで必ず確認（最優先）

### 1. DriveStorageProvider.ts 段階1 → ✅ commit/push 完了済み（解決）
- 今日の終わりに `git status` で確認したところ未コミットだった（たかしさんのcommit指示がセッション終了で届かず終わっていた）。
- **その場でPowerShellから直接 commit/push して解決済み**。commit `8378e83`（`feat: implement DriveStorageProvider stage 1 (Drive layout + settings load/save)`、1 file changed, 498 insertions / 39 deletions）。origin/main に反映済み。
- → 明日に持ち越す確認事項は無し。HEAD=`8378e83`。

### 2. 【教訓】複数エージェントの「メモリ書き込み交錯」に注意
- 就寝前、S/T/U（別セッション）が**同じ共有メモリ置き場に並行して書き込み**、お互いの記述を上書きしかけたり、古い情報が混ざりかけたりした（各自が気づいて最終的に整えたので実害なし）。
- ファイルはCLAUDE.md §1（自分の担当分のみadd）で守られたが、**メモリには同種のルールが弱く、交錯が起きた**。これは「画面がぶつかる問題」と同じ構造（複数が1つのものに同時書き込み）。
- 対策案（次回検討）: 各エージェントのメモリ書き込みを「自分の担当分のみ・時点を明記」と徹底する／メモリ更新は1エージェントずつにする等。

---

## 本日の成果（commit/push済み）

| # | 内容 | commit | 担当 |
|---|---|---|---|
| 1 | 朝の3連push（calendarスコープ例修正 / ポート統一 / OAuth調査docs） | d58ba56 / 9a4b7e5 / 0c339c0 | U / S / T |
| 2 | domain.ts 専用カレンダー型削除（calendarブロックは空で温存） | c1be68c | U |
| 3 | SecretStore（既存完成を確認、上書きせずレビューのみ） | 05ca945（既存） | U |
| 4 | **GoogleAuthProvider 本実装** | 32b71e4 | U |
| 5 | **DriveStorageProvider 段階1（土台部分）** | 8378e83 | U（commitはたかしさんが直接実行） |

---

## B2実装の進捗（次の棚卸し材料）

| ユニット | 状態 |
|---|---|
| IndexedDbSecretStore | ✅ 完成（05ca945） |
| GoogleAuthProvider | ✅ 完成（32b71e4・本日） |
| DriveStorageProvider | 🔶 **段階1完成**（段階2が残る） |
| VoicevoxTTSProvider | スケルトン（次の本実装候補） |
| WebSpeechTTSProvider | 未作成（案Z、ベータでは作らない方針） |

### GoogleAuthProvider（本日完成）の承認事項
- **handleAuthCallback 追加公開メソッド ＋ pendingStage localStorageキー**: 承認済み。リダイレクト型OAuthでは構造的に避けられない接合（フルページ遷移するので同一ページ内でAuthResultをresolveできない→callbackから完了させる）。contract本体は変更せずクラス固有メソッドに留めた点が正しい。
- **client_secret なしPKCE**: 申し送りでOK。Google Client種別との整合は実機検証（Sさん領域）で確認。
- 単体テスト: **未着手のまま**。Mock配置（tests/mocks vs tests/helpers）がTさん確認事項として未決のため、決定後に別途。
- スコープ食い違い: **無し**。設計書§2.12は5/25時点で既にcalendar.events、最新確定と整合済み。値はハードコードせずconfig注入。

### DriveStorageProvider 段階1（本日完成）の承認事項
- **段階1スコープ**: initialize / ensureLayout（フォルダ階層のみ）/ dispose / loadSettings（キャッシュ無）/ saveSettings（LWW無）＋内部ヘルパー（driveApi等）。
- **ensureLayoutはフォルダのみ**（中身ファイルのseedingはbundled対応とセットで段階2）。settings.jsonはsaveSettings初回で遅延作成。承認済み。
- **README.md は作らない**（Q-U-c-1のたかしさん判断保留を尊重）。承認済み。
- 迷った点（承認済み）: fileIdMapはin-memoryのみ（永続化は段階2）/ etagにDriveのversion採用（v3はETag標準で返さないため）/ multipart boundaryは固定文字列。

---

## 残課題（PENDING）

| 課題 | 内容 | 優先度 |
|---|---|---|
| **DriveStorageProvider 段階2** | IndexedDbCache / PendingQueue / ConflictResolver（src/implementations/internal/、未作成）/ LWW競合検知（If-Match/412/handleConflict）/ bundledアセットfallback / watch系 / 残り19メソッド（キャラ・プロファイル・マニュアル・履歴のload/save）。**次回じっくり** | 高 |
| VoicevoxTTSProvider 本実装 | 案Z確定（synthesize + synthesizeAndPlay二段、capabilities宣言）。WebSpeechは未実装方針 | 中 |
| 仕様書v1.5改訂（エルトン宿題） | §7.3「専用カレンダー自動作成」→「メインカレンダー集約」へ書換（domain.ts型削除とペア）。他Q-T-1〜4反映、OAuth justification本起草、ホームページコンテンツ仕様書。**6/20 OAuth申請がクリティカルパス** | 高 |
| contract v0.2の6件修正（C1〜C6） | Sさん領域 | 中 |
| 単体テストのMock配置 | tests/mocks vs tests/helpers、Tさん確認事項。決定後にテスト着手 | 中 |

### 段階2着手前の依存論点（Uさん棚卸し・すべて解決済み）
- Q-U-j-6（getGrantedScopes追加済）/ Q-U-j-7（source:'bundled'追加済）/ Q-U-j-8（internal/切出し確定）/ Q-U-j-9（キャッシュTTL階層化確定: settings/index/profile=60秒、manual/characters=1時間、errors/conversations=キャッシュなし）。スケルトンのヘッダーに反映済み。
- StorageDeps（auth/secretStore/clock/logger）定義済み。Clock抽象使用可。

---

## 運用メモ
- **CCは追加可能**（MIYU引き継ぎ帳参照）。Uさんは「設計・実装担当」として安定して質が高い。実装前の現状確認（スケルトンの状態・依存部品の有無）を必ず挟ませると空振りを防げる（GoogleAuth・DriveStorage両方でこれが有効だった）。
- **指示文の鉄則**: ①設計の原典（実装設計v0.1の該当§）を参照させ、エルトンが再定義しない ②実装前に現状確認を報告させる ③スコープ外を明示 ④commitせず報告まで。
- **PC間画面ぶつかり問題**: MIYU引き継ぎ帳参照（書き込みは1画面ずつ）。
