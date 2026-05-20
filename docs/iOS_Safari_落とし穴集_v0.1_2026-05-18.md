# iOS Safari 落とし穴集 v0.1

**作成日**: 2026-05-18
**起草者**: Sさん(Sonnet、実装担当)
**位置づけ**: 独立成長する技術リファレンス。仕様書本体には組み込まず、商品化版・
将来プロジェクトでも参照する横断知見集
**版管理**: 新しい知見が観察されるたびに本書に追記、必要に応じて v0.2 / v0.3 …
と更新
**レビュー**: Tさんレビュー予定(本ファイル完成後、エルトン経由で引き継ぎ)

---

## 1. 本文書の位置づけ

### 1.1 目的

iOS Safari 固有の実装上の落とし穴・症状・対処を、 **新規開発者が「踏む前に
読む」リファレンス** として整理する。Phase 0 デモ(`C:\dev\MIYU_demo\
MIYU_demo.html`)実装で観察・対処した知見を起点に、商品化版(Phase 2 以降)
の実装中に新たに観察される項目を追記して育てていく。

### 1.2 なぜ独立文書にしたか

- iOS Safari 知見は **特定プロジェクトに閉じない横断的トピック** で、仕様書
  本体に組み込むと肥大化する
- 知見は時間経過(iOS / Safari のバージョン更新、新機種登場)で増減する
  ため、 **独立成長させる方が運用しやすい**
- 新規開発者が「ハマる前に開くリファレンス」として位置付けが明確

### 1.3 対象範囲

- iOS Safari(iPhone / iPad)で発生し得る、 **Web 実装側で対処可能** な現象
- iOS / Safari の新バージョンで挙動が変化する可能性があるため、本書の記述は
  **「現時点で観察された傾向」** として扱う
- 法的書類 v0.3 §1.2「未来の自分を縛らない」原則を文書表現にも適用、断定
  表現を避け、限定表現で記述する

### 1.4 本書の更新ルール

- 新しい落とし穴を観察したら、 §2 の表に追記
- 観察対象機種・iOS バージョンを「観察コンテキスト」列に明記する習慣を推奨
- 大きな構造変更があれば版番号を上げ、 §5 変更履歴に記録
- iOS / Safari の新バージョンで挙動が変わって項目が陳腐化した場合は、削除
  ではなく「現在は解消済み(iOS XX.X 以降)」と注記して残す

---

## 2. iOS Safari 固有の落とし穴リスト

### 2.1 表記凡例

| カラム | 意味 |
|---|---|
| 状態 | 🔴 デモで未対処 / 🟢 デモで対処済み / 🟡 部分対処 / ⚪ 観察のみ・未検証 |
| 重要度 | 🔴 高(UI が壊れる)/ 🟡 中(挙動が不安定)/ 🟢 低(微細な体験差) |
| 対処 | 「対処方法」+ 任意で「確認方法」をかっこ書き |

### 2.2 落とし穴一覧

| # | カテゴリ | 状態 | 重要度 | 症状 | 原因 | 対処 | デモコード参照行 |
|---|---|---|---|---|---|---|---|
| 1 | viewport / safe-area | 🟢 | 🔴 | `env(safe-area-inset-*)` が常に 0 を返し、 padding 計算がノッチ・ホームインジケータ領域を考慮できない | viewport meta に `viewport-fit=cover` が含まれていないと、iOS Safari は `env(safe-area-inset-*)` を 0 として返す傾向がある | viewport meta に `viewport-fit=cover` を1語追加(確認: `getComputedStyle().paddingBottom` を実機で読むと値が入る) | MIYU_demo.html:5 |
| 2 | viewport / safe-area | 🟢 | 🔴 | iPhone のノッチ / Dynamic Island 領域にヘッダーのテキストやボタンが被る | header の `padding-top` が固定値で、`env(safe-area-inset-top)` を取り込んでいない | `padding-top: max(12px, env(safe-area-inset-top))` のように `max()` でフォールバック値を併記(確認: ノッチ機で実機目視) | MIYU_demo.html:133-134 |
| 3 | viewport / safe-area | 🟢 | 🟡 | 入力エリア下部がホームインジケータに被る | `padding-bottom` が固定値で `env(safe-area-inset-bottom)` を取り込んでいない | `padding-bottom: max(12px, env(safe-area-inset-bottom))`(項目 1 の `viewport-fit=cover` が前提) | MIYU_demo.html:234 |
| 4 | 音声合成 | 🟢 | 🔴 | 音声 ON にしても最初の応答が無音、または以降の発話も発火しない | iOS Safari の Web Speech API は「ユーザー操作の同期ハンドラ内で初回 `speak()` を発火」する制約があり、`await` 越境後の発火が無効化される傾向 | 音声トグル ON のハンドラ内で `volume=0` の無音 utterance を 1 度 `speak()` し、音声エンジンをユーザータップ起点でアンロック(確認: トグル直後の最初の応答が読まれるか実機検証) | MIYU_demo.html:1219-1227 |
| 5 | 音声合成 | 🔴 | 🟡 | 応答音声再生中に次のメッセージを送信しても、前の音声がすぐには止まらない | `sendMessage` 冒頭で `speechSynthesis.cancel()` を呼んでいないため、新応答が来るまで前の発話が続く | `sendMessage` 冒頭で `if (state.voiceEnabled) speechSynthesis.cancel();` を1行追加(確認: 連続送信時の切り替わり挙動を実機で観察) | MIYU_demo.html:1158-1197(未対応) |
| 6 | 音声合成 | 🟡 | 🟡 | 音声 ON 直後の最初の応答が英語ボイスや男声で読まれる可能性 | `getVoices()` が非同期ロードで、`onvoiceschanged` 発火前に最初の `speak()` が呼ばれると `preferredVoice = null` のままブラウザデフォルトボイスが採用される | `voices.length === 0` の場合は短い遅延 / `voiceschanged` イベントを待つ / ロード完了まで音声 ON ボタンを抑止のいずれか(確認: トグル ON 直後・voices ロード前に発話を発火させて声を観察) | MIYU_demo.html:874-906 |
| 7 | レイアウト | 🟢 | 🟡 | 古い iOS Safari で `100dvh` が反映されず画面下端が見えない | iOS 16.4 未満では `dvh` 単位がサポートされていない傾向 | `100vh` と `100dvh` を二重指定(後方互換、新しい iOS では `dvh` が上書き優先で採用される) | MIYU_demo.html:44-45, :127-128 |
| 8 | レイアウト | ⚪ | 🟡 | 仮想キーボード表示時、入力エリアが画面外に押し出される / メッセージスクロール下端が見えなくなる | `100dvh` は最近の iOS Safari で挙動が改善傾向にあるが、機種によっては `visualViewport` の動きを完全には吸収しない | `window.visualViewport.addEventListener('resize', ...)` で body 高さを再計算する補正コードを追加(確認: textarea にフォーカスしてキーボード起動 → 入力エリアが画面内に残るか) | MIYU_demo.html:38-45, :123-130(現状未対応、Phase 2 で要検証) |
| 9 | 入力 | 🟢 | 🔴 | 日本語 IME 変換確定の Enter で誤送信される | `keydown` で `isComposing` を確認せず Enter を拾うと、IME 確定の Enter も送信トリガーになる | `if (e.key === 'Enter' && !e.shiftKey && !e.isComposing)` で IME 中を弾く(確認: 日本語入力で `あ` → 確定 Enter → 確定だけされ送信されないこと) | MIYU_demo.html:1154, :1201 |
| 10 | スクロール | 🟢 | 🟢 | スクロールが滑らかでない、慣性が効かない | `-webkit-overflow-scrolling: touch` が指定されていない | `#messages` 等のスクロールコンテナに `-webkit-overflow-scrolling: touch`(モダン Safari では既定動作だが互換のため明示) | MIYU_demo.html:172 |
| 11 | スクロール | 🟢 | 🟢 | ページ全体が overscroll でバウンスして UX が乱れる | `overscroll-behavior` 未指定 | `html, body { overscroll-behavior: none; }` | MIYU_demo.html:35 |
| 12 | レンダリング | 🟢 | 🟢 | テキストレンダリングが粗く見える | `-webkit-font-smoothing` 未指定で、デフォルト設定では Retina ディスプレイでフォントエッジが立つ傾向 | `-webkit-font-smoothing: antialiased` を body に | MIYU_demo.html:34 |
| 13 | アクセシビリティ | 🟡 | 🟡 | ピンチズームができず、視覚障害のあるユーザーが拡大できない | `maximum-scale=1, user-scalable=no` を指定している | iOS Safari 10+ では `user-scalable=no` は無視される傾向(実害限定的)、Android Chrome では効くため WCAG 2.5.5 遵守の観点で商品化版では外す検討(確認: 外した場合に意図しないピンチズームでレイアウトが崩れないか実機で軽く確認) | MIYU_demo.html:5 |
| 14 | UX | ⚪ | 🟢 | textarea が伸びると入力エリアも上に伸びてメッセージの最下端が隠れる | autoResize 後にメッセージスクロール位置を更新していない | `autoResize` の末尾に `messages.scrollTop = messages.scrollHeight;` を追加(確認: 長文入力中に直近のメッセージが見え続けるか) | MIYU_demo.html:1207-1212(現状未対応) |
| 15 | UX | ⚪ | 🟢 | `prefers-reduced-motion` を設定しているユーザーへの配慮漏れ | media query での transition 抑制が無い | `@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }`(確認: iOS 設定 → アクセシビリティ → モーションを減らす ON で動作確認) | MIYU_demo.html:269-271 |

### 2.3 観察コンテキスト

- 主要観察環境: iPhone Safari、iOS 17 以降
- 観察時期: 2026-05-13 〜 2026-05-16(Phase 0 デモ実装期間)
- Tさん T-Review_Report.md(2026-05-14)で重大3件 + 中程度4件を体系化
- 一部項目は **iOS バージョン差異が大きい** ため、本書の記述は将来の iOS で
  挙動が変わる可能性がある(本書 §1.3 の通り、断定表現を避けた書き方を採用)

---

## 3. 新規開発者向けチェックリスト

Phase 2 以降の実装着手時、以下のチェックリストを開いて確認することを推奨。

### 3.1 viewport / safe-area(必須)

- [ ] viewport meta に `viewport-fit=cover` が含まれているか( §2.2 #1)
- [ ] フルスクリーン UI のヘッダーに `padding-top: max(N, env(safe-area-inset-top))` が指定されているか( §2.2 #2)
- [ ] フッター/入力エリアに `padding-bottom: max(N, env(safe-area-inset-bottom))` が指定されているか( §2.2 #3)

### 3.2 音声合成(必須、Web Speech API 採用時)

- [ ] 音声 ON ボタンのハンドラ内で無音 utterance による初回アンロックが入っているか( §2.2 #4)
- [ ] 連続送信時に前の音声を `speechSynthesis.cancel()` で止めているか( §2.2 #5)
- [ ] `voices.length === 0` のときの挙動が定義されているか( §2.2 #6)

### 3.3 レイアウト(必須)

- [ ] フルスクリーン高さ指定が `100vh` と `100dvh` の二重指定になっているか( §2.2 #7)
- [ ] 仮想キーボード起動時のレイアウト挙動を実機で検証したか( §2.2 #8)

### 3.4 入力(必須、日本語入力対応)

- [ ] Enter 送信ハンドラで `!e.isComposing` を確認しているか( §2.2 #9)
- [ ] `<input>` と `<textarea>` の両方で IME 対応しているか
- [ ] `autocapitalize="off"` が指定されているか(英字フォーム以外)

### 3.5 スクロール / レンダリング(推奨)

- [ ] スクロールコンテナに `-webkit-overflow-scrolling: touch` が指定されているか( §2.2 #10)
- [ ] html/body に `overscroll-behavior: none` が指定されているか( §2.2 #11)
- [ ] body に `-webkit-font-smoothing: antialiased` が指定されているか( §2.2 #12)

### 3.6 アクセシビリティ(商品化版で必須、ベータでは推奨)

- [ ] `user-scalable=no` を外す検討をしたか( §2.2 #13)
- [ ] `prefers-reduced-motion` 対応が入っているか( §2.2 #15)
- [ ] `aria-live` / `aria-pressed` 等の ARIA 属性が適切に付与されているか

### 3.7 実機検証ポイント

実機検証は **最低でも以下の組み合わせ** を推奨:

| 機種 / OS | 観察すべき項目 |
|---|---|
| iPhone(ノッチあり、iOS 17+) | safe-area 全項目、Web Speech、IME |
| iPhone(Dynamic Island、iOS 17+) | 上部 safe-area の挙動差 |
| iPad(iPadOS 17+) | レイアウト崩れ、視覚的なバランス |
| 古い iPhone(iOS 16.x) | `100dvh` のフォールバック挙動 |

実機が揃わない場合は、Safari Technology Preview の Responsive Design Mode +
iOS Simulator(Mac 必須)で部分的に補完可能。ただし **音声合成と仮想キーボード
挙動はシミュレータで完全再現しない傾向** があるため、実機検証は省略しない。

---

## 4. 将来追加候補(Phase 2 以降に検証して追記)

PWA / Capacitor 化、商品化版開発を通じて新たに観察される可能性があり、
**現時点では未検証** だが、検証対象として記録しておく項目:

### 4.1 PWA インストール体験

- ホーム画面追加時のアイコン・スプラッシュ画面表示
- `manifest.json` の `display: standalone` モードでの safe-area 挙動差
- Add to Home Screen のプロンプト UI 不在(iOS Safari は Chrome のような
  自動プロンプトを提供していない傾向)

### 4.2 Service Worker キャッシュ

- iOS Safari の Service Worker サポート範囲と制約
- オフライン時のフォールバック画面挙動
- キャッシュ更新タイミングと「古いバージョンが残る」現象

### 4.3 プッシュ通知

- iOS 16.4+ で Web Push API がサポートされたが、PWA(ホーム画面追加)経由
  のみ
- 通知許可フローの UX 差(Safari 通常表示 vs PWA 表示)
- バックグラウンド処理の制約(Apps Script トリガーとの組み合わせ)

### 4.4 音声入力(STT 系)

- iOS 標準の音声入力(キーボード上のマイクボタン)が textarea でどう動くか
- Web Speech Recognition API(`SpeechRecognition`)の iOS Safari サポート
  状況(現時点では非対応の傾向)
- VOICEVOX 統合時の TTS 切替えに伴う Web Speech API からの移行

### 4.5 バックグラウンド処理

- アプリがバックグラウンドに移った時の音声再生継続可否
- タイマー / 通知のバックグラウンド実行制約
- 朝サマリ通知が PWA で動くかどうか( Apps Script + Calendar Event リマインダー
  ハイブリッドで仕様書 §7 通り回避可能)

### 4.6 IndexedDB / localStorage 永続性

- iOS Safari の「7日間使わないと自動削除」ポリシー
- BYOK モデルで API キーを端末内に保管する場合の信頼性
- 削除リスクを許容しつつ Drive 同期で復元可能な設計の必要性(仕様書 §4 /
  v1.3 §20 と連動)

### 4.7 タッチターゲットサイズ

- WCAG 2.5.5 の 44×44pt 以上推奨
- スマホ音痴対応 UX(memory: feedback-ux-three-layer)の観点でも重要

### 4.8 文字入力時のフォームズーム

- iOS Safari は input の font-size が 16px 未満だと自動ズームする傾向
- 自動ズームを抑止するには font-size を 16px 以上に設定

---

## 5. 変更履歴

| 版 | 日時 | 変更内容 | 起草者 |
|---|---|---|---|
| v0.1 | 2026-05-18 | 初版作成。 Phase 0 デモ実装で観察・対処した 15 項目を §2 表に整理、§3 チェックリスト化、§4 で将来追加候補を明示 | Sさん(Sonnet) |

---

## 6. 関連文書

- 仕様書 v1.4 §26.5「配信時の運用ハマりポイント」 — ngrok / 配信側の知見
- 仕様書 v1.4 §22(本文化待ち、v1.5 で確定予定)— 入力UX設計思想(3択ボタン式、
  音声・タップ・キーボード)
- 法的書類 v0.3 §1.2 — 「未来の自分を縛らない」原則(本書の表現方針の根拠)
- Phase 0 Tさん T-Review_Report.md(`C:\dev\MIYU_demo\T-Review_Report.md`)
- Phase 1 Sさん Step 2 報告書 §5(本書の起草の発端)
- Phase 0 デモ実装(`C:\dev\MIYU_demo\MIYU_demo.html`)

---

**以上、v0.1 初版。Tさんのレビューを経て v0.2 に改訂予定。**

レビュー観点として、特に気になる箇所:
- §2.2 表の項目漏れ(Phase 0 実装中に観察したが本書に拾えていない知見の有無)
- §2.2 の表現が「未来の自分を縛らない」原則に十分整合しているか
- §3 チェックリストの過不足
- §4 将来追加候補のうち、Phase 2 直近で確定させた方がよい項目
