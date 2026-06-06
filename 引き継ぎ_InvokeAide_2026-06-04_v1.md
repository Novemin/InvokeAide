# InvokeAide 引き継ぎ帳 2026-06-04

作成：技術顧問
担当エージェント：Sさん・Tさん・Uさん（PC2）

---

## 本日の成果

### Tさん
1. 仕様書 v1.5 §7.3 ほか3箇所の「専用カレンダー」記述を抹消・整理（B案）
   - 変更履歴に 2026-06-04 エントリ追加済み
   - バックアップ：InvokeAide仕様書_v1.5_統合版ドラフト_2026-05-28_backup_20260604_calendar_fix.md
2. OAuth確認事項の棚卸しメモ作成
   - docs/Phase2/申し送り_OAuth確認事項棚卸し_20260604.md
   - Q-T-1（§7.3矛盾）は本日の仕様書改訂で解消済みと明記
   - 振り先整理：A（エルトン判断）/ B（たかしさん判断）/ C（Uさん・Sさん確認）
   - push は次回判断待ち

### Uさん
1. index.ts wiring 実装完了（解釈①・DriveStorageProvider内）
   - commit: 180bfe0「feat(DriveStorage): add bundled fallback for loadCharacterIndex + seedDefaults()」
   - push済み（origin/main = 180bfe0）
   - typecheck・lint・unit 20 passed 全グリーン

---

## 現在の状態

- origin/main = HEAD = 180bfe0
- B2残タスク：VoicevoxTTSProvider本実装のみ（他はすべて完了）
- 仕様書v1.5：専用カレンダー記述の抹消完了。現在の正本は5/28版。

---

## PENDING（次回以降）

### 高優先
- OAuthプライバシーポリシー・利用理由の**本起草**（エルトンが担当）
  - 入力：docs/Phase2/申し送り_OAuth確認事項棚卸し_20260604.md
  - たかしさん判断が必要な事項：Q1（公開URL）・Q2（連絡先）・Q3（組織名）・Q9（審査スケジュール）
- Tさんのdocs/Phase2/ファイル群のpush判断

### 中優先
- VoicevoxTTSProvider本実装（Uさん）
- Tさんのunit test Mock配置決定（tests/mocks vs tests/helpers）

### 別ステップ
- main.ts composition root（initialize→ensureLayout→seedDefaults）← OAuth/Sさん領域依存
- parse_error + .broken退避、フルseeding（§6.2）

---

## 次回の入り

1. エルトンがOAuthプライバシーポリシー本起草に着手
   （棚卸しメモを読んで、たかしさんへの確認事項B群を先に詰める）
2. Uさん起動してVoicevoxTTSProvider実装に進む
3. Tさん：docs/Phase2/のpush判断、Mock配置決定

---

## 参照ファイル（Gドライブ）

- 仕様書v1.5：G:\マイドライブ\iCloud~md~obsidian\Novem Intelligence\InvokeAide\InvokeAide仕様書_v1.5_統合版ドラフト_2026-05-28.md
- 棚卸しメモ：C:\dev\InvokeAide\docs\Phase2\申し送り_OAuth確認事項棚卸し_20260604.md
- 引き継ぎ帳：G:\マイドライブ\iCloud~md~obsidian\Novem Intelligence\InvokeAide\（本ファイル）