# Google Tasks / Calendar API 実機検証 — 受け入れ基準 v0.2

**起草日**: 2026-05-26(月)
**起草者**: Tさん(品質管理)
**位置づけ**: Sさん 検証スクリプト(`scripts/verify-tasks-api/`、 commit `73677a8`、 design skeleton)に対する **受け入れ基準** 。 検証実行 → Tさん 結果文書化(memory/)→ 技術顧問確認 → B2 着手 GO の段取りで、 本書は **その品質ゲート** 。
**前提**: Sさん commit `73677a8` の検証スクリプト 4本(01-due / 02-deadline / 03-taskSeries / 04-notes) + 共通ライブラリ(auth / cleanup / notes-codec) + run-all。

## 改訂履歴

| 版 | 日付 | 主な変更 |
|---|---|---|
| v0.1 | 2026-05-25 | 起草 |
| v0.2 | 2026-05-26 | (1) 「公式ドキュメント予測」 → 「**公式確認済み(技術顧問 5/25)**」 に格上げ、 Sさん README §「✅ 確認済」 と整合化。 (2) §4.2 対策案「ハイブリッド (ID 連携) 方式への切替検討」 → 「**技術顧問へエスカレーション → 再設計**」 に差し替え(ハイブリッド方式は不採用確定)。 (3) §6 サマリ表のラベル「公式予測 vs 実機」 → 「**公式確認 vs 実機**」 に同期 |

---

## §0. 本書のスコープと境界

### 範囲内

- 検証スクリプトの **API 観点での合格判定基準**
- 検証実行後の **食い違い検出時の取り扱い** ルール
- 検証結果の **文書化テンプレート**(Tさん が memory/ に格納する形式)

### 範囲外

- ベータ実装(B2 StorageProvider / B2 OAuth)のテスト基準(別途 `tests/integration/` 等で担保)
- 5/23 指示書 §1.3 InvokeAide 仕様依存項目(2リスト自動作成・P 廃止整合性 等)— これらは検証スクリプトの観点ではなく **B2 実装後の本実装テスト** で担保(§5 で申し送り)

### スコープ判断の根拠

技術顧問 5/25 指示「コアとして必ず外せないのは API 事実3点 + notes 構造化記法の往復一致」 + 「#4 / #10 等の仕様§1.3 依存は仕様読解に委ねる」 を踏まえ、 **API 観点を本丸に集中** 、 仕様依存項目は B2 後テストとして申し送り(`memory/feedback_density_not_breadth.md`「本丸を厚く」 遵守)。

---

## §1. 受け入れ基準コア — API 事実 + notes 往復(全 9 項目)

### §1.1 検証01「due 時刻破棄」(Tasks API)— 2 項目

**スクリプト**: `01-verify-due-time-stripped.js`
**公式確認済み(技術顧問 5/25)**: `due` フィールドは日付情報のみ、 時刻部分は **破棄** される

| # | 項目 | 期待値 | 観測値の取得元 |
|---|---|---|---|
| C1.1.1 | `due` に時刻を含む datetime(例: `2026-06-15T07:30:00.000Z`)を書き込み → 読み出し時に時刻部分が **消失** する | `observation.time_component_preserved === false` | 検証01 observation |
| C1.1.2 | 日付部分は保持されている(`2026-06-15` 部分が一致) | `observation.date_component_correct === true` | 検証01 observation |

**両方が真** で C1.1 PASS。 `verdict` が `"PASS:"` で始まる。

### §1.2 検証02「deadline 不存在」(Tasks API)— 2 項目

**スクリプト**: `02-verify-deadline-not-supported.js`
**公式確認済み(技術顧問 5/25)**: Task resource に `deadline` フィールドは **存在しない**

| # | 項目 | 期待値 | 観測値の取得元 |
|---|---|---|---|
| C1.2.1 | `deadline` 指定で create がエラーになる **か**、 エラーにならず黙殺される — いずれかの挙動を確認 | エラー時: `observation.createFailed === true` ／ 黙殺時: `observation.deadline_present_in_response === false` | 検証02 observation |
| C1.2.2 | fetched レスポンスに `deadline` キーが含まれない(黙殺ルート時) | `observation.deadline_present_in_response === false`(create エラー時はこの項目を skip と扱う) | 検証02 observation |

**どちらかのルートで** PASS。 `verdict` が `"PASS:"` で始まる。

### §1.3 検証03「taskSeries 不存在」(Calendar API)— 2 項目

**スクリプト**: `03-verify-taskseries-not-in-calendar.js`
**公式確認済み(技術顧問 5/25)**: Event resource に `taskSeries` フィールドは **存在しない**(反復系は `recurrence` / `recurringEventId` が標準)

| # | 項目 | 期待値 | 観測値の取得元 |
|---|---|---|---|
| C1.3.1 | fetched event のキー列に `taskSeries` が **含まれない** | `observation.taskSeries_present === false` | 検証03 observation |
| C1.3.2 | 反復用の標準フィールド(`recurrence` / `recurringEventId` のいずれか)はキー列に **含まれ得る**(本検証では non-recurrent イベント作成のため、 これらが含まれなくても OK) | 情報のみ(observation 記録) | 検証03 observation |

**C1.3.1 が真** で C1.3 PASS。 `verdict` が `"PASS:"` で始まる。

### §1.4 検証04「notes 構造化記法 往復一致」(Tasks API、 採用方式の土台)— 3 項目 ★最重要

**スクリプト**: `04-verify-notes-structured-rw.js`
**採用された記法**: `[キー:値][キー:値]...\n自由記述`(`lib/notes-codec.js` で encode/decode)
**重要度**: ★ — この検証が FAIL すると **「notes 構造化記法方式」 そのものが破綻** 、 B2 StorageProvider 設計の根幹に影響

| # | 項目 | 期待値 | 観測値の取得元 |
|---|---|---|---|
| C1.4.1 | encode した文字列が API に保存 → 取得時に **byte-for-byte 一致** | `observation.notes_byte_for_byte_preserved === true` | 検証04 observation |
| C1.4.2 | decode で構造化部分(`structured`)が **完全一致** で取り出せる | `observation.structured_round_trip_match === true` | 検証04 observation |
| C1.4.3 | decode で自由記述部分(`freeText`)が **完全一致** で保持される | `observation.freeText_round_trip_match === true` | 検証04 observation |

**3つすべてが真** で C1.4 PASS。 `verdict` が `"PASS:"` で始まる。

---

## §2. 運用安全性 — 2 項目

### §2.1 cleanup 成功

| # | 項目 | 期待値 | 確認方法 |
|---|---|---|---|
| C2.1 | 各検証の delete 呼び出しが **成功** 、 検証用 Google アカウントに残置データなし | `withCleanup` の delete が例外を投げない(警告ログ出力なし) | 実行ログ確認 + 検証用アカウントへの目視確認(任意) |

### §2.2 残置時の手動 cleanup 可能性

| # | 項目 | 期待値 | 確認方法 |
|---|---|---|---|
| C2.2 | cleanup 失敗時、 タイトル冒頭の `[検証N]` プレフィックスで残置タスクを特定できる | 各 verify の `title: '[検証N] ...'` が確認できる | スクリプトのソース確認(レビュー時) |

---

## §3. 実行整合性 — 1 項目

| # | 項目 | 期待値 | 観測値の取得元 |
|---|---|---|---|
| C3 | `node scripts/verify-tasks-api/run-all.js` の exit code が **0**(全 PASS)、 1件でも FAIL/ERROR があれば **1** | プロセス終了コード | shell の `$?` / `$LASTEXITCODE` |

---

## §4. 食い違い検出時の取り扱い ★ 指示の核心

### §4.1 「食い違い」 の定義

「公式確認済みの事実(技術顧問 5/25)」 と「実機の挙動」 が **一致しない** 状態。 例:

- 公式: 「due の時刻は破棄」 → 実機: 「時刻が保持される」
- 公式: 「deadline フィールドは存在しない」 → 実機: 「deadline が保存・取得できる」
- 公式: 「taskSeries 不存在」 → 実機: 「taskSeries キーが応答に含まれる」
- 採用記法: 「notes は byte-for-byte 保存される」 → 実機: 「改行や空白が変換される」

### §4.2 食い違いの取り扱いルール

食い違い検出時は **以下をすべて満たす形で記録**(隠蔽せず):

1. **観測値の生データを残す** — Sさん 検証スクリプトの `observation` JSON 全文を結果文書に格納
2. **仮説を明示** — 「API 仕様変更?」「バージョン差?」「テストアカウント設定の特殊性?」「公式ドキュメント記述が古い?」 のうち候補を 1〜3 個提示
3. **影響範囲を評価** — 「notes 構造化記法方式」 への影響、 B2 StorageProvider 設計への影響、 5/26 スコープ議論への議題化要否
4. **対策案を提示** — **技術顧問へエスカレーション → 再設計**(ハイブリッド (ID 連携) 方式は不採用確定のため、 食い違い検出時は技術顧問判断で代替方式を再設計する) / バージョン差時: 「googleapis ライブラリのバージョン固定検討」 / 公式記述更新時: 「公式 issue tracker への報告検討」

### §4.3 「重要な発見」 としての扱い

食い違いは **失敗ではなく発見** 。 隠さず・遠慮せず・推測で埋めず記録すること(`memory/feedback_honest_missing_docs.md` の精神)。 5/26 スコープ議論で議題化される可能性があるため、 食い違い検出時は **「Sprint 2 議題化候補」 ラベル** を結果文書に明記。

---

## §5. 仕様§1.3 依存項目 — 検証スコープ外、 B2 後の本実装テストへ申し送り

技術顧問 5/25 指示「#4 / #10 等の仕様§1.3 依存は仕様読解に委ねる」 を踏まえ、 以下は **本受け入れ基準のスコープ外** とする(検証スクリプトの判定基準ではない)。 ただし、 B2 実装後の本実装テストとして担保が必要:

| # | 項目 | B2 後の担保場所 | 備考 |
|---|---|---|---|
| S1 | `Todo` / `買い物リスト` 2リスト 自動作成の **冪等性**(既存なら作らない、 なければ作る) | `tests/integration/storage.test.ts`(B2 StorageProvider テスト) | 5/23 指示書 §3.3 由来 |
| S2 | ToDo 側で **P ランク廃止** 整合性(コード / 仕様書 / テストに P が残っていないか) | `tests/unit/`(rank-validator テスト) + grep + ESLint カスタムルール候補 | 5/23 指示書 §1.2 / §3.4 由来 |
| S3 | 構造化記法 **バージョン管理**(将来の記法拡張への耐性) | B3 で記法拡張する時に再評価、 v0.1 では単一バージョン前提 | 検証04 で土台確認、 拡張時は別途 |
| S4 | notes 自由記述境界(構造化記法と自由記述の **誤判定なし**) | `tests/unit/notes-codec.test.ts`(B2 後) | 検証04 で正常系のみ、 異常系(壊れた `[` などを含む自由記述)は別途 |
| S5 | 構造化記法バリエーション(漢字キー / 半角全角 / 改行を含む値 など) | `tests/unit/notes-codec.test.ts`(B2 後) | 検証04 では正常な日本語キー + 半角値のみ |
| S6 | `due` の **タイムゾーン解釈** (UTC で書いた日付が JST でどう見えるか、 日付境界の挙動) | `tests/integration/storage.test.ts`(B2 後) | 検証01 では UTC 直叩きのみ |

→ 上記 S1〜S6 は本検証で「触れない」、 ただし B2 着手前の **Tさん テスト戦略 v0.3 改訂候補** として `memory/T_progress.md` に申し送り(改訂作業は 5/26 議論後)。

---

## §6. 検証結果文書化テンプレート(memory/ 配下用)

Sさん 検証実行後、 Tさん が `memory/Tech_validation_GoogleTasksAPI_<YYYY-MM-DD>.md` を起草する際の **構造テンプレート** :

```markdown
# Google Tasks/Calendar API 実機検証 結果記録(YYYY-MM-DD)

**実行日時**:
**実行者**: Sさん(Sonnet) / Tさん が結果文書化
**実行環境**:
  - Node.js バージョン:
  - googleapis パッケージバージョン:
  - 検証用 Google アカウント識別子(伏字 OK):
**スクリプト commit**:

---

## 1. サマリ

| 検証 | 結果 | 公式確認 vs 実機 |
|---|---|---|
| 01 due 時刻破棄 | ✅ PASS / ❌ FAIL / ⚠️ 食い違い | 一致 / 食い違い |
| 02 deadline 不存在 | … | … |
| 03 taskSeries 不存在 | … | … |
| 04 notes 往復一致 | … | … |
| cleanup | ✅ / ⚠️ | — |
| run-all exit code | 0 / 1 | — |

**総合判定**: 全 PASS で B2 着手 GO 推奨 / 食い違いあり → 5/26 議論議題化候補

---

## 2. 各検証の詳細

### 2.1 検証01 due 時刻破棄

- **観測値(observation)**: <Sさん スクリプトの JSON 全文>
- **verdict**: <スクリプト出力>
- **受け入れ基準照合**:
  - C1.1.1(時刻消失): ✅ / ❌
  - C1.1.2(日付保持): ✅ / ❌
- **食い違いの有無**: なし / あり(下記)
  - 仮説:
  - 影響範囲:
  - 対策案:

(検証02〜04 も同形式で)

---

## 3. 仕様§1.3 依存項目の B2 後申し送り

(§5 表をそのまま転記、 該当する場合は更新)

---

## 4. 重要発見・食い違いまとめ

(あれば全食い違いをここに集約、 なければ「食い違いなし」 と明記)

---

## 5. B2 着手 GO / NO-GO 判定

- 全 PASS + cleanup ✅: **GO 推奨**
- 食い違いあり: **5/26 議論議題化推奨、 仮 GO は技術顧問判断**

---

**起草: Tさん、 YYYY-MM-DD**
```

---

## §7. チェックリスト(Tさん が結果文書化時に使用)

実行後の Tさん 作業手順:

- [ ] Sさん から実行 JSON 全文 受領(`run-all.js` の標準出力全文 + exit code)
- [ ] `memory/Tech_validation_GoogleTasksAPI_<実行日>.md` を §6 テンプレートで起草
- [ ] 各検証の `observation` を **編集せずそのまま** 結果文書に格納
- [ ] §1 受け入れ基準(C1.1.1 〜 C1.4.3 + C2.1 / C2.2 / C3)を機械的に照合
- [ ] 食い違いがあれば §4.2 4項目(観測値・仮説・影響範囲・対策案)を埋める
- [ ] §5 仕様§1.3 依存項目を `memory/T_progress.md` 申し送り欄にリンク追加
- [ ] 総合判定(GO 推奨 / 議題化推奨)を §5 に明記
- [ ] commit + push、 完了報告を CLAUDE.md §7 フォーマットで技術顧問へ

---

## §8. 関連文書

- `scripts/verify-tasks-api/README.md` — Sさん 検証スクリプトの全体仕様
- `scripts/verify-tasks-api/01〜04-*.js` — 検証スクリプト本体(commit `73677a8`)
- `scripts/verify-tasks-api/lib/notes-codec.js` — encode/decode 参考実装
- `docs/InvokeAide週末作業指示書_2026-05-21.md`(廃止)→ 後継: ToDo/買い物リスト分離 指示書(5/23) §2 API 制約
- `memory/T_to_S.md` §5 で本書を索引(案L3)
- `memory/feedback_honest_missing_docs.md` — 食い違い検出時の隠蔽禁止精神
- `memory/feedback_density_not_breadth.md` — 本丸(API 観点)を厚く、 仕様§1.3 依存は B2 後へ

---

## §9. 改訂方針

- v0.1(2026-05-25): 起草
- v0.2(2026-05-26、 本書): 「公式ドキュメント予測」 → 「公式確認済み(技術顧問 5/25)」 格上げ + §4.2 対策案 ハイブリッド方式陳腐化 → 技術顧問エスカレーション へ差し替え
- v0.3 候補: Sさん 検証実行 + Tさん 結果文書化後、 食い違いに応じて受け入れ基準を更新
- v0.4 候補: B2 実装着手後、 §5 仕様§1.3 依存項目を本実装テスト基準に格上げ

---

**起草: Tさん、 2026-05-26**
