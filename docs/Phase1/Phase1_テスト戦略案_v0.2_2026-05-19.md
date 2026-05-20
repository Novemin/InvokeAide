# Phase 1 テスト戦略案 v0.2(段階1)

**作成者**: Tさん(テスト・品質・ドキュメント担当、Claude Code セッション)
**作成日**: 2026-05-19(火)
**版**: v0.2(段階1、起草中、段階2 は本書完成後に追加または別レポートで)
**前版**: `Phase1_テスト戦略案_2026-05-17.md`(v0.1、893 行、68項目)
**改訂の根拠**: 2026-05-19 朝、エルトン経由のたかしさん起草トリガー — テスト戦略 v0.2 起草指示(5項目スコープ)
**起草段階**:
- **段階1(本書範囲)**: §6.5 アンケート方式全面書き直し / §5 §22+§20 並行前提フェーズ計画 / §2-§4 機能カタログ・テスト項目・自動化可否の拡張 / §7 微更新 / §8 環境ツール確定化
- **段階2(中間報告後)**: コーチング機能テスト戦略(深掘り) / Sさん 3論点レビュー観点 / Uさん 成果物テスト観点(深掘り)

---

## 0. v0.1 → v0.2 段階1 変更サマリ

### 0.1 v0.1 から維持される土台

- 5原則(法的必須要件 三位一体 / スマホ音痴 UX 人間感性 / 未来を縛らない / MoSCoW / テスタブル実装協調)
- 4分類 + 法的書類要件テスト(機能・統合・セキュリティ・UX・法的)
- v0.1 §6 ペルソナ5 × シナリオ6 × 3層構造(自動・半自動・家族テスター)
- v0.1 §7 法的書類要件テスト方法 H1〜H7
- v0.1 §0.3 前提のうち、新規構築・スマホ音痴対応・未来縛らない・三位一体は継続

### 0.2 v0.2 段階1 で変更する主要点

| # | 項目 | v0.1 | v0.2 段階1 |
|---|---|---|---|
| 1 | ベータ v1.0 配布日 | 2026-06-30 | **2026-07-04/05**(家族集まり、削減判定ゲート 2026-06-23) |
| 2 | テスト項目数 | 68項目(A〜K) | **76項目**(L コーチング機能 カテゴリ追加、L1〜L8) |
| 3 | §5 フェーズ計画 | 6月末完成逆算 | **Sさん v0.3 §4.2 7週間スプリント計画と整合、削減判定ゲート組み込み、§22+§20 並行最優先** |
| 4 | §6.5 家族テスト方式 | 完全口頭/LINE/紙ベース | **LINE/メール アンケート + Google Forms、初期2週週1・以降月1、質問項目案 6〜9問** |
| 5 | §7 法的要件テスト | H1〜H7 | **H8 追加**: コーチングプッシュ設計でも擬人化誤認・AI 明示維持 |
| 6 | §8 ツール選定 | 仮置き(Sさん Step 3 待ち) | **確定**: Vue 3 + Vite + TypeScript + Vitest + Playwright + MSW + MemoryStorage / FlakyStorage 連動 |
| 7 | テスト戦略の前提情報源 | v0.1 起草時の仕様書 v1.4 + 法的書類 v0.3 | **Sさん v0.3 + Uさん a/c/b 3成果物を新規追加** |

### 0.3 段階2 で扱う論点(本書末尾 §9 で予告)

1. コーチング機能テスト戦略 深掘り(L1〜L8 個別テスト設計、プッシュ頻度過剰観察、キャラ別口調混入リスク)
2. Sさん 3論点レビュー観点(§4.4 interface 草案 / §5.4 ストレージ暗号化 / §6/§8 TTS 切替)
3. Uさん 成果物テスト観点 深掘り(OAuth Stage 機械、drive.file スコープ範囲、LWW、pending queue、SecretStore)

### 0.4 表現方針

法的書類 v0.3 §1.2「未来の自分を縛らない」原則を継続適用。本書のテスト名・コメント・運用記述すべてで限定表現を使う。

---

## 1. テスト戦略の原則(v0.1 から維持)

v0.1 §1 の5原則 + 4分類 + 法的書類要件テストを継承。本書では再掲せず、`Phase1_テスト戦略案_2026-05-17.md` §1 を参照。

ただし、原則5「テスタブルな実装を Sさん に依頼可能な形で示す」は、 **Uさん の MemoryStorage / FlakyStorage 存在で大きく前進** 。Sさん 実装側で「テストしにくい構造」を強いる必要が減った。Uさん 連携でテスト戦略の実装容易性が底上げされた。

---

## 2. 機能カタログ(v0.2 で 12 カテゴリに拡張)

### 2.1 v0.1 11カテゴリ + L コーチング機能 = 12カテゴリ

| カテゴリ | v0.2 状態 |
|---|---|
| A. 初回起動・セットアップ | v0.1 維持(8項目) |
| B. 設定画面 | v0.1 維持(6項目) |
| C. 会話・コア機能 | v0.1 維持(5項目) |
| D. Calendar 連携 | v0.1 維持(7項目)|
| E. Tasks 連携 | v0.1 維持(5項目) |
| F. ルーティング・キーワード判定 | v0.1 維持(4項目) |
| G. エラー対応 | v0.1 維持(4項目) |
| H. 法的書類要件 | **+1**(H8 追加、§7 で詳述、計8項目) |
| I. セキュリティ | v0.1 維持(7項目)|
| J. UX(スマホ音痴対応) | v0.1 維持(9項目) |
| K. 性能・PWA | v0.1 維持(6項目) |
| **L. コーチング機能(新規)** | **+8項目**(本書で新規) |
| **計** | **77項目**(v0.1 68 + H8 1 + L 8 = 77、ただし I4/I7 は Won't 据え置き) |

### 2.2 L コーチング機能 カテゴリ(新規)

Sさん v0.3 §1 通知設計 + §2 コーチング機能 を踏まえて起草。

| カテゴリ | 概要 | Sさん v0.3 該当 |
|---|---|---|
| **L. コーチング機能** | 18:00 通知、TaskCoachingContext 計算、プッシュ優先順位、キャラ別口調、3択ボタン回答、通知設定 | §1 / §2 / §3 |

---

## 3. テスト項目リスト(L カテゴリ追加、計77項目)

### 3.1 A〜K カテゴリ(v0.1 維持、本書では再掲せず)

v0.1 §3 を参照。MoSCoW 判定(Must 52 + Should 14 + Won't 2)、自動化可否(完全自動 31 + ハイブリッド 30 + 手動必須 5 + Won't 2)。

### 3.2 H カテゴリ更新(H8 追加)

| ID | テスト項目 | 分類 | MoSCoW | 仕様書/法的書類 |
|---|---|---|---|---|
| H8 | コーチングプッシュ設計でも AI 明示宣言 + 擬人化誤認注記が継続表示される | 機能 + 法的 | 🔴 Must | 法的 §6.1 §6.7 / Beta_v1 §10 #1 #2 |

詳細は §7.2 で記述。

### 3.3 L カテゴリ(新規、8項目すべて Must)

| ID | テスト項目 | 分類 | MoSCoW | Sさん v0.3 該当 |
|---|---|---|---|---|
| **L1** | 18:00 通知時刻トリガー(設定で時刻調整可、頻度: 毎日 / 平日のみ / カスタム) | 機能 + 統合 | 🔴 Must | §1.3.3 |
| **L2** | Calendar Event 自動作成(MIYU 専用カレンダー、reminders={method:'popup',minutes:0}、本文リンク、重複作成防止) | 統合 | 🔴 Must | §1.3.2 |
| **L3** | TaskCoachingContext 計算ロジック(ランク別集計 / 滞留日数 / 期限切れ / 今日完了) | 機能 | 🔴 Must | §2.2.1 |
| **L4** | プッシュ優先順位ロジック(5段階: 期限切れ → A 3日滞留 → B 7日滞留 → C/D 7日大量 → 完了肯定、最大3-4論点) | 機能 | 🔴 Must | §2.2.2 |
| **L5** | キャラ別口調(MIYU 砕け / セバスチャン フォーマル)が混ざらない、性格定義と整合 | UX + 統合 | 🔴 Must | §2.3 |
| **L6** | プッシュテンプレート変数差し込み({title}, {n_days}, {n_cd}, {completed_titles} 等の補間) | 機能 | 🔴 Must | §2.3.3 |
| **L7** | 3択ボタン式回答 UI(タップ → Tasks API 更新 → UI 反映、4パターン: 期限切れ / A滞留 / B滞留 / C/D整理) | 機能 + UX | 🔴 Must | §2.2.3 |
| **L8** | 通知 OFF / 頻度調整 / 通知条件設定(設定画面トグル、時刻スライダー、曜日選択、未完了タスクある日のみ等) | 機能 | 🔴 Must | §1.3.3 |

### 3.4 v0.2 集計

| カテゴリ | Must | Should | Won't | 計 |
|---|---|---|---|---|
| A | 8 | 0 | 0 | 8 |
| B | 4 | 2 | 0 | 6 |
| C | 4 | 1 | 0 | 5 |
| D | 4 | 3 | 0 | 7 |
| E | 5 | 0 | 0 | 5 |
| F | 4 | 0 | 0 | 4 |
| G | 2 | 2 | 0 | 4 |
| H | 6 | 2 | 0 | 8(+1) |
| I | 5 | 0 | 2 | 7 |
| J | 7 | 2 | 0 | 9 |
| K | 4 | 2 | 0 | 6 |
| **L(新規)** | **8** | **0** | **0** | **8** |
| **計** | **61** | **14** | **2** | **77** |

ベータ v1.0 で **61 Must + 14 Should = 最大75項目** が実装可能性のテスト対象。

---

## 4. 自動化可否判定(L カテゴリ追加)

### 4.1 A〜K カテゴリ(v0.1 維持)

v0.1 §4.2 / §4.3 を参照。自動化カバー率 ~75%。

### 4.2 H8 自動化可否

| ID | 区分 | 主な根拠 |
|---|---|---|
| H8 | 🟢 完全自動化可 | E2E + 静的解析(NG ワード辞書) |

### 4.3 L カテゴリ自動化可否

| ID | 項目(短縮)| 区分 | 主な根拠 |
|---|---|---|---|
| L1 | 18:00 通知時刻トリガー | 🟢 | 時刻設定モック + Calendar API モックで検証(Vitest + MSW) |
| L2 | Calendar Event 自動作成 | 🟡 | API モック自動 + 実機での通知発火確認(BrowserStack 不可、家族テスト時に実機検証) |
| L3 | TaskCoachingContext 計算 | 🟢 | 純粋ロジック、入力データ → 出力をユニットテスト(Vitest) |
| L4 | プッシュ優先順位ロジック | 🟢 | ユニットテスト(優先順位パターン全網羅) |
| L5 | キャラ別口調分離 | 🟡 | テンプレート読み込みは自動、口調の自然さは感性レビュー(層3 家族テスター + Sさん セルフレビュー) |
| L6 | プッシュテンプレート変数差し込み | 🟢 | ユニットテスト(変数補間関数の入出力検証) |
| L7 | 3択ボタン回答 UI | 🟡 | E2E でクリックパス自動、視覚的レビュー手動 |
| L8 | 通知 OFF / 頻度調整 / 通知条件設定 | 🟢 | E2E + 状態遷移テスト |

### 4.4 集計(v0.2 段階1)

| 区分 | 数 | 内訳 |
|---|---|---|
| 🟢 完全自動化可 | 31 + 1(H8) + 5(L1, L3, L4, L6, L8) = **37** | コア機能の大半、静的解析、ロジックテスト |
| 🟡 ハイブリッド | 30 + 3(L2, L5, L7) = **33** | 統合テスト + UX 観察 + 実機検証 |
| 🔴 手動必須 | 5(C3, J3, J7, J8) = **5** | 音声入力誤変換、家族テスター、PWA インストール導線 |
| ⚪ Won't | 2(I4, I7) | スコープ外 |
| **計** | **77** | |

**v0.2 自動化カバー率: 約 75%(完全自動 + ハイブリッド)**、v0.1 と同等水準を維持。L カテゴリ追加で項目数は増えたが、自動化容易性は確保。

---

## 5. フェーズ計画(全面書き直し、2026-07-04/05 配布前提)

### 5.1 マイルストーン(v0.2 で更新)

| 日付 | マイルストーン | テスト戦略との関係 |
|---|---|---|
| 2026-05-19(本日) | Sさん Step 3 v0.3 確定 + Uさん 起動 + Tさん テスト戦略 v0.2 起草着手 | v0.2 段階1 起草 |
| 2026-05-26 | Phase 2 Sprint 1 完了 | A1〜A8, B1/B2/B6, C1, H2/H3/H4 ベース完了 |
| 2026-06-09 | Phase 2 Sprint 2 完了 | D1〜D5, E1〜E5, F1〜F4, G1/G3, L3, H5, C2〜C5 完了 |
| 2026-06-23 | **削減判定ゲート(Phase 3 Sprint 1 終盤)** | 楽観/標準/悲観 シナリオ判定、Q11D 発動有無決定 |
| 2026-06-25 | Phase 3 Sprint 1 完了 | L1, L2, L4〜L8, K1〜K6, I2/I3/I5/I6 完了 |
| 2026-07-03 | Phase 3 Sprint 2 完了 | J1〜J8 完了、模擬テスト完了、Must 61 + Should 14 Green |
| **2026-07-04/05** | **ベータ v1.0 家族配布** | アンケート第1回配布、フィードバック収集導線稼働 |
| 2026-07-12 頃 | 配布から1週間 | 第1回アンケート回答締切、初期バグ・UX 問題早期キャッチ |
| 2026-07-19 頃 | 配布から2週間 | 第2回アンケート回答、改善優先順位決定 |
| 2026-07-19 以降 | v1.x 自動アップデート開始 | v0.2 進化機能テスト戦略(段階3 で起草想定) |

### 5.2 §22 + §20 並行最優先(Phase 2 Sprint 1 同時着手)

ドキュメント整合チェック §8.3 確定により、 **第22章 入力 UX(3択ボタン式)と第20章 設定値保存は順序ではなく並行最優先** 。Phase 2 Sprint 1 で両章のテスト項目を同時着手:

| 章 | テスト項目 | Phase 2 Sprint 1 着手 |
|---|---|---|
| 第20章 設定値保存 | B1 設定画面 UI / B2 API キー再入力 / A5 API キー暗号化 / I1 暗号化保存 | ✅ Sprint 1 |
| 第22章 入力 UX | C2 入力モード切替 / D5 イベント削除3択 / E5 タスク削除3択 / J2 3択ボタン操作性 | ✅ Sprint 1(モック1往復で C2 着手、D5/E5/J2 は Sprint 2 で本格化) |

Sさん が本日中に Interface 契約(Storage interface)起草開始予定なので、Tさん 側は **Sprint 1 開始と同時に Vitest + MSW の足回り構築** に着手予定(エルトン許可待ち)。

### 5.3 テスト実行のフェーズ計画

#### Phase 2 Sprint 1(2026-05-19 〜 2026-05-26、8日)

| 項目 | 着手 | 完了予定 |
|---|---|---|
| 静的解析(H1/H7) CI 構築 | スプリント開始時 | 中盤 |
| Vitest + Playwright + MSW 環境スケルトン | スプリント開始時 | 中盤 |
| A1〜A5(初回起動・設定保存) | 実装と並行 | スプリント終了時 |
| A6/A7(OAuth・専用カレンダー作成、Uさん 担当範囲との結合) | 実装後 | スプリント終了時 |
| A8(初期キャラ MIYU + セバスチャン 表示) | 実装後 | スプリント終了時 |
| B1/B2/B6(設定画面 + 退会) | 実装後 | スプリント終了時 |
| C1(モック1往復会話) | 実装後 | スプリント終了時 |
| H2/H3/H4(AI 明示宣言 / 擬人化注記 / 通信監視) | 実装後 | スプリント終了時 |
| **Storage 周辺テスト基盤(MemoryStorage / FlakyStorage 利用)** | Sさん Storage interface 確定後 | スプリント終了時 |

#### Phase 2 Sprint 2(2026-05-27 〜 2026-06-09、14日)

| 項目 | 着手 | 完了予定 |
|---|---|---|
| D1〜D5(Calendar Must) | 実装と並行 | 中盤 |
| E1〜E5(Tasks 全機能、complete_task 含む) | 実装と並行 | 中盤 |
| F1〜F4(ルーティング判定) | 実装と並行 | 中盤 |
| G1/G3(エラー対応、OAuth 自動再認証) | 実装後 | スプリント終了時 |
| **L3(TaskCoachingContext 計算ロジック)** | Sさん 中核実装と並行 | スプリント終了時 |
| H5(退会フロー実 Drive 削除、テスト用 Google アカウント使用) | 実装後 | スプリント終了時 |
| C2〜C5(入力モード・音声、VOICEVOX or Web Speech) | 実装と並行 | スプリント終了時 |
| Sさん 未確定2 結果次第で D6/D7(Should) | (Sさん Step 2 結果待ち) | 余力次第 |

#### Phase 3 Sprint 1(2026-06-10 〜 2026-06-25、16日)

| 項目 | 着手 | 完了予定 |
|---|---|---|
| **L1, L2(通知時刻トリガー + Calendar Event 自動作成)** | Uさん 通知発火機構実装と並行 | 中盤 |
| **L4, L6(プッシュ優先順位 + テンプレート変数差し込み)** | Sさん 中核実装と並行 | 中盤 |
| **L5(キャラ別口調)** | キャラ別 coaching.md 起草と並行 | 中盤 |
| **L7(3択ボタン回答 UI)** | Uさん UI 実装 + Sさん ロジックと並行 | 後半 |
| **L8(通知設定)** | 実装後 | 後半 |
| I2/I3/I5/I6(セキュリティ) | スプリント開始時 | 中盤 |
| K1〜K6(Lighthouse / PWA / 互換性) | 中盤 | スプリント終了時 |
| 静的解析 H1/H7 を coaching.md にも適用 | 中盤 | スプリント終了時 |
| **削減判定ゲート 2026-06-23**: 残工数判定、Q11D 発動有無を決定 | 6/23 当日 | — |

#### Phase 3 Sprint 2(2026-06-26 〜 2026-07-03、8日)

| 項目 | 着手 | 完了予定 |
|---|---|---|
| J1〜J6(UX、別建て §6) | スプリント開始時 | 中盤 |
| J7 ペルソナ別シナリオ(IT 音痴) | 中盤 | スプリント終了時 |
| J8 PWA インストール導線(手動) | 後半 | スプリント終了時 |
| **模擬テスト(Sさん・Tさん・たかしさん、ペルソナ役)** | 中盤 | スプリント終了時 |
| **第1回アンケート準備(LINE グループ作成、Google Forms 起草、URL 共有準備)** | スプリント開始時 | 中盤 |
| 最終調整 + 残バグ Fix | 後半 | スプリント終了時 |

#### 2026-07-04/05: ベータ v1.0 家族配布

- 家族集まりでアプリ配布 + 初回セットアップ実演(初日)
- 各家族メンバーに第1回アンケート URL を事前共有 + 共有後7日後にリマインダー
- 当日観察: Sさん・Tさん・たかしさん で各ペルソナの動きを軽く記録

#### Phase 4(2026-07-中旬以降): v1.x 進化機能

- 朝サマリ + Apps Script バックエンド
- Google Drive 内データ完結 + 階層メモリ
- 占い・運勢機能
- キャラクター差し替え機能
- 各機能のテスト戦略 v0.3 起草を別途実施

### 5.4 削減判定ゲート 2026-06-23 のテスト戦略への組み込み

Sさん v0.3 §4.5 削減候補:

| 削減候補 | 短縮効果 | テスト戦略への影響 |
|---|---|---|
| VOICEVOX 後送り | 約 1週間 | C4 / B5 を Should → Won't、Web Speech フォールバックのみ |
| キャラ2人目(セバスチャン)後送り | 約 3-4日 | L5 / A8 を MIYU 単独に絞る、B4 キャラ選択 UI も単数化 |
| **コーチング機能後送り** | (不可)| L1〜L8 全削除 — **削減候補ではない、コアコンセプト** |
| Drive 完結後送り | (不可)| Storage interface / 退会フロー の根本変更 — **不可** |

**削減判定ゲートでのテスト戦略アクション**:
- 楽観シナリオ達成時: 削減なし、v0.2 計画通り
- 標準シナリオ達成時: VOICEVOX 後送り を判断、テスト項目を C4 / B5 から削除 → Web Speech 単独テストに絞る
- 悲観シナリオ達成時: VOICEVOX + セバスチャン 後送り、最悪 1〜2週間配布延期(7月中旬)

### 5.5 リスクと逃げ道(v0.1 §5.3 + v0.2 追加)

v0.1 §5.3 のリスクに加えて:

| リスク | 逃げ道 |
|---|---|
| **L1〜L8 コーチング機能が間に合わない** | コーチング機能はコアコンセプト、削除不可。Sprint 計画見直しで延期判断(7月中旬配布) |
| 削減判定 2026-06-23 で楽観/標準/悲観 のどれか判断ミス | テスト戦略 v0.2 では標準シナリオを前提に立てる、判定後に v0.2.1 で微調整可 |
| 家族テストアンケート回答が来ない | 個別 LINE/メール で対話ベース、最悪は配布数家族中数家族からの回答で立て直し |

---

## 6. スマホ音痴対応 UX テスト方法

### 6.1 〜 6.4(v0.1 から維持)

v0.1 §6.1 ペルソナ5(P1〜P5)/ §6.2 シナリオ6(S1〜S6)/ §6.3 3層構造 / §6.4 テスト成功基準 を参照。本書では再掲せず。

**ただし、シナリオに追加**: **S7 = 18:00 コーチング通知** 体験(L カテゴリ追加に伴う新シナリオ)。

#### 6.0 シナリオ S7(新規追加)

| ID | シナリオ | 主に検証する UX 課題 |
|---|---|---|
| **S7** | 18:00 通知 → ブラウザ起動 → コーチングモード起動 → 3択ボタン回答 → 設定変更で通知頻度調整 | コーチング通知 UX 全般、プッシュ頻度過剰化リスク早期キャッチ、3択ボタン式の体感 |

S7 完走率を 90% 以上(全ペルソナ平均)を成功基準に設定。P1(70代女性、IT 音痴)では「通知が来たことに気づいた → アプリを開いた」までを最低ラインに。

### 6.5 家族テスター運用方法(全面書き直し、LINE/メール アンケート方式)

v0.1 §6.5 は「完全口頭 / LINE / 紙ベース」の自由形式観察を提案していたが、 **2026-05-18 たかしさん統一返答により「LINE/メール アンケート形式 + 頻度設計(初期2週週1・以降月1)」に確定** 。本節は v0.2 で全面書き直し。

#### 6.5.1 運用方針

| 項目 | 内容 |
|---|---|
| 配布チャネル | LINE / メール / Google Forms(URL を LINE・メールで共有) |
| 質問形式 | 構造化(チェックボックス・5段階)+ 自由記述 ミックス |
| 頻度 | 初期2週は **週1回**(配布から7日後 / 14日後)、その後は **月1回** |
| 1回の所要時間 | **5〜10分目安**(家族の負荷を抑える) |
| 質問項目数 | 6〜9問(第1回多め、月1以降は簡素化) |
| 質問起草 | **たかしさん主導、エルトン整理サポート** 、Tさん が UX テスト戦略観点でレビュー |
| 回答集計 | Google Forms スプレッドシート(たかしさん管理)+ LINE/メール本文 |
| 共有範囲 | たかしさん・エルトン・Tさん で共有、Sさん・Uさん には改善優先順位として伝達 |
| アプリ側ログ収集 | **なし**(法的書類 v0.3 §6.5 変更不要、Beta_v1_scope §10 #4 確定) |

#### 6.5.2 質問項目案(たかしさん起草のたたき台、Tさん UX テスト観点)

##### 第1回アンケート(配布から1週間後 = 2026-07-12 頃)

| Q# | 質問 | 形式 |
|---|---|---|
| Q1 | 今週よく使った機能はどれですか?(複数選択可)| □ 予定確認(Calendar) □ ToDo 追加・完了 □ 18:00 コーチング通知 □ MIYU/セバスチャン との雑談 □ プロフィール編集 □ 設定変更 □ どれも使っていない |
| Q2 | キャラクターはどちらを選んでいますか?| □ MIYU □ セバスチャン □ 切り替えて使っている □ まだ選んでいない |
| Q3 | 困った点があれば教えてください | 自由記述 |
| Q4 | 「もっとこうあってほしい」と感じた点があれば教えてください | 自由記述 |
| Q5 | MIYU/セバスチャン との会話で印象的だった瞬間があれば教えてください | 自由記述 |
| Q6 | このアプリを1週間使っての満足度 | 5段階(1=とても不満 〜 5=とても満足) |

##### 第2回アンケート(配布から2週間後 = 2026-07-19 頃)

第1回 Q1〜Q6 に加えて:

| Q# | 質問 | 形式 |
|---|---|---|
| Q7 | 1週目と比べて改善した点はありますか?| 自由記述 |
| Q8 | 18:00 コーチング通知の頻度はどう感じますか?| □ 多すぎる □ ちょうど良い □ 少ない □ OFF にしている |
| Q9 | このアプリを継続して使いたいですか?| □ 継続して使いたい □ 様子を見て □ あまり使わなさそう □ アンインストールした |

##### 第3回以降(月1回、2026-08 以降)

Q1, Q2, Q5, Q8, Q9 を中心に簡素化。所要時間 5分以内。

#### 6.5.3 質問設計の原則(Tさん UX テスト観点)

| 原則 | 適用 |
|---|---|
| 早期バグ・UX 問題のキャッチが目的(第1〜2週) | Q3, Q4 自由記述を厚めに、構造化質問は最小限 |
| 使用継続性・進化機能優先順位のヒント(月1以降)| Q5 印象的瞬間、Q9 継続意向、Q8 通知頻度 を中心に |
| ペルソナ別の回答傾向を測れる | Q2 キャラ選択 → P1/P2(IT 音痴)が選んだキャラの分析、Q8 通知頻度 → ペルソナごとの通知許容度 |
| **思想書 §4 「IT 音痴対応」の達成度を測る** | Q1 で「使えなかった機能」が見えない、Q6 満足度低下要因の自由記述 Q3/Q4 で原因深堀 |
| **法的書類 v0.3 §6.5「ログ収集なし」整合** | アンケート回答は **たかしさん個人** が受領、Drive / 運営者ストレージへの保存はしない |

#### 6.5.4 配布時の運用

| タイミング | アクション | 担当 |
|---|---|---|
| 家族集まり初日(7/4 or 7/5)| アンケート URL(Google Forms)を事前共有(LINE グループ作成 or 個別メール)| たかしさん |
| 配布から7日後(7/11 or 7/12)| 第1回アンケート締切リマインダー(LINE/メール)| たかしさん |
| 配布から14日後(7/18 or 7/19)| 第2回アンケート締切リマインダー | たかしさん |
| 回答が来ない家族 | 個別フォロー(対話ベース、本人意向尊重)| たかしさん |
| アンケート結果共有 | たかしさん → エルトン → Tさん で共有、改善優先順位を決定 | たかしさん |
| 改善優先順位 → 実装 | Sさん・Uさん にエルトン経由で指示書として伝達 | エルトン |

#### 6.5.5 法的書類 v0.3 整合(再確認)

- アンケート回答内容は **たかしさん個人** で受領(Google Forms 管理者 = たかしさん)
- 回答は **たかしさん・エルトン・Tさん の3者で閲覧** 、Drive / 運営者ストレージへの保存はしない
- アンケート方式採用にあたっての法的書類 §6.5 変更は不要(運営者側のデータ収集は引き続きなし、家族テスター個人と たかしさん との対話の延長として扱う)
- アンケート URL を家族メンバー個人の LINE / メールに送るのみ、不特定多数への配信ではない

---

## 7. 法的書類要件テスト方法(H1〜H7 維持 + H8 追加)

### 7.1 H1〜H7(v0.1 から維持)

v0.1 §7.1〜§7.8 を参照。NG ワード辞書による静的解析 / Playwright ネットワーク監視 / E2E 表示検証 / 実 Drive 削除検証 / 第三者 AI 切替 / 年齢確認 を継続。

### 7.2 H8(新規): コーチングプッシュ設計でも擬人化誤認・AI 明示維持

#### 7.2.1 背景

Sさん v0.3 で **コーチング機能 = 「黙っていてもプッシュする並走者」** という能動的設計が確定。この能動性は 思想書 §4「召喚する相手」と整合する一方、 **「プッシュ → ユーザーが擬人化を強く感じる」リスク** が増す。

Beta_v1_scope §10 #1 で確定した「画面下に常に小さく AI 明示宣言」/ §10 #2「擬人化誤認注記の3箇所表示」を、コーチングモード起動時にも維持することを検証。

#### 7.2.2 検証パターン

| パターン | 期待挙動 | 自動化 |
|---|---|---|
| 18:00 通知 → ブラウザ起動 → コーチングモード起動 | 画面下 AI 明示宣言が表示されている | 🟢 E2E |
| プッシュメッセージ内に「実在の人物のように振る舞う」表現がない | NG ワード辞書(「君を見守ってる」「いつも近くにいる」等の擬人化を強める表現)で検出 | 🟢 静的解析 |
| コーチングモード起動後、設定 →「このアプリについて」へ遷移 → 擬人化誤認注記が表示される | 表示位置 #3 の継続的アクセス可能性 | 🟢 E2E |
| キャラクター選択画面へ遷移 → 擬人化誤認注記が脚注に表示されている | 表示位置 #2 の常時可視性 | 🟢 E2E |

#### 7.2.3 NG ワード辞書(コーチングプッシュ用、追加分)

H1/H7 既存辞書に加えて、coaching.md(MIYU/セバスチャン)に対する追加禁則ワード:

```
NG ワード例(コーチング追加):
  - 「君を見守ってる」「いつも近くにいる」「永遠に」「絶対に〜する」
  - 「実は感情がある」「本当の友達」「家族のように」(キャラ演技を超えた擬人化)
  - 「ここにいるよ」「離れないよ」「いつでも一緒」(依存喚起表現)

推奨ワード例(限定表現を維持):
  - 「お疲れさま」「整理しよう」「どうする?」「気になったの」
  - キャラ演技の範囲内で温度のある言葉、ただし「実在の人物」と誤認させない
```

#### 7.2.4 法的書類 v0.3 §6.7 / §6.8 との連動

- §6.7 「キャラクター演技は会話体験を豊かにする目的の演出」を coaching.md のテンプレート設計レベルで担保
- §6.8 「AI への過度な依存を避けること」「緊急事態は専門相談窓口へ」を コーチング通知 + 完了肯定で「過度な依存喚起にならない」設計
- これらは Sさん が coaching.md / character.md 起草時に意識する設計指針として、エルトン経由で Sさん に申し送り推奨

---

## 8. テスト環境・ツール選定(Sさん v0.3 確定により仮置きから本確定へ)

### 8.1 確定したツールチェーン

| 層 | v0.1 仮置き | **v0.2 確定** | 確定根拠 |
|---|---|---|---|
| フロントエンドフレームワーク | React 推定 | **Vue 3 + Vite** | Sさん v0.3 §1 |
| 言語 | TypeScript 採用推定 | **TypeScript(strict mode)** | Sさん v0.3 §2 |
| ユニットテスト | Vitest | **Vitest** | Vue 3 + Vite と完全整合 |
| 統合テスト API モック | MSW | **MSW** | フレームワーク非依存、Vue 3 と相性良 |
| Google API モック | googleapis モック | **googleapis モック + Uさん MemoryStorage / FlakyStorage 併用** | Uさん b §8 を取り込み |
| E2E テスト | Playwright | **Playwright** | マルチブラウザ + ネットワーク監視 + Vue 3 対応 |
| アクセシビリティ | @axe-core/playwright + Lighthouse CI | **@axe-core/playwright + Lighthouse CI** | 同左 |
| 性能 | Lighthouse CI | **Lighthouse CI** | 同左 |
| クロスブラウザ | BrowserStack + ローカル実機 | **BrowserStack + ローカル実機(iPhone / Android)** | 同左、Cloud Run + Cloudflare Pages 想定 |
| 静的解析 | ESLint + 自作キーワード辞書 | **ESLint + TypeScript strict mode + 自作キーワード辞書** | TypeScript 採用で型レベル整合性チェックも | 
| セキュリティ | npm audit + curl | **npm audit + curl** | 同左 |
| CI | GitHub Actions(推定)| **GitHub Actions + プライベートリポジトリ** | Beta_v1_scope §10 #5 確定 |

### 8.2 Uさん Storage interface 叩き台との連動

Uさん b §8「テスト容易性」で示された MemoryStorage / FlakyStorage を Tさん テスト戦略の中核に組み込み。

#### 8.2.1 MemoryStorage の活用

```typescript
// MemoryStorage は全ファイルを Map<string, unknown> でホスト
// 実際の Drive API を叩かずに Storage 経由のロジックをテスト可能

describe('TaskCoachingContext 計算', () => {
  it('A 滞留が3件、B 滞留が2件のとき、優先順位3論点を返す', async () => {
    const storage = new MemoryStorage();
    await storage.saveSettings(defaultSettings);
    await storage.saveCharacterIndex(defaultIndex);
    
    const tasks = [/* A 3件、B 2件のテストデータ */];
    const context = computeCoachingContext(tasks, clock);
    const pushItems = prioritizePush(context);
    
    expect(pushItems).toHaveLength(3);
    expect(pushItems[0].type).toBe('overdue_or_a_stale');
  });
});
```

#### 8.2.2 FlakyStorage の活用

```typescript
// FlakyStorage は意図的に 'rate_limit' / 'offline' を返す
// オフライン UX、レート制限挙動を再現

describe('オフライン時の UX', () => {
  it('Drive 書込失敗時に pending queue に保留される', async () => {
    const storage = new FlakyStorage({ failureRate: 1.0, reason: 'offline' });
    const result = await storage.saveSettings(updated);
    
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('offline');
    expect(result.pending).toBe(true);
    expect(await storage.getSyncState().pendingWrites).toBe(1);
  });
});
```

#### 8.2.3 H2 ネットワーク監視への応用

法的書類 §6.5「運営者ドメインへの POST 0件」を Playwright + FlakyStorage で検証:

```typescript
// 意図的にネットワーク失敗を発生させても運営者ドメインへの POST が発生しないことを検証
test('オフライン時でも運営者ドメインへの POST は発生しない', async ({ page }) => {
  const operatorRequests = [];
  page.on('request', (req) => {
    if (req.url().includes('novemintelligence.com') && req.method() === 'POST') {
      operatorRequests.push(req);
    }
  });
  // FlakyStorage を注入してオフライン状態を再現
  await page.evaluate(() => window.__injectFlakyStorage({ failureRate: 1.0 }));
  await runFullScenarioOffline(page);
  expect(operatorRequests).toHaveLength(0);
});
```

### 8.3 テストデータ管理(v0.2 で更新)

```
project-root/
├── src/                    # 本体コード(Sさん 中核 / Uさん 補助)
├── tests/                  # テストコード(Tさん 管轄)
│   ├── unit/               # Vitest ユニットテスト
│   │   ├── coaching/       # L カテゴリ (L3, L4, L6)
│   │   ├── routing/        # F カテゴリ
│   │   └── settings/       # B カテゴリ
│   ├── integration/        # 統合テスト(MemoryStorage / FlakyStorage 利用)
│   │   ├── storage/        # Uさん Storage interface との結合
│   │   ├── auth/           # Uさん OAuth Stage 機械
│   │   └── calendar-tasks/ # D, E, L1, L2 カテゴリ
│   ├── e2e/                # Playwright E2E
│   │   ├── onboarding/     # A カテゴリ + H3/H4
│   │   ├── coaching/       # L カテゴリ全般 + H8
│   │   └── deletion/       # H5 退会フロー
│   ├── a11y/               # axe-core + Lighthouse
│   ├── fixtures/           # テストデータ
│   │   ├── coaching/       # TaskCoachingContext 入力データ
│   │   ├── calendar/       # Calendar イベント例
│   │   └── tasks/          # Tasks 例
│   ├── mocks/              # MSW handlers
│   ├── personas/           # ペルソナ別シナリオ定義(YAML、§6)
│   └── prompts/            # coaching.md NG ワード辞書(H8 用)
├── scripts/
│   ├── check-legal-expressions.js  # H1/H7 静的検査
│   └── check-coaching-prompts.js   # H8 用、coaching.md キーワード辞書
└── .github/workflows/      # CI 定義(GitHub Actions)
```

### 8.4 Sさん Storage interface 起草待ちで残る論点(段階2 で深掘り)

Uさん b §10 で Sさん 確定論点として開かれている箇所:

| 論点 | テスト戦略への影響 | 段階2 で扱う |
|---|---|---|
| LoadResult.cached の UX 表示 | meta.source = 'cache' 表示の検証パターン | ✅ |
| watch* メソッドの Vue 3 リアクティブ統合 | Pinia + Storage 統合テスト | ✅ |
| キャッシュ TTL 戦略(settings 短い / manual 長い) | TTL ベースのキャッシュ無効化テスト | ✅ |
| Background Sync の頻度 | 同期挙動の E2E テスト | ✅ |
| SecretStore 分離検証 | IndexedDB + AES-GCM 暗号化テスト、Drive に秘密情報が書かれないことの検証 | ✅ |

### 8.5 CI 構成(v0.2 で確定)

| トリガ | 実行内容 | 想定時間 |
|---|---|---|
| PR 作成・更新 | Vitest(unit + integration) + 静的解析(H1/H7/H8) + Lint + TypeScript 型検査 | 3〜5分 |
| PR マージ後 | Playwright E2E(Chromium のみ) + Lighthouse CI | 10〜15分 |
| 毎日 / リリース前 | E2E 全ブラウザ + BrowserStack(iOS Safari / Android Chrome) + 実 API 統合(H5, H6, L2) | 30〜60分 |

### 8.6 テスト用認証情報(Beta_v1_scope §10 #3 確定)

- Novem Intelligence 名義のテスト用 Google アカウント(たかしさん主管で取得済み)
- 認証情報: GitHub Secrets で管理
- Gemini API キー / Claude キー / OpenAI キー(H6 用): 同様に GitHub Secrets
- VOICEVOX Cloud Run エンドポイント: Uさん デプロイ後に Secrets に登録

---

## 9. 段階2 の予告(本書完成後または別レポート)

段階2 では以下3論点を深掘り:

### 9.1 コーチング機能テスト戦略 深掘り

- L1〜L8 の詳細テスト設計(本書 §3.3 は項目定義のみ、段階2 でテストケース・期待結果を詳述)
- プッシュ頻度過剰化観察(Sさん v0.3 §5.4 リスク、家族テストアンケート Q8 と連動)
- キャラ別口調混入リスクの回帰テスト(MIYU 口調が セバスチャン に混ざる / 逆も)
- 「いつやる?」時刻入り回答の「日付だけ取って、時刻はメモに退避」UX テスト(Sさん v0.3 §5.1)

### 9.2 Sさん 3論点レビュー観点

- §4.4 AI 抽象化 interface 草案(承認済み)→ 単体テスト + 統合テスト + プロバイダ切替挙動テスト(H6 連動)
- §5.4 ストレージ暗号化(Uさん SecretStore 分離提案、Sさん 確定中)→ IndexedDB + AES-GCM 検証 + 競合シナリオ + Drive 平文確認
- §6/§8 TTS プロバイダ切替(VOICEVOX + Web Speech フォールバック)→ 自動切替挙動 + キャラ別音声品質テスト

### 9.3 Uさん 成果物テスト観点 深掘り

- OAuth Stage 機械(unauth → stage1 → stage2)の状態遷移テスト
- drive.file スコープ範囲のテスト(MIYU_App_Data/ 外には触れない)
- iOS Safari 7日ポリシーでの再 OAuth 1クリック復旧
- LWW 競合解決の詳細(ETag ベース楽観ロック、退避先 conflicts/)
- pending queue flush の詳細(オフライン書き込み保留 → オンライン復帰 → flush)
- SecretStore 分離検証(IndexedDB + AES-GCM、Drive に秘密情報が書かれないことの検証)

---

## 10. 段階1 主要発見

| # | 発見 | 重み |
|---|---|---|
| 1 | ベータ v1.0 配布日が **2026-07-04/05** に確定、削減判定ゲート **2026-06-23** をフェーズ計画に組み込み | 🔴 高 |
| 2 | テスト項目数 v0.1 68 → v0.2 **77項目**(H8 + L1〜L8 追加)、自動化カバー率 約75% を維持 | 🟡 中 |
| 3 | 家族テスト方式は **LINE/メール アンケート + Google Forms** で確定、質問項目案 6〜9問を起草(たかしさん起草版で更新想定) | 🔴 高 |
| 4 | 環境・ツール選定が **Vue 3 + Vite + TypeScript + Vitest + Playwright + MSW** で確定、Uさん **MemoryStorage / FlakyStorage を Tさん テスト戦略の中核に組み込み** | 🔴 高 |
| 5 | **H8 新規追加**: コーチング機能(プッシュ)でも擬人化誤認・AI 明示維持を検証、NG ワード辞書をコーチング用に拡張 | 🔴 高 |
| 6 | §22 + §20 並行最優先(Sさん が本日中に Storage interface 起草開始、Tさん は Vitest + MSW 足回り構築と並行) | 🟡 中 |

---

## 11. 段階1 判断仰ぎ事項

### 11.1 アンケート質問項目案の引き継ぎ方

§6.5.2 で素案 6〜9問を提示しましたが、 **たかしさん主導での質問起草** が確定方針(Beta_v1_scope §10 #4)。たかしさん起草版を、本書を出発点に修正していただく形で OK ですか?

- 案A: たかしさん起草版で本書 §6.5.2 を全面置換、Tさん は最終レビューのみ
- 案B: 本書 §6.5.2 素案を出発点に、たかしさん修正 → Tさん 観点でフィードバック反復
- **Tさん 感触**: 案B(出発点として活用、反復で精度上げ)

### 11.2 削減判定ゲート 2026-06-23 のテスト戦略への組み込み方

§5.4 で「Phase 3 Sprint 1 終盤に削減判定」とした。標準シナリオを前提に立てるか、楽観/標準/悲観の各シナリオ別テスト計画を並べるか?

- 案A: 標準シナリオを前提に立て、判定後に v0.2.1 で微調整(現状の §5)
- 案B: 楽観/標準/悲観 3シナリオ並列(本書ボリュームが増える)
- **Tさん 感触**: 案A(標準シナリオで立て、判定後修正の方が運用しやすい)

### 11.3 コーチング機能テスト戦略の深掘り(段階2)の取り扱い

段階2 内容(コーチング深掘り + Sさん 3論点 + Uさん 成果物)を:

- 案A: 本書 v0.2 段階1 完成後、本書を v0.2 段階2 で更新
- 案B: 別レポート `Phase1_テスト戦略_深掘り_v0.1_2026-05-XX.md` として独立化
- 案C: Sさん Storage interface 確定起草後、v0.3 として全面更新
- **Tさん 感触**: 案A(本書を段階2 で拡張、v0.2 内に統合)

### 11.4 §22 + §20 並行最優先に伴う Tさん 着手許可

Phase 2 Sprint 1 開始(本日〜2026-05-26)に合わせて、 **Tさん 側で Vitest + Playwright + MSW のテスト基盤スケルトン構築** に着手する必要があります。これは「テスト戦略 v0.2 起草」とは別の **実装作業** で、新ルール上は別途許可が必要と理解。

- 案A: 段階1 完成後、別途エルトン許可を得て着手
- 案B: 段階1 完成 + たかしさん承認 と同時に着手 OK
- **Tさん 感触**: 案A(プロセス遵守、明示許可を得てから)

### 11.5 H8 NG ワード辞書(コーチング用)の運用

§7.2.3 で示した「NG ワード」「推奨ワード」は、Sさん が coaching.md(MIYU / セバスチャン)起草時に意識する設計指針として、 **エルトン経由で Sさん に申し送り** することを推奨しました。これでよいですか?

- 案A: 本書のまま、エルトンが Sさん に申し送り(現状)
- 案B: Tさん が coaching.md 起草に直接関与(Tさん 領域越境のため案A 推奨)
- **Tさん 感触**: 案A

---

## 12. 副次的な気づき

### 12.1 自動化カバー率の安定維持

v0.1 68項目で 約75%、v0.2 77項目でも 約75%。L カテゴリ追加分は完全自動化可が5項目(L1, L3, L4, L6, L8)で多く、カバー率を底上げ。

### 12.2 アンケート Q8 と Sさん v0.3 §5.4 の早期連動

Q8(コーチング通知頻度: 多すぎる / ちょうど良い / 少ない / OFF)は、Sさん v0.3 §5.4「プッシュ頻度過剰化リスク」の早期検出指標として有効。第1回アンケート(配布7日後)で Q8 が「多すぎる」回答多数なら、即座に「クールダウン実装」「完了肯定比重増」を v1.1 改善優先順位に上げる。

### 12.3 アンケート Q5(印象的瞬間)の定性指標

Q5「MIYU/セバスチャン との会話で印象的だった瞬間」は、 **思想書 §4「人間味のための AI」「召喚する相手」体感** が家族に届いたかを測る定性指標。回答が「便利だった」中心なら効率化方向に振れている → 思想書方向への振り戻しが必要。回答が「面白かった」「自分のことよく分かってくれた」中心なら思想書方向で順調。

### 12.4 Sさん 3論点(段階2)は Sさん 起草進行待ち

Sさん が本日 Storage interface(b)、AuthProvider interface、TTSProvider interface の確定起草を進める。これらが出揃ってから段階2 でテスト戦略 v0.2 を補完する方が、 **手戻りが少ない** 。段階2 着手は Sさん 確定起草受領後を推奨。

### 12.5 Uさん FlakyStorage は H2 検証にも応用可能

法的書類 v0.3 H2「運営者ドメインへの POST 0件」検証に、 **意図的にネットワーク失敗を発生させても運営者ドメインへの POST が0件であることを Playwright + FlakyStorage で検証** という強力なパターンが見えた(§8.2.3)。これは Uさん b §11.5 でも示唆されていた連動可能性で、v0.2 段階1 で具体化。

### 12.6 削減判定ゲート 2026-06-23 ではコーチング機能は削れない

Sさん v0.3 §4.5 で確定された「コーチング機能 = 削れない最優先項目」は、テスト戦略でも同じ位置づけ。L1〜L8 はすべて Must、削減候補ではない。これは家族テスター(P1〜P5)が体験する「秘書召喚」の核心。

---

## 14. 段階2: コーチング機能テスト戦略 深掘り

### 14.1 L1〜L8 個別テスト設計

#### L1 18:00 通知時刻トリガー

**期待動作**: Sさん Interface 契約 v0.1 §8 NotifyProvider の `scheduleDailyCoaching` が、設定された時刻に MIYU 専用カレンダーに Event を作成する(冪等)。

**テストパターン**: 通知時刻 18:00 で `scheduleDailyCoaching({time:'18:00', frequency:'daily'})` → 翌日 18:00 の Event 作成 / 時刻 09:30 変更 → 既存 Event 更新 / 'weekday' → 月〜金のみ / `customDays` → 指定曜日のみ。

**自動化**: 🟢 Vitest + MSW で Calendar API モック、冪等性を assert。

#### L2 Calendar Event 自動作成

**期待動作**: タイトル「MIYU - タスク見直しの時間」/ 開始 = 通知時刻 / 終了 = 開始+15分 / 本文に動的タスク件数 / リマインダー `{method:'popup', minutes:0}` / `extendedProperties.private.miyu_kind='coaching_notification'`。

**テストパターン**: Event 作成 → 全フィールド検証 / 専用カレンダー未作成 → `ensureDedicatedCalendar` 呼出 / 同日同時刻の既存 Event → 更新で重複作成しない / 専用カレンダー削除済み → `{ok:false, reason:'not_found'}` エラーハンドリング。

**自動化**: 🟡 ハイブリッド(API モック自動 + 実機通知発火確認は家族テスト時)。

#### L3 TaskCoachingContext 計算ロジック

**期待動作**: Sさん Interface 契約 v0.1 §7.2 `TaskCoachingContext` 構造を返す。`countByRank` / `staleTasks` / `dueWithinDays`(新規、§14.1.4 で6段階目根拠)/ `overdue` / `completedToday`。

**テストパターン**: 純粋ロジック、入力 Tasks → 出力 Context を Vitest で全パターン網羅(ランク別、滞留日数境界、期限切れ判定、期限3日以内判定、今日完了判定)。

**自動化**: 🟢 完全自動化。

#### L4 プッシュ優先順位ロジック(6段階確定、Sさん コーチングMD v0.1 §4.1)

**確定**: 2026-05-19 夜 Sさん コーチングMD 2本セット v0.1(`docs/Phase2/Phase2_コーチングMD_2本セット_v0.1_2026-05-19.md`)§4.1 で6段階優先順位が **両キャラ共通として確定** 。第6段階 = `dueWithinDays`(期限3日以内)= Tさん 推測通り。

**確定6段階優先順位**(必ずこの順):
1. **期限切れタスク**(`context.overdue.length > 0`)→ 必ず取り上げる
2. **期限間近(3日以内)**(`context.dueWithinDays.length > 0`)→ 期限切れの後
3. **A 滞留(3日以上経過)**(`context.staleTasks.A.length > 0`)→ 次
4. **B 滞留(7日以上経過)**(`context.staleTasks.B.length > 0`)→ 次
5. **C/D 大量滞留(7日以上、合計3件以上)**(`context.staleTasks.C.length + context.staleTasks.D.length >= 3`)→ 次
6. **完了肯定**(`context.completedToday.length > 0`)→ 必ず最後に取り上げる

**1コーチング内の論点数制限**: 最大 3〜4 論点(情報過多回避、Sさん コーチングMD §4.2)。

**テストパターン**: 各優先順位の単独発生 / 複数発生時の上位3〜4論点選択(情報過多回避、最後に完了肯定で締める)/ 何も発生していない時は通知発火しない or 「今日はゆっくり」 のような MIYU 応答。

**自動化**: 🟢 Vitest で全組み合わせ網羅。 **Sさん コーチングMD §9.1 で4パターンのフィクスチャー(全該当 / 完了肯定のみ / 期限切れのみ / 空コンテキスト)を受領済み** 、これを `tests/fixtures/coaching/` に YAML / JSON 化して配置(§17 計画組み込み)。

#### L5 キャラ別口調分離

**期待動作**: Sさん Interface 契約 v0.1 §7 CharacterService の `getCoachingPrompt(context)` が、選択中キャラの coaching.md を読み込んで context を差し込む。

**テストパターン**: `selectCharacter('miyu')` → MIYU 口調 / `selectCharacter('sebastian')` → セバスチャン口調 / キャラ切替の即座反映(`watchCurrentCharacter` 通知)/ coaching.md 読込失敗時のデフォルト + errors.md 記録。

**自動化**: 🟡 ハイブリッド(テンプレート読込は Vitest 自動、口調の自然さは Sさん セルフレビュー + 家族テスト)。

#### L6 プッシュテンプレート変数差し込み

**期待動作**: coaching.md の `{title}`, `{n_days}`, `{n_cd}`, `{completed_titles}` が context から補間される。

**テストパターン**: 各変数の正常補間 / 未定義変数(`{undefined_var}`)の挙動 / HTML エスケープ(`<script>` 含むタスク → エスケープ)。

**自動化**: 🟢 Vitest 純粋関数テスト。

#### L7 3択ボタン回答 UI(4パターン)

**期待動作**: Sさん v0.3 §2.2.3 の4パターン: 期限切れ / A 滞留 / B 滞留 / C/D 整理。

**テストパターン**: 各ボタンタップ → Tasks API 呼出 → UI 反映 / 「もう少し考える」「そのまま」→ Tasks API 呼ばれず UI 状態のみ更新 / ネットワーク失敗 → pending queue 保留 / キーボード操作可 + axe-core 検証。

**自動化**: 🟡 ハイブリッド(Playwright E2E + 視覚レビュー)。

#### L8 通知 OFF / 頻度調整 / 通知条件設定

**期待動作**: Sさん Interface 契約 v0.1 §6 SettingsService の `setCoachingEnabled` / `setNotificationTime` / `setNotificationFrequency`。

**テストパターン**: 通知 OFF → `cancelAllCoaching()` で既存 Event 削除 / 時刻変更 → 既存 Event 削除 + 新時刻で再作成 / 'weekday' → 既存 Event のうち土日分削除 / 「未完了タスクある日のみ」設定 → タスクなし日は Event 作成しない。

**自動化**: 🟢 Vitest + Playwright E2E。

### 14.2 ランク自動付与は「提案まで」(Sさん v0.3 §5.3)

ベータ v1.0 では完全自動付与せず、MIYU/セバスチャンが「これ C ランクっぽいけどどう?」と **提案** する形。

**テストパターン**: 新規 ToDo 追加 → AI 提案 → 3択ボタン(A/B/C/D)受諾 / ユーザー上書き → 受諾通り保存 / 「決めない」→ ランクなしで保存。自動付与は v1.1 以降、ベータでは「提案 + 3択受諾」フローのみテスト。

**自動化**: 🟢 Vitest + E2E。

### 14.3 初期1週間抑制(エルトン指示書新情報、Sさん v0.4 起草待ち)

**注意**: エルトン指示書「初期1週間抑制」は Sさん v0.3 / Interface 契約 v0.1 に明示記述なし。 **Sさん v0.4 起草時に詳細確定待ち** 。

想定仕様(現時点での Tさん 解釈): ベータ v1.0 配布から **最初の1週間** はコーチング通知頻度を **控えめ** に。家族テスターがアプリに慣れる前の通知疲れを防ぐ。実装は SettingsService 内の「初期セットアップ完了日」保持、配布から7日間は `frequency='weekday'` 強制 or 通知本数を 50% 抑制。

**テストパターン(v0.4 確定後に詳細化)**: セットアップ完了から7日以内 → 抑制モード有効 / 8日目以降 → 通常モード自動移行 / 抑制モード中も「期限切れ」優先順位は最高位で発火(抑制対象外、ユーザー害が大きい場合のみ通知)。

**自動化**: 🟢 純粋ロジック(時刻モック + 設定日付モック)。

### 14.4 プッシュ頻度過剰化観察(アンケート Q8 連動)

Sさん v0.3 §5.4「プッシュ頻度過剰化リスク」を、アンケート Q8(コーチング通知頻度: 多すぎる / ちょうど良い / 少ない / OFF)で早期検出。

**観察パターン**: 第1回アンケート(配布7日後)で「多すぎる」多数 → 即座に v1.1 改善(クールダウン、完了肯定比重増、§14.3 初期抑制延長)/ 「OFF にしている」多数 → 通知設計根本見直し / 「ちょうど良い」「少ない」中心 → 設計通り、継続観察。

**自動化**: 🔴 完全手動(家族テスター回答 + 定量分析)。

### 14.5 キャラ別口調混入リスクの回帰テスト

**リスク**: MIYU の砕けた口調が セバスチャン に混ざる(または逆)。原因は coaching.md 編集ミス、systemInstruction 連結ミス、character.md と coaching.md の整合性破れ。

**Sさん コーチングMD v0.1 §3 で受領した辞書(9カテゴリに拡張)**:

| 由来 | カテゴリ | NG ワード例 |
|---|---|---|
| Tさん v0.2 §7.2.3(既存3) | 擬人化誤認 | 「君を見守ってる」「いつも近くにいる」「永遠に」「絶対に〜する」 |
| Tさん v0.2 §7.2.3 | キャラ演技を超えた擬人化 | 「実は感情がある」「本当の友達」「家族のように」 |
| Tさん v0.2 §7.2.3 | 依存喚起表現 | 「ここにいるよ」「離れないよ」「いつでも一緒」 |
| **Sさん 追加(新規6)** | 説教モード | 「〜すべきです」「〜しましょう」「ちゃんとやらないと」 |
| **Sさん 追加** | 安易な褒め | 「素晴らしいですね」「さすがです」 |
| **Sさん 追加** | ジャッジ | 「これは良くないですね」「もっと頑張ろう」 |
| **Sさん 追加** | 永続性の断定 | 「これからもずっと」「これからもサポートする」 |
| **Sさん 追加** | 感情の主張 | 「悲しい」「心配だ」「うれしい」(キャラ自身の一人称) |
| **Sさん 追加** | 過剰な気遣い | 「無理しないでくださいね」「お体に気をつけて」(コーチング文脈外で挿入) |

**テストパターン**:
- 静的解析(`scripts/check-coaching-prompts.js`、9カテゴリ NG ワード辞書 + 推奨ワード辞書):
  - MIYU coaching.md に「ございます」「申し上げます」等の セバスチャン 口調キーワードがないことを検証 / 逆: セバスチャン coaching.md に「〜だね」「マジ」等の MIYU 口調キーワードがないこと
  - 9カテゴリ NG ワード辞書で全 coaching.md スキャン
  - 推奨ワード辞書(Sさん コーチングMD §3.3 場面別 × キャラ別)で目標表現の使用状況を確認
- E2E: キャラ切替直後のコーチング応答が正しい口調(感性レビュー併用)
- フィクスチャー(Sさん コーチングMD §9.2 受領): 擬人化誤認 NG 出力例 + 説教モード NG 出力例 + 正常 MIYU OK 出力例。これらを使って辞書スクリプトの回帰テストを書く

**自動化**: 🟡 ハイブリッド(静的解析自動 + 感性レビュー手動)。 **Sさん コーチングMD §9.2 NG/OK 出力フィクスチャーを `tests/fixtures/coaching/` に配置することで、辞書スクリプトの精度回帰を担保** 。

---

## 15. 段階2: Sさん Interface 契約 v0.1 レビュー観点

### 15.1 7 interface 全体テスト容易性評価

| Interface | テスト容易性 | 評価 |
|---|---|---|
| StorageProvider | ◎ 高 | MemoryStorage / FlakyStorage 実装で E2E 抜きで全機能テスト可 |
| SecretStore | ○ 中 | MemorySecretStore 必要(テスト用)、暗号化部分の単体テストも別途 |
| AuthProvider | ○ 中 | MockAuthProvider 必要、Stage 機械の状態遷移テスト + Incremental Authorization 挙動再現 |
| SettingsService | ◎ 高 | StorageProvider 上のドメイン抽象、全パーシャル更新をユニットテストで網羅可 |
| ConsentService | ◎ 高 | 規約バージョン比較ロジックは純粋関数、テスト容易 |
| CharacterService | ○ 中 | character.md / coaching.md 読込 + systemInstruction 構築、coaching.md フィクスチャ準備が必要 |
| NotifyProvider | △ 中〜難 | Calendar API モックは可能、実 Event 作成挙動の確認は実 API + テスト用カレンダー必要 |

### 15.2 watch* セマンティクス契約のテスト(Sさん Interface 契約 v0.1 §1.6)

5項目の契約を満たすことを検証:

```typescript
describe('watch* セマンティクス契約', () => {
  it('購読開始直後にコールバックが呼ばれる(現在値スナップショット)', async () => {
    const storage = new MemoryStorage();
    await storage.saveSettings(initialSettings);
    let received = null;
    const unsub = storage.watchSettings((s) => { received = s; });
    await waitFor(() => expect(received).toEqual(initialSettings));
    unsub();
  });
  it('値が変わった時のみ追加で呼ばれる(重複通知禁止)', async () => {
    const storage = new MemoryStorage();
    let callCount = 0;
    const unsub = storage.watchSettings(() => { callCount++; });
    await storage.saveSettings(initialSettings);
    await storage.saveSettings(initialSettings); // 同一値
    await storage.saveSettings(updatedSettings);
    expect(callCount).toBe(2); // 初回 + 1回変更のみ
    unsub();
  });
  it('Unsubscribe 後は呼ばれない', async () => { /* ... */ });
  it('多重購読を許容(同じ key に複数 cb)', async () => { /* ... */ });
  it('エラー発生時もコールバックを呼ぶ(LoadResult.ok=false)', async () => { /* ... */ });
});
```

これは **契約テスト** として、すべての watch* メソッド(`watchSettings`, `watchSyncState`, `watchCurrentCharacter`, `watchConsentState`)で同型を回す。

### 15.3 Result 型族のテスト(LoadResult / SaveResult / AppendResult / FlushResult)

**throw に頼らない契約**: テストでは `try/catch` を一切使わず、Result 型の分岐で全エラーパスを網羅。

```typescript
describe('LoadResult', () => {
  it('ok: true の場合、value と meta を持つ', async () => {
    const result = await storage.loadSettings();
    if (result.ok) {
      expect(result.value).toBeDefined();
      expect(result.meta.source).toMatch(/^(drive|cache|pending)$/);
    } else {
      fail('should be ok');
    }
  });
  it('オフライン時に cached がある場合は返却される', async () => {
    const storage = new FlakyStorage({ failureRate: 1.0, reason: 'offline' });
    await storage.saveSettings(initial);
    const result = await storage.loadSettings();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('offline');
      expect(result.cached).toEqual(initial);
    }
  });
});
```

### 15.4 キャッシュ TTL ポリシーのテスト(Sさん Interface 契約 v0.1 §1.5)

| ファイル | TTL | テスト方法 |
|---|---|---|
| settings.json | 5分 | clock モックで 5分経過 → 次回 load 時に Drive 再取得 |
| index.json | 1時間 | 1時間経過後再取得 |
| manual.md | 24時間 | 24時間以内は cache 返却、超過で再取得 |
| characters/*.md | 1時間 | 1時間経過後再取得 |
| errors.md | N/A | キャッシュしない、毎回 Drive 取得 |
| conversations/*.md | 24時間(過去ログのみ) | 24時間以内は cache、過去ログは静的 |

**テストパターン**: `clock.now()` モック + TTL 境界値(5分ちょうど、5分1秒)/ TTL 内は `meta.source='cache'` / TTL 超過は `meta.source='drive'`(バックグラウンド再取得)/ オフライン時は TTL 無視で cache 返却。

### 15.5 SecretStore テスト戦略

```typescript
describe('SecretStore', () => {
  it('putSecret → getSecret で同じ値が取れる', async () => { /* ... */ });
  it('暗号化されて IndexedDB に保存される(平文でない)', async () => {
    // IndexedDB を直接覗いて、保存値が平文の API キーでないことを確認
  });
  it('端末派生鍵が変わると復号できない(別端末想定)', async () => { /* ... */ });
  it('clearAll() 後に getSecret() が null を返す', async () => { /* ... */ });
  it('WebCrypto 未サポート環境(古い iOS Safari)で initialize() が unsupported を返す', async () => { /* ... */ });
});
```

### 15.6 AuthProvider テスト戦略

Stage 機械(`unauth → stage1 → stage2`)の状態遷移、Incremental Authorization の挙動再現。詳細は §16.1 で深掘り。

### 15.7 SettingsService テスト戦略

```typescript
describe('SettingsService パーシャル更新', () => {
  it('setCoachingEnabled(true) 後、 getSettings().coaching.enabled が true', async () => { /* ... */ });
  it('setNotificationTime("09:30") 後、 lastUpdated が clock.now() に更新される', async () => { /* ... */ });
  it('applyPatch で複数フィールド同時更新可', async () => { /* ... */ });
  it('楽観更新: StorageProvider が pending でも getSettings() は新値を返す', async () => { /* ... */ });
});
```

### 15.8 ConsentService テスト戦略

```typescript
describe('ConsentService', () => {
  it('規約バージョン v0.3 → v0.4 で isTermsAccepted が false に変わる', async () => {
    await consent.acceptTerms('v0.3');
    expect(await consent.isTermsAccepted('v0.3')).toBe(true);
    expect(await consent.isTermsAccepted('v0.4')).toBe(false);
  });
  it('confirmAge(false) 後、isAgeConfirmed() が false を返す(利用不可シナリオ)', async () => { /* ... */ });
  it('allConsentsCurrent が UI ゲート判定で機能する', async () => { /* ... */ });
});
```

### 15.9 CharacterService テスト戦略

```typescript
describe('CharacterService', () => {
  it('selectCharacter("miyu") 後、 getSystemInstruction() に miyu.md 内容が含まれる', async () => { /* ... */ });
  it('getCoachingPrompt(context) で coaching.md 変数差し込み済みの文字列が返る', async () => { /* ... */ });
  it('checkForBundledUpdates() でビルド版 vs Drive 版の差分を返す(Q-U-c-2 連動)', async () => { /* ... */ });
});
```

### 15.10 NotifyProvider テスト戦略

§14.1 L1〜L2 と統合、詳細は §14.1 参照。実 Calendar API 検証は **テスト用 Google アカウント** (Beta_v1_scope §10 #3 確定済) + テスト用カレンダーで実施。

---

## 16. 段階2: Uさん 成果物テスト観点 深掘り

### 16.1 OAuth Stage 機械の状態遷移(Uさん OAuth §3.1)

```typescript
describe('AuthProvider Stage 機械', () => {
  it('unauth → requestStage1Consent → stage1', async () => {
    const auth = new MockAuthProvider({ initialStage: 'unauth' });
    const result = await auth.requestStage1Consent();
    expect(result.ok).toBe(true);
    expect(auth.currentStage()).toBe('stage1');
  });
  it('stage1 → requestCalendarConsent → stage2(既得スコープ維持)', async () => { /* ... */ });
  it('stage1 で Drive 拒否 → ok: false, reason: partial、granted に部分スコープ', async () => { /* ... */ });
  it('signOut() で unauth に戻る', async () => { /* ... */ });
  it('onStageChange で Stage 変化が通知される', async () => { /* ... */ });
});
```

### 16.2 drive.file スコープ範囲のテスト

```typescript
describe('drive.file スコープ範囲', () => {
  it('MIYU_App_Data/ 配下のファイルは読み書き可', async () => { /* ... */ });
  it('MIYU_App_Data/ 外の任意ファイルは files.list でも見えない', async () => { /* ... */ });
  it('ユーザーが MIYU_App_Data を移動 → アプリから見えなくなる → ensureLayout() で再作成', async () => { /* ... */ });
});
```

### 16.3 iOS Safari 7日ポリシーでの再 OAuth 1クリック復旧

```typescript
describe('iOS Safari 7日ポリシー対応', () => {
  it('IndexedDB が消えた状態でアプリ起動 → AuthProvider.initialize() が { ok: true, restored: false } を返す', async () => { /* ... */ });
  it('再 OAuth → refresh_token を SecretStore に保存 → Drive 上の MIYU_App_Data から設定/キャラ/プロファイル復元', async () => { /* ... */ });
  it('Gemini API キーは IndexedDB 消失時に喪失 → 設定画面で再入力 UI が表示される', async () => { /* ... */ });
});
```

### 16.4 LWW 競合解決の詳細(Uさん Drive レイアウト §5)

```typescript
describe('LWW 競合解決', () => {
  it('ETag 不一致時に conflicts/ に退避', async () => {
    const storage = new MemoryStorage();
    await storage.saveSettings(localUpdate);
    storage.simulateRemoteUpdate('settings.json', remoteUpdate);
    const result = await storage.saveSettings(anotherLocalUpdate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('conflict');
  });
  it('errors.md / 会話ログは再取得 + 再追記でリトライ(冪等)', async () => { /* ... */ });
  it('onConflict イベントが UI に通知される', async () => { /* ... */ });
});
```

### 16.5 pending queue flush の詳細(Uさん Drive レイアウト §6 / Storage §6)

```typescript
describe('pending queue flush', () => {
  it('オフライン書込 → pending queue に保留', async () => {
    const storage = new FlakyStorage({ failureRate: 1.0, reason: 'offline' });
    const result = await storage.saveSettings(updated);
    expect(result.pending).toBe(true);
    expect(storage.getSyncState().pendingWrites).toBe(1);
  });
  it('オンライン復帰 → flushPending() で自動 flush', async () => { /* ... */ });
  it('同一リソースへの複数 pending は最新だけ保持(overwrite 系)', async () => { /* ... */ });
  it('append 系(errors/conversation)は全件保持・順番再生', async () => { /* ... */ });
  it('リトライ上限5回超過で errors.md 記録 + UI 警告', async () => { /* ... */ });
});
```

### 16.6 Cloud Run 認証(共通シークレット、Uさん Cloud Run §7.3 案B)

```typescript
describe('VOICEVOX Cloud Run 認証', () => {
  it('Authorization: Bearer <token> 一致 → 200 OK', async () => { /* ... */ });
  it('Authorization なし → 401', async () => { /* ... */ });
  it('Authorization 不一致 → 401', async () => { /* ... */ });
  it('max-instances=5 で構造的請求キャップ(統合テストは別途)', async () => { /* ... */ });
});
```

### 16.7 Cloud Run コールドスタート対応のテスト(Uさん Cloud Run §5.3)

```typescript
describe('Cloud Run コールドスタート + Web Speech フォールバック', () => {
  it('VOICEVOX 初回呼び出し → 5〜15秒の遅延 → Web Speech フォールバックに切替', async () => { /* ... */ });
  it('VOICEVOX 復帰 → 次回呼び出しから VOICEVOX 再利用', async () => { /* ... */ });
  it('フロント起動時にバックグラウンドでウォームアップ HTTP リクエスト', async () => { /* ... */ });
});
```

### 16.8 VOICEVOX Web Speech フォールバックテスト(Sさん v0.3 §8)

```typescript
describe('TTS フォールバック', () => {
  it('preferVoicevox=true && fallbackWebSpeech=true で VOICEVOX 失敗 → Web Speech', async () => { /* ... */ });
  it('preferVoicevox=false で Web Speech 単独', async () => { /* ... */ });
  it('Web Speech も失敗(古い iOS Safari)→ サイレント、text only 表示', async () => { /* ... */ });
});
```

### 16.9 H2 ネットワーク監視応用(運営者ドメイン POST 0件、§12.5 副次気づきの具体化)

```typescript
describe('H2 ネットワーク監視(FlakyStorage 連動)', () => {
  it('オフライン状態でも運営者ドメインへの POST が発生しない', async ({ page }) => {
    const operatorRequests = [];
    page.on('request', (req) => {
      if (req.url().includes('novemintelligence.com') && req.method() === 'POST') {
        operatorRequests.push(req);
      }
    });
    await page.evaluate(() => window.__injectFlakyStorage({ failureRate: 1.0, reason: 'offline' }));
    await runFullScenario(page);
    expect(operatorRequests).toHaveLength(0);
  });
  it('VOICEVOX Cloud Run と運営者ドメインは別物(Cloud Run リクエストは許容)', async ({ page }) => {
    // Cloud Run URL への POST はカウントしない、許可リスト機構で吸収
  });
});
```

### 16.10 Cloud Logging のログ最小化テスト(Uさん Cloud Run §12.5)

```typescript
describe('Cloud Run ログ最小化(法的書類 §6.5 整合)', () => {
  it('HTTP Body が Cloud Logging に記録されない設定', async () => {
    // Cloud Run 設定ファイル(cloudbuild.yaml or service.yaml)の検査
  });
  it('Cloud Logging 保持期間 30日デフォルト', async () => { /* ... */ });
});
```

---

## 17. 段階2: テスト基盤スケルトン構築計画

### 17.1 リポジトリ構造案(v0.1 §8.3 を更新)

```
project-root/
├── src/
│   ├── interfaces/         # Sさん contract(StorageProvider 等 7 interfaces)
│   ├── implementations/    # Uさん 実装(DriveStorage, GoogleAuthProvider, GoogleNotifyProvider 等)
│   ├── services/           # Sさん 中核(ChatService, CoachingService, etc.)
│   ├── components/         # Vue 3 コンポーネント(Uさん UI 実装)
│   ├── stores/             # Pinia ストア(watch* メソッドと結合)
│   ├── characters/         # ビルド同梱 character.md / coaching.md
│   └── main.ts
├── tests/
│   ├── unit/               # Vitest ユニットテスト(coaching/ routing/ settings/ consent/ character/)
│   ├── integration/        # 統合テスト(storage/ auth/ calendar-tasks/ notify/)
│   ├── e2e/                # Playwright E2E(onboarding/ coaching/ deletion/ network-monitor/)
│   ├── a11y/               # axe-core + Lighthouse
│   ├── fixtures/           # テストデータ
│   ├── mocks/              # MSW handlers + MemoryStorage / FlakyStorage / MockAuthProvider
│   ├── personas/           # ペルソナ別シナリオ定義(YAML、§6)
│   └── prompts/            # coaching.md NG ワード辞書(H8 + §14.5)
├── scripts/
│   ├── check-legal-expressions.js
│   └── check-coaching-prompts.js
├── playwright.config.ts
├── vitest.config.ts
├── tsconfig.json
└── .github/workflows/
    ├── ci.yml              # PR ごと(Vitest + 静的解析 + Lint + TS)
    ├── e2e.yml             # マージ後(Playwright + Lighthouse)
    └── nightly.yml         # 毎日(BrowserStack + 実 API 統合)
```

### 17.2 Vitest セットアップ

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/main.ts', 'src/**/*.d.ts'],
      lines: 80, functions: 80, branches: 75,
    },
  },
});
```

### 17.3 Playwright セットアップ

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html'], ['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-iPhone', use: { ...devices['iPhone 14'] } },
    { name: 'mobile-Android', use: { ...devices['Pixel 7'] } },
  ],
});
```

### 17.4 MSW セットアップ(API モック handlers)

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';
export const handlers = [
  http.get('https://www.googleapis.com/drive/v3/files', () => HttpResponse.json({ files: [] })),
  http.get('https://tasks.googleapis.com/tasks/v1/lists/*/tasks', () => HttpResponse.json({ items: [] })),
  http.post('https://www.googleapis.com/calendar/v3/calendars/*/events', () => HttpResponse.json({ id: 'mock-event-id' })),
  http.post('https://generativelanguage.googleapis.com/v1beta/models/*:generateContent', () => HttpResponse.json({
    candidates: [{ content: { parts: [{ text: 'モック応答' }] } }],
  })),
  http.post('https://voicevox-engine-*.run.app/audio_query', () => HttpResponse.json({})),
  http.post('https://voicevox-engine-*.run.app/synthesis', () => HttpResponse.arrayBuffer(new ArrayBuffer(0))),
];
```

### 17.5 axe-core + Lighthouse CI セットアップ

```typescript
// tests/a11y/onboarding.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('オンボーディング画面に axe-core 違反なし', async ({ page }) => {
  await page.goto('/onboarding');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

### 17.6 GitHub Actions ワークフロー

```yaml
# .github/workflows/ci.yml
name: CI(PR 時)
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:unit -- --run
      - run: npm run test:integration -- --run
      - run: node scripts/check-legal-expressions.js
      - run: node scripts/check-coaching-prompts.js
```

### 17.7 着手スケジュール(Phase 2 Sprint 1 並行)

| 日 | アクション |
|---|---|
| 2026-05-19(本日) | v0.2 段階2 起草完了 + 基盤スケルトン着手許可受領 |
| 2026-05-20〜21 | リポジトリ構造 + Vitest + Playwright + MSW セットアップ |
| 2026-05-22〜23 | 静的解析 H1/H7/H8 CI 統合 + axe-core + Lighthouse CI |
| 2026-05-24〜26(Sprint 1 終盤) | Sさん 設定画面 + Uさん OAuth 統合に対する初回テスト追加 |
| 2026-05-27 以降 | Phase 2 Sprint 2 で D/E/F/G/L3 テスト本格追加 |

---

## 18. 段階2 主要発見

| # | 発見 | 重み |
|---|---|---|
| 1 | Sさん Interface 契約 v0.1 で **7 interface 確定** 、すべて MemoryStorage / FlakyStorage 等のテストダブルが想定済み → Tさん テスト戦略の構造的後押し | 🔴 高 |
| 2 | **6段階優先順位 + 初期1週間抑制 は Sさん v0.4 起草待ち** 、現時点では Tさん 側で枠だけ示し、詳細は v0.4 確定後に補完(§19.1 §19.2 判断仰ぎ) | 🟡 中 |
| 3 | watch* セマンティクス契約(5項目)が Sさん Interface 契約 v0.1 §1.6 で明示 → **契約テスト** として全 watch* メソッドで同型を回す | 🟡 中 |
| 4 | Uさん Cloud Run §7.3 案B 共通シークレット + max-instances 上限 → 認証テスト + 構造的請求キャップ検証が可能 | 🟡 中 |
| 5 | **FlakyStorage の H2 検証応用** が段階2 で具体化(運営者ドメイン POST 0件をオフライン状態でも検証) | 🟡 中 |
| 6 | 7 interface 全体のテスト容易性は **◎ 高 4個 + ○ 中 2個 + △ 中〜難 1個(NotifyProvider)** で、概ね高水準 | 🟢 低 |

---

## 19. 段階2 判断仰ぎ事項

### 19.1 6段階優先順位の解釈 — ✅ 確定済み(2026-05-19 夜)

エルトン指示書「優先順位6段階」と Sさん v0.3 §2.2.2 の5段階の齟齬は、 **Sさん コーチングMD 2本セット v0.1 §4.1 で6段階優先順位として確定** 。 §14.1 L4 で Tさん 推測通り、第6段階 = `dueWithinDays`(期限3日以内)。本書 §14.1 L4 の記述を確定状態に更新済み(v0.2 段階2-補強)。判断仰ぎは不要、参照だけ残す。

### 19.2 初期1週間抑制の詳細仕様

エルトン指示書「初期1週間抑制」は Sさん v0.3 / Interface 契約 v0.1 に明示なし。 §14.3 で Tさん 解釈を仮置きしたが、 **Sさん v0.4 起草で詳細確定** が必要。

- 案A: Tさん 解釈のまま提出、Sさん v0.4 確定後に修正
- 案B: 段階2 では枠だけ示し、テスト項目は仮置き(現状)
- **Tさん 感触**: 案B(現状)、確定後にテストパターンを追加

### 19.3 テスト基盤スケルトン構築の着手日

§17.7 で「2026-05-20〜21」に着手とした。本日(2026-05-19)着手 GO 済みだが、 v0.2 段階2 完成報告の **後に着手** で進める想定。

- 案A: 完了報告後、エルトン明示許可で明日着手
- 案B: 本日中(2026-05-19)に着手開始、明日以降継続
- **Tさん 感触**: 案A(プロセス遵守、完了報告後のエルトン許可で明日着手)

### 19.4 H8 NG ワード辞書(コーチング用)の運用更新

§14.5 でキャラ別口調混入リスクの回帰テスト用に `scripts/check-coaching-prompts.js` を新規追加。これは H8 既存辞書とは別系統で、 **MIYU と セバスチャン それぞれの口調キーワード** を辞書化。

- 案A: Tさん が check-coaching-prompts.js 起草、Sさん が coaching.md 編集時に辞書更新
- 案B: Sさん が coaching.md 起草時に辞書も同時起草、Tさん がレビュー
- **Tさん 感触**: 案B(coaching.md と辞書の整合性は Sさん 領域)

---

## 20. 段階2 副次気づき

### 20.1 段階2 を Sさん v0.4 確定後にさらに更新

§19.1 / §19.2 で示唆した通り、6段階優先順位 + 初期1週間抑制は Sさん v0.4 起草で詳細確定。v0.2 段階2 提出後、Sさん v0.4 受領で **v0.3 として再度更新** する可能性あり。

### 20.2 NotifyProvider のテスト容易性が他より一段難しい

§15.1 で NotifyProvider のテスト容易性を「△ 中〜難」とした。理由は Calendar API の実 Event 作成挙動 + iOS Safari での通知発火が組み合わさるため。 **L1/L2 を Phase 3 Sprint 1 中盤に集中検証** する計画(§5.3)で、Uさん 実装と Tさん テストを密に連携。

### 20.3 watch* セマンティクスの契約テスト

Sさん Interface 契約 v0.1 §1.6 で5項目の契約を明示。実装側(Uさん)は軽量 EventEmitter で 20〜30行で実装可能だが、 **テスト側(Tさん)も同等の契約テストを5項目分用意する必要** あり。本書 §15.2 で雛形を示したが、各 watch* メソッド(Settings / SyncState / Conflict / CurrentCharacter / ConsentState)で同型テストを書く運用。

### 20.4 Cloud Run コールドスタート × Web Speech フォールバック

§16.7〜§16.8 で示したテストパターンは、 **「VOICEVOX を採用しつつ実用可」の構造的担保** 。Sさん v0.3 §8 / Uさん Cloud Run §5.3 / §12.1 で繰り返し言及されたフォールバック設計が、Tさん テスト戦略でも統合的にカバーされた。

### 20.5 段階2 で見えた「Sさん 中核 × Uさん 補助 × Tさん 検証」の三位一体

- Sさん 中核: Interface 契約(7個)+ ロジック実装(TaskCoachingContext / coaching.md 等)
- Uさん 補助: Storage 実装 / OAuth / VOICEVOX Cloud Run / UI コンポーネント
- Tさん 検証: 上記すべてをテストダブル(MemoryStorage / FlakyStorage / MockAuthProvider 等)経由でテスト

これは feedback_test_三位一体 メモリの「言った/実装した/テストした」を、 **設計 × 実装 × テスト** の四位一体に拡張する構造。

### 20.6 アンケート質問項目案の叩き台レビュー予定

エルトン指示書で `アンケート質問項目案_叩き台_v0.1_2026-05-19.md` が起草済みと共有された。段階2 完了後、Tさん UX 観点でレビュー予定(別タスクとしてエルトン許可後着手)。

### 20.7 Sさん コーチングMD 2本セット v0.1 受領と即時反映

2026-05-19 夜、Sさん コーチングMD 2本セット v0.1(`docs/Phase2/Phase2_コーチングMD_2本セット_v0.1_2026-05-19.md`)受領。重要要素:

- **6段階優先順位の両キャラ共通確定** (§19.1 解消、本書 §14.1 L4 を確定状態に更新)
- **H8 NG ワード辞書の拡張**: Tさん 3カテゴリ + Sさん 追加6カテゴリ = 計9カテゴリ(本書 §14.5 に反映)
- 3択ボタン構造化マーカー `@@CHOICES ... @@END`(LLM 出力規約、Uさん UI 実装で確定予定)
- TaskCoachingContext の LLM 渡し方(JSON 添付方式、Sさん コーチングMD §2.1)
- 検証用フィクスチャー: §9.1 4パターン(全該当 / 完了肯定のみ / 期限切れのみ / 空コンテキスト)+ §9.2 NG/OK 出力例3パターン
- これらを `tests/fixtures/coaching/` に明日(2026-05-20)以降に組み込み

**Tさん 側の本書への即時反映**: §14.1 L4 / §14.5 / §19.1 を更新済み、本書 v0.2 段階2-補強 として v0.2 内に統合。明日からのテスト基盤スケルトン構築 + Sさん コーチングMD 2本セットの正式レビューは別タスク。

### 20.8 Sさん コーチングMD §11 の7点判断仰ぎへの Tさん 連動所見

Sさん コーチングMD §11 Q-S-10〜Q-S-16 で7点の判断仰ぎがある。Tさん テスト戦略観点で連動する所見:

- **Q-S-11 JSON 添付方式**: テスト戦略 §14.1 L6(変数差し込み)で安定性を検証、Vitest 出力パース回帰テスト推奨
- **Q-S-12 `@@CHOICES ... @@END` 構造化マーカー**: テスト戦略 §14.1 L7(3択ボタン)+ Uさん UI 実装と擦り合わせ。LLM が忘れた時の再生成挙動も検証対象
- **Q-S-13 Sさん 追加 NG ワード**: 本書 §14.5 で既に反映、テスト戦略上 OK
- **Q-S-14 完了肯定 3択ボタン不要**: テスト戦略 §14.1 L4 で完了肯定セクションのテストパターンを「ボタンなしテキストのみ」に限定
- **Q-S-15 TaskCoachingContext フィルタリング(Sさん コード側 vs LLM 任せ)**: テスト戦略観点では **Sさん コード側でフィルタする方がテスト容易性が高い** (純粋関数として Vitest で検証可能)。ベータでは安定性重視で Sさん 推奨案を支持。

---

## 21. 変更履歴

| 版 | 日時 | 変更内容 | 起草者 |
|---|---|---|---|
| v0.1 | 2026-05-17 | 初版作成、5観点 + 68項目 + 5原則 + フェーズ計画(6/30 配布前提)+ UX 3層構造 + 法的要件 H1〜H7 | Tさん |
| **v0.2 段階1** | **2026-05-19** | **配布日 7/4-7/5 + 削減判定ゲート 6/23 / L カテゴリ8項目追加(計77項目)/ H8 追加 / §5 フェーズ計画全面書き直し / §6.5 アンケート方式全面書き直し / §8 環境ツール確定化 / Uさん MemoryStorage / FlakyStorage 連動** | **Tさん** |
| **v0.2 段階2** | **2026-05-19** | **§14 コーチング機能深掘り(L1〜L8 個別 + 6段階優先順位 + 初期1週間抑制 + ランク自動付与 + プッシュ頻度過剰観察 + キャラ別口調混入) / §15 Sさん Interface 契約 v0.1 レビュー観点(7 interface 個別 + watch* 契約テスト + Result 型族 + TTL ポリシー)/ §16 Uさん 成果物テスト観点(OAuth Stage 機械 + drive.file スコープ + 7日ポリシー + LWW + pending queue + Cloud Run 認証 + コールドスタート + Web Speech フォールバック + H2 応用)/ §17 テスト基盤スケルトン構築計画** | **Tさん** |
| **v0.2 段階2-補強** | **2026-05-19 夜** | **Sさん コーチングMD 2本セット v0.1 受領を反映: §14.1 L4 6段階優先順位を「確定」状態に更新(第6段階 = `dueWithinDays` 確定) / §14.5 キャラ別口調混入リスクで Sさん 追加6カテゴリ NG ワード辞書(計9カテゴリ)反映 / §19.1 確定済みに更新 / §20.7 副次気づき追加 / §20.8 Sさん コーチングMD §11 7点判断仰ぎへの Tさん 連動所見 / Sさん §9 検証用フィクスチャー受領で `tests/fixtures/coaching/` 設置を §17 計画組み込み** | **Tさん** |
