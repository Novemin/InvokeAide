# Phase 1 Step 3 報告書 v0.4 — 技術選定報告(CLAUDE.md §5.2 4項目 確定版)

**作成日**: 2026-05-21(木) 朝
**起草者**: Sさん(Sonnet、 実装担当)
**前版**: `Phase1_技術スタック決定提案_v0.3_2026-05-18.md`(旧記録・部分陳腐化として残置)
**改訂の根拠**: 2026-05-21 たかしさん経由エルトン週末作業指示書 §1「CLAUDE.md §5.2 4項目を根拠つきで報告書にまとめる」 + Q-A〜Q-C 確定(2026-05-21)
**改訂範囲**:
- 新章 §1〜§4 として CLAUDE.md §5.2 4項目(FE / BE / LLM 抽象化 / STT)を「選定 + 根拠 + 却下案理由」 で網羅的に整理(v0.3 では薄かった LLM 抽象化と STT を厚く)
- §7.3「PC1 既存 MIYU 同期記述」 を Q17 確定「同期不要・完全別物として並走」 に修正(認識訂正、 CLAUDE.md §9 運用)
- §9.2「Sさん 所感 PC1 同期論」 を上記と整合する内容に書き換え
- v0.3 §1〜§10 はリナンバーのみで §5〜§14 として継承(コーチング機能章は維持)

**スコープ境界の自己宣言**(指示書 §1 末尾「スコープ外」 と整合):
- 本書は技術 **選定** まで。 Sprint 2 で何を作るか(スコープ)の判断には踏み込まない(5/26 議論待ち)
- 例: 「LLM 抽象化 interface を Sprint 2 で実装するか」 は本書で判定しない、 「どの抽象化設計を採るか」 のみ判定する

---

## 0. v0.3 → v0.4 変更サマリ

### 0.1 構造変更

| 領域 | v0.3 | **v0.4** |
|---|---|---|
| CLAUDE.md §5.2 4項目 | §1 FE / §3 BE / §4 LLM抽象化 / §7 STT に分散、 簡潔記述 | **§1〜§4 として独立章化、 「選定 + 根拠 + 却下案理由」 を網羅** |
| PC1 既存 MIYU 同期記述 | §3.3 / §5.2 で「単方向同期」 提案 | **§7.3 / §9.2 で「同期不要・完全別物として並走(Q17 確定)」 に修正** |
| コーチング機能章 | §1〜§4 で記述 | **§5〜§8 にリナンバー、 内容は継承** |
| 所感・リスク・Q・課題 | §5〜§8 | **§9〜§12 にリナンバー、 4項目関連 Q を §11 に追加** |

### 0.2 認識訂正(CLAUDE.md §9「自分の誤認を隠さない」 運用)

v0.3 §3.3 / §5.2 で「PC1 既存 MIYU との character.md / coaching.md 同期は InvokeAide → PC1 の単方向推奨」 と書いた件、 たかしさんから Q17 で **「現行 MIYU と InvokeAide は完全に別物として並走、 同期不要」** と確定をいただきました(CLAUDE.md §1.4「両方並行運用継続、 共有はドキュメント・知見ベース」 とも整合)。

v0.4 では §7.3 / §9.2 を「同期不要、 完全別物として並走」 に修正します。 v0.3 の単方向同期記述は **私の認識不足**(両プロジェクトの境界線設計を読み違えていた)であり、 訂正します。 v0.3 ファイル自体は CLAUDE.md §9「旧記録・部分陳腐化」 ラベルで残置されます。

### 0.3 v0.3 から維持する内容

| 項目 | v0.3 該当章 | v0.4 該当章 |
|---|---|---|
| 通底原則4項目(FE完結 / SoT=Drive / 抽象化 / 段階的拡張) | §0.2 | §0.4 |
| Vue 3 採用(動作軽さ根拠) | §1 | §1 で厚く再記述 |
| TypeScript 採用 | §2 | §1 に統合 |
| バックエンド方針(FE 完結 + VOICEVOX Cloud Run) | §3 | §2 で厚く再記述 |
| AI 抽象化 interface 草案 | §4 | §3 で厚く再記述 |
| Drive 完結方針(SoT) | §5 | §2 / §10 |
| VOICEVOX 採用(青山龍星 確定済み) | §6 | §2 / §10 |
| キャラクター選択UI(MIYU + セバスチャン) | §6A | §7 |
| STT(OS 標準音声入力依存) | §7 | §4 で厚く再記述 + 抽象化 interface 追加 |
| TTS(VOICEVOX + Web Speech フォールバック) | §8 | §2 末で言及 |
| 全体アーキ図 | §9 | §10 で再掲 |
| コーチング機能関連章 | §1〜§4 | §5〜§8 |

### 0.4 通底原則4項目(v0.3 §0.2 から継承)

| # | 原則 | 適用範囲 |
|---|---|---|
| 1 | **FE 完結を最優先** | アプリ本体はサーバーレス、 ユーザーの権限で API 直叩き |
| 2 | **SoT = Google Drive** | 設定・履歴・キャラ・同意 全て Drive 内に保管 |
| 3 | **抽象化レイヤーで切替可能に** | LLM / STT / TTS / Storage / Auth / Notify を interface 化 |
| 4 | **段階的拡張、 未来縛らない** | 「現在は X」「将来 Y も検討」 表現で contract と Privacy Policy を書く |

---

## 1. フロントエンド選定 — Vue 3 + TypeScript + Vite + Pinia

### 1.1 選定

**Vue 3.x + TypeScript + Vite + Pinia + Vue Router**

| レイヤー | 採用 |
|---|---|
| フレームワーク | Vue 3.x(Composition API) |
| 言語 | TypeScript(strict mode) |
| ビルドツール | Vite + vite-plugin-pwa |
| 状態管理 | Pinia |
| ルーティング | Vue Router 4 |

### 1.2 候補比較

| 候補 | bundle size(gzip 後 目安) | エコシステム | PWA / iOS Safari 適合 | 採否 |
|---|---|---|---|---|
| **Vue 3** | ~34KB | 中(Vue + Vite + Pinia + Vue Router + VueUse が一気通貫) | ◎ | **採用** |
| React | ~45KB+ | 大(業界最大) | ○(bundle size やや重) | 却下 |
| Vanilla JS | 最小(自前次第) | フレームワークなし | ○ ただし自前実装負荷大 | 却下 |
| Svelte | ~10KB(コンパイル後) | 中-小(PWA・モバイル系ライブラリ蓄積は Vue/React より浅い) | ○ | 却下 |

### 1.3 採用根拠

1. **PWA + iOS Safari の制約に合う bundle 軽さ**
   iOS Safari 落とし穴集 v0.1 で確認した通り、 PWA on iOS は bundle size とメモリ使用量に敏感。 Vue 3 は React より軽量で、 家族ベータ規模(数十人想定)で過剰スペックを避けられる。

2. **TypeScript 統合が成熟**
   Vue 3 は TypeScript first-class support。 Composition API + `<script setup lang="ts">` で型推論が綺麗に効く。 Phase 2 Sprint 1 Interface契約 v0.1 の Result type 統一(LoadResult / SaveResult / AppendResult / FlushResult)と相性良。

3. **Composition API が AI 抽象化レイヤー / Service 分離と相性良**
   関数ベースの reactive、 Composable パターンで Service 層(StorageProvider, AIProvider, AuthProvider 等)を Component と切り離せる。 contract-driven 設計と整合。

4. **Vite + Vue ecosystem の一気通貫性**
   - **Vite**: Vue 3 公式推奨、 HMR 高速、 ESM ベース
   - **vite-plugin-pwa**: Service Worker / manifest 自動生成、 iOS Safari の PWA 制約をデフォルトでカバー
   - **Pinia**: Vuex 後継、 TypeScript first-class、 Composition API 統合
   - **Vue Router 4**: navigation guard で年齢確認・規約同意フローを綺麗に組める
   - **VueUse**: composable コレクション、 LocalStorage / IndexedDB / Web Speech API などのラッパーが揃う

5. **Phase 0 デモ(MIYU_demo)からの教訓**
   Phase 0 デモは Vanilla JS だった。 当時はプロトタイプとしては適切だったが、 商品化前提(CLAUDE.md §6「本番品質の設計」)では reactive・コンポーネント・ルーティング・状態管理を自前実装し続けるのは破綻する。 Vue 3 への移行で構造的にこれを解決。

### 1.4 却下案の理由

#### 1.4.1 React

- bundle size が Vue 3 より大きい(gzip 後 ~45KB+ vs ~34KB)
- 大規模アプリ前提のフレームワーク特性(useState / useReducer / context / Suspense 等)が家族ベータ規模では過剰
- ただし業界標準として将来エンジニア採用時に有利な点は留意
- 「未来縛らない原則」: 商品化拡大時に Vue → React 移行可能性は否定しない(ベータでは Vue が最適という判断)

#### 1.4.2 Vanilla JS

- コンポーネント・リアクティブ・ルーティング・状態管理を全て自前実装
- 商品化堅牢性(CLAUDE.md §6)と矛盾する
- Phase 0 デモで一度通った道、 同じ知見の再蓄積を避ける

#### 1.4.3 Svelte

- コンパイル時最適化で bundle 最小級は魅力
- ただしエコシステム蓄積が Vue / React より浅い、 特に **PWA + iOS Safari 系のライブラリ・知見**(vite-plugin-pwa 相当の選択肢、 モバイル UI コンポーネント、 iOS Safari 制約への対処パターン)が薄い
- ベータ期限内(2026-06-30 完成目標)で「ライブラリ自作」 や「知見の自前蓄積」 を強いられるリスクが高い
- 「未来縛らない原則」: 商品化版で Svelte 移行を検討する余地は残す

### 1.5 法的要件との整合(CLAUDE.md §4.1)

| 法的要件 | Vue 3 スタックでの担保方法 |
|---|---|
| データを送らない構造 | SPA、 サーバー送信は明示的な API 呼び出しのみ(OAuth で Drive/Calendar/Tasks 直叩き) |
| 年齢確認フロー | Vue Router の navigation guard、 ConsentService と組み合わせ Stage 0/0.5/1/2 状態機を構築 |
| AI 明示宣言 | Composition API で「初回起動時に AI 明示モーダル表示」 ロジックを Composable 化、 ConsentService と連動 |
| 第三者AI抽象化 | DI / factory パターンで AIProvider を注入、 Component は AIProvider interface のみ依存 |

### 1.6 リスク・トレードオフ

| # | リスク | 対処 |
|---|---|---|
| FE-1 | Vue 3 + TypeScript で学習コストが Sさん / Uさん にかかる | Phase 0 デモが Vanilla だった分の差は Sprint 1 でキャッチアップ済、 大きな追加コストなし |
| FE-2 | iOS Safari の PWA 制約(落とし穴集 v0.1 既収載)が Vue 3 でも残る | vite-plugin-pwa の iOS 対応設定 + 実機検証で吸収、 Sprint 3 で実機検証集中 |
| FE-3 | bundle size の長期的増加 | code splitting + dynamic import で各画面を分割、 初期ロード軽量化 |

---

## 2. バックエンド選定 — 二層構造(サーバーレス + VOICEVOX 中継のみ)

### 2.1 選定

**二層構造**:
- **層 1(アプリ本体): サーバーレス** = データ保管は Google Drive 完結、 PWA は静的ファイルとして CDN 配信(Cloudflare Pages 想定)
- **層 2(音声合成中継): VOICEVOX セルフホスト on Google Cloud Run** = §5.1 確定(TTS = VOICEVOX)を実現する唯一のサーバー要素

### 2.2 層 1(アプリ本体)の候補比較

| 候補 | データ保管 | 運営者経由 | 法的要件「データを送らない構造」 適合 | 採否 |
|---|---|---|---|---|
| **サーバーレス + Drive 完結** | Drive(ユーザー所有) | なし | ◎ | **採用** |
| Node.js + Express 継続 | サーバーDB | あり | × Drive 完結方針と矛盾 | 却下 |
| Apps Script 移行 | Apps Script + Drive | 部分的(実行は Google 環境) | △ 実行時間制限・冷起動の制約大 | 却下 |
| Cloudflare Workers / Vercel Functions | サーバーレス Functions + Drive | あり(中継) | △ 中継不要なら避ける | 却下 |

### 2.3 層 1 採用根拠

1. **§5.1 確定方針との整合**(データ保管 = Drive 完結)
2. **法的要件 §4.1「データを送らない構造」 と整合**
   アプリ本体は OAuth で Drive / Calendar / Tasks API をユーザー権限で直接叩く。 運営者サーバーを経由しない。 Privacy Policy で「通常運用において会話内容を収集・保存しない」 を構造的に担保。
3. **運用コスト最小**
   たかしさん負担は VOICEVOX Cloud Run のみ(CDN は無料枠で十分、 Cloudflare Pages は商用利用も無料枠あり)
4. **マルチデバイス対応**
   Drive = SoT、 LWW(Last-Write-Wins)で衝突解決(Phase 2 Sprint 1 Interface契約 v0.1 で StorageProvider に実装合意済)
5. **PWA との相性**
   静的ファイル配信 = PWA の Service Worker キャッシュ戦略と素直に統合できる

### 2.4 層 1 却下案の理由

#### 2.4.1 Node.js + Express 継続

- 「運営者サーバー経由」 は Drive 完結方針と本質的矛盾
- 既存 MIYU_demo の構造は参照リファレンスにとどめる(コード継承せず、 [[project_miyu_demo_reference_only]] と整合)
- 商品化前提(CLAUDE.md §6)では運営者サーバー = 法的責任の集中点、 これを最小化する設計が望ましい

#### 2.4.2 Apps Script 移行

- 実行時間制限(同期 6分、 非同期 30分)が VOICEVOX 中継には不向き
- cold start(数秒〜数十秒)が UX に影響
- debug 環境の制約大(ローカル開発が困難、 Apps Script エディタ依存)
- 商品化堅牢性(CLAUDE.md §6)と矛盾

#### 2.4.3 Cloudflare Workers / Vercel Functions

- アプリ本体に中継サーバーを挟む必要性が無い(Drive 直叩きで足りる)
- 中継を挟むと「データを送らない構造」 の構造的担保が弱まる
- 「未来縛らない原則」: 将来「API レート制限の集約」 や「BYOK の代替経路」 が必要になれば再検討余地あり

### 2.5 層 2(VOICEVOX 中継)の候補比較

| 候補 | コンテナサイズ対応 | 課金体系 | cold start | 採否 |
|---|---|---|---|---|
| **Google Cloud Run** | ◎(~10GB OK) | リクエスト単位 | 数秒(許容) | **採用** |
| Cloud Functions | × Gen2 でも 8GB 上限、 VOICEVOX(~2GB)はギリギリ | リクエスト単位 | 数秒 | 却下 |
| 自前 VPS(Linode/Vultr) | ◎ | 常時稼働(固定) | なし | 却下 |
| Heroku / Render | ○ | 月額 + 従量 | 数十秒 | 却下 |

### 2.6 層 2 採用根拠

1. **VOICEVOX 公式 Docker image(~2GB)を Cloud Run 上で動作確認済**(v0.3 §6 既述、 引継ぎ帳記録)
2. **オートスケール + リクエスト単位課金** = 家族ベータ規模(数十人、 1日数回利用想定)でコスト最適
3. **GCP エコシステム統合**: Drive / Calendar / Tasks も Google、 OAuth・課金・運用ダッシュボードが一元化
4. **cold start 数秒は許容範囲**
   コーチング通知発火時(18:00)は予測可能、 通知発火直前にウォームアップリクエスト送信可能(Cloud Run の min-instances=0 維持で常時コスト 0)
5. **VOICEVOX = §5.1 確定**: TTS の代替を検討する設計判断は今回スコープ外

### 2.7 層 2 却下案の理由

- **Cloud Functions**: コンテナサイズ上限が VOICEVOX(~2GB)に対してギリギリで将来の VOICEVOX バージョンアップ時のリスク
- **自前 VPS**: 常時稼働コスト固定、 オートスケールなし、 運用負荷大(セキュリティパッチ・OS アップデート等)
- **Heroku / Render**: 料金体系が Cloud Run より割高、 cold start 制御の柔軟性も Cloud Run の方が高い

### 2.8 法的要件との整合(CLAUDE.md §4.1)

| 法的要件 | 二層構造での担保方法 |
|---|---|
| データを送らない構造 | 層 1 はサーバーレス、 層 2 は「会話 AI 応答テキスト」 を音声化処理のみで使用、 メモリ破棄、 保存しない |
| 第三者AIサービス抽象化 | 層 1 から LLM API へは AIProvider 経由(§3)、 ベンダー固定にならない |
| 通常運用において収集・保存しない | 層 2 で「アクセスログ」 のみ記録(レイテンシ計測用)、 テキスト本文は記録しない設計 |

### 2.9 リスク・トレードオフ

| # | リスク | 対処 |
|---|---|---|
| BE-1 | Cloud Run 月額コスト(たかしさん負担) | 家族ベータ規模では数百円〜数千円/月想定、 商品化版で課金モデルを設計 |
| BE-2 | VOICEVOX 公式 image の依存(更新が止まったら) | 「未来縛らない原則」 で TTSProvider 抽象化済、 Web Speech API フォールバックも実装(§2.10) |
| BE-3 | Cloud Run cold start が UX 阻害 | 通知発火直前のウォームアップ + 「合成中…」 UI で吸収 |
| BE-4 | 「会話 AI 応答テキスト」 が層 2 を通過する点を法的に説明する必要 | Privacy Policy「音声合成のため一時的に処理、 保存しない」 と明示(法的書類起草指示書 v0.3 と連携) |

### 2.10 TTS フォールバック設計(v0.3 §8 から継承)

VOICEVOX Cloud Run 障害時 / cold start 過大時 / オフライン時のフォールバックとして **Web Speech API(SpeechSynthesisUtterance)** を併用。 TTSProvider interface 経由で切替:

```typescript
interface TTSProvider {
  readonly providerId: string;  // 'voicevox' | 'webspeech'
  synthesize(text: string, options: TTSOptions): Promise<TTSResult>;
}
```

これにより「未来縛らない原則」(将来 TTS 提供方式が変わっても対応可)を担保。

---

## 3. LLM 抽象化レイヤー選定 — Adapter Pattern + GeminiProvider 初期実装

### 3.1 選定

**Adapter pattern(TypeScript interface ベース)**
- **AIProvider interface** を Phase 2 Sprint 1 Interface契約 v0.1 と整合する形で確定
- **初期実装は GeminiProvider のみ**(Gemini 2.0 Flash)、 ClaudeProvider / OpenAIProvider は **contract 互換 stub** のみ用意
- DI / factory パターンで Component から Provider を分離、 Component は interface のみ依存
- runtime 切替は不要(設定変更 → 再起動許容)

### 3.2 候補比較

| 候補 | 抽象化方式 | bundle size 影響 | 学習コスト | BYOK 適合 | 採否 |
|---|---|---|---|---|---|
| **自作 Adapter(interface)** | interface + class | 最小 | 低 | ◎ | **採用** |
| Strategy pattern | interface + runtime DI | 最小 | 低 | ◎ | 採用(Adapter の一形態として包含) |
| LangChain.js | フレームワーク全乗っかり | 大(数百KB) | 高 | △ BYOK 統合複雑 | 却下 |
| Vercel AI SDK | 軽量 SDK | 中(~20KB) | 中 | ○ | 却下(自作で十分) |

### 3.3 採用根拠

1. **法的要件 §4.1「第三者AIサービス抽象化」 と整合**
   Gemini 固定でない設計を **interface ベースで構造的に担保**。 ベータでは GeminiProvider 1 実装だが、 contract が固定されているため「将来追加可能」 が技術的に裏付けられる。

2. **interface ベースの自作 adapter が最も bundle size 軽量**
   家族ベータ規模では LLM フレームワークの抽象化機能(チェーン、 メモリ、 エージェント等)は不要。 シンプルな interface 1本で要件充足。

3. **BYOK モデルとの相性**
   各 Provider が自前で API キーを保持・送信、 運営者は介在しない。 LangChain や AI SDK は BYOK を扱えるが、 抽象化レイヤーがあると統合が複雑化する。

4. **Phase 2 Sprint 1 Interface契約 v0.1 で既に AIProvider interface 草案合意済**
   Result type 統一(GenerateResult)も既に Sprint 1 で扱い済。 v0.4 では契約を **確定** 段階に進める。

5. **将来 Claude / OpenAI 追加時の差分が interface implement のみで済む**
   既に GeminiProvider が走っていれば、 ClaudeProvider 追加 = 新規 class 1個 + 設定画面の選択肢追加 + AI 明示の文言更新、 アプリ本体ロジックは触らない。

### 3.4 却下案の理由

#### 3.4.1 LangChain.js

- 抽象化レイヤーとしては高機能だが、 bundle size(数百KB)とBYOK 制約のコストが大
- チェーン / エージェント / メモリ等の機能はベータ規模では不要
- BYOK との統合が複雑(LangChain は environment variable 経由を想定する設計が多い)

#### 3.4.2 Vercel AI SDK

- 軽量で次善案だが、 自作 interface 1本で十分カバー可能
- 依存追加を避ける(セキュリティパッチ・破壊的変更の追従コスト)
- 「未来縛らない原則」: 必要が出てきた時点で導入検討余地あり

### 3.5 AIProvider interface 設計(Phase 2 Sprint 1 Interface契約 v0.1 と整合)

```typescript
interface AIProvider {
  readonly providerId: 'gemini' | 'claude' | 'openai' | string;
  readonly modelId: string;  // 'gemini-2.0-flash' 等

  generate(
    messages: Message[],
    options: GenerateOptions
  ): Promise<GenerateResult>;

  generateWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    options: GenerateOptions
  ): Promise<GenerateWithToolsResult>;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GenerateOptions {
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  // 共通オプション(各 Provider で差分があれば実装側で吸収)
}

type GenerateResult =
  | { ok: true; text: string; usage: TokenUsage; finishReason: FinishReason; }
  | { ok: false; error: GenerateError; };

interface GenerateError {
  code: 'rate_limit' | 'auth_failed' | 'context_too_long' | 'network' | 'unknown';
  message: string;
  retryable: boolean;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;  // JSON Schema Draft 2020-12
}

type GenerateWithToolsResult =
  | { ok: true; type: 'text'; text: string; usage: TokenUsage; }
  | { ok: true; type: 'tool_call'; calls: ToolCall[]; usage: TokenUsage; }
  | { ok: false; error: GenerateError; };

interface ToolCall {
  callId: string;
  toolName: string;
  arguments: unknown;  // tool 側で zod 等で型 narrow
}
```

### 3.6 ベータ実装スコープ

| Provider | ベータ v1.0 | 商品化版 v1.1+ |
|---|---|---|
| **GeminiProvider**(Gemini 2.0 Flash) | ◎ 実装 | ◎ 維持 + Gemini 2.5 等への追従 |
| ClaudeProvider | △ contract 互換 stub のみ | ◎ 実装(Claude Haiku/Sonnet/Opus 選択肢) |
| OpenAIProvider | △ contract 互換 stub のみ | ◎ 実装(GPT-4o / o3 系) |

「contract 互換 stub」 = interface を implement するが `throw new NotImplementedError('Claude Provider is not yet available')` を返す class。 これにより:
- AIProvider factory が「Claude が選択された」 ケースを **型レベルで** 扱える
- 設定画面で「Claude(近日対応)」 をグレーアウト表示可能
- 将来 Claude 実装時の差分が interface implement のみ

### 3.7 法的要件との整合(CLAUDE.md §4.1)

| 法的要件 | adapter pattern での担保方法 |
|---|---|
| Gemini 固定でない設計 | interface + factory で構造的に担保、 Privacy Policy「現在 Gemini に対応」「将来 Claude / OpenAI 等への対応を検討」 |
| BYOK モデル | 各 Provider が SecretStore から自前で API キー取得、 運営者は介在しない |
| データを送らない構造 | 各 Provider は LLM API 提供者(Google / Anthropic / OpenAI)と直接通信、 運営者サーバー非経由 |

### 3.8 「未来縛らない原則」 表現例

Privacy Policy / 利用規約 / アプリ内表示で使う表現の例:
- × 「本アプリは Gemini を使用します」
- ○ 「本アプリは現時点で Google Gemini に対応しています。 将来、 Anthropic Claude や OpenAI ChatGPT などの第三者AIサービスへの対応を検討しています」
- × 「LLM を切り替えることはできません」
- ○ 「現時点では Gemini のみご利用いただけます」

### 3.9 リスク・トレードオフ

| # | リスク | 対処 |
|---|---|---|
| LLM-1 | Gemini API の breaking change(SDK バージョンアップ) | GeminiProvider 内に封じ込め、 interface 側は安定 |
| LLM-2 | 各 Provider で「function calling」 仕様が異なる | ToolDefinition / ToolCall を共通形にし、 各 Provider 実装で変換 |
| LLM-3 | Gemini の context window / レート制限が将来変更 | GenerateOptions / GenerateError で吸収、 リトライ戦略は Provider 内 |
| LLM-4 | 「Claude 対応」 と書きながら実装が遅延した場合の信頼性 | 「検討しています」 表現で約束しない、 stub は実機表示しない(設定画面でグレーアウト) |

---

## 4. 音声認識 STT 選定 — OS 標準音声入力(Web Speech API) + STTProvider 抽象化

### 4.1 選定

**Web Speech API(OS 標準音声入力)を初期採用**、 **STTProvider interface を準備して将来 BYOK 型 STT(Whisper 等)追加余地を残す**

### 4.2 候補比較

| 候補 | 通信方式 | BYOK 追加要否 | iOS Safari 対応 | 精度 | 採否 |
|---|---|---|---|---|---|
| **Web Speech API**(OS 標準) | OS / ブラウザ内 | 不要 | ◎ | 中 | **採用** |
| OpenAI Whisper API | サーバー経由(OpenAI) | 必要(2つ目の API キー) | ◎ | 高 | 却下 |
| Google Cloud Speech-to-Text | サーバー経由(GCP) | 必要(GCP プロジェクト + API キー) | ◎ | 高 | 却下 |
| Deepgram | サーバー経由(Deepgram) | 必要(API キー) | ◎ | 高(リアルタイム特化) | 却下 |

### 4.3 採用根拠

1. **BYOK モデルの認知負荷最小**
   Gemini API キーだけで完結。 STT 用の2つ目の API キーを家族テスター(IT 音痴含む、 [[feedback_ux_three_layer]] 層 3)に登録させるのは現実的でない。

2. **iOS Safari + Android Chrome 標準対応**
   iOS Safari 落とし穴集 v0.1 で Web Speech API の制約は調査済。 「継続認識(continuous: true)が iOS で不安定」「マイク権限ダイアログが画面遷移ごとにリセット」 等の落とし穴は UX 設計で吸収可能。

3. **ベータ v1.0 スコープでは音声入力は補助機能**
   ベータ Must スコープでメイン入力は「テキスト + 3択ボタン」(コーチングMD §2 / Phase 2 Sprint 1 で確定済)。 音声入力は「使いたい人だけ使う」 補助機能。 精度より「使えること」 が優先。

4. **データを送らない構造**(条件付き)
   Web Speech API は OS / ブラウザ実装。 ただし内部的に **OS ベンダー(Apple / Google)のクラウド STT サービス** にデータを送る実装が多い(iOS Safari → Apple Siri 系、 Android Chrome → Google STT)。 これは Privacy Policy で明示開示する(運営者サーバーは経由しない点は事実だが、 OS ベンダーへの送信は構造上避けられない)。

5. **オフライン部分動作の可能性**
   Android の一部端末は端末内 STT も対応、 オフライン時の縮退動作余地あり。 iOS は基本クラウド STT のみ。

### 4.4 却下案の理由

#### 4.4.1 OpenAI Whisper API

- BYOK 認知負荷(2つ目の API キー、 課金カード登録、 利用上限管理)
- 通信遅延(録音 → サーバー送信 → STT 処理 → レスポンス、 リアルタイム性低下)
- ベータ規模では「精度向上のメリット < BYOK ハードル増のデメリット」

#### 4.4.2 Google Cloud Speech-to-Text

- BYOK 認知負荷に加え、 **GCP プロジェクト設定** が IT 音痴ユーザーに致命的に高ハードル
- GCP コンソール / IAM / 課金有効化 等の手順は家族ベータ層には現実的でない
- 「Gemini と同じ Google」 だから簡単だろうという錯覚が落とし穴になる(GCP プロジェクトと Gemini API キーは別物)

#### 4.4.3 Deepgram

- 同上 + 利用者層ミスマッチ(技術者向け、 リアルタイム特化、 家族ベータには過剰)

### 4.5 STTProvider interface 設計

```typescript
interface STTProvider {
  readonly providerId: 'webspeech' | 'whisper' | 'gcloud-stt' | 'deepgram' | string;

  start(options: STTStartOptions): Promise<STTSession>;
}

interface STTStartOptions {
  language: string;  // 'ja-JP' 等
  continuous: boolean;
  interimResults: boolean;
}

interface STTSession {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: STTError) => void;
  stop(): Promise<void>;
}

interface STTError {
  code: 'not_supported' | 'permission_denied' | 'no_speech' | 'network' | 'unknown';
  message: string;
  retryable: boolean;
}
```

これにより、 将来 BYOK 型 STT を追加する際の差分が interface implement のみで済む(LLMProvider と同じ adapter pattern を踏襲)。

### 4.6 iOS Safari 制約(落とし穴集 v0.1 既収載)

| 制約 | 対処 |
|---|---|
| 継続認識(continuous: true)が iOS Safari で不安定 | 短時間セッション(発話単位)+「マイクボタン再タップ」 UX で吸収 |
| マイク権限ダイアログが画面遷移ごとにリセット | 初回起動時に明示的に許可取得、 navigationmanagement で再要求最小化 |
| iOS 16.4+ PWA インストール状態で挙動が変わる場合あり | 落とし穴集 v0.2 で実機検証時に補強(Sprint 3 想定) |

### 4.7 法的要件との整合(CLAUDE.md §4.1)

| 法的要件 | Web Speech API での担保方法 |
|---|---|
| データを送らない構造(運営者) | 運営者サーバー非経由 ◎ |
| データを送らない構造(OS ベンダー) | △ 構造上 OS ベンダーへ送信される、 Privacy Policy で明示開示 |
| AI 明示宣言 | 音声入力 → テキスト化 → LLM 処理 のフローを UI で見える化(録音中アイコン、 テキスト化中アイコン、 AI 応答中アイコン) |
| 通常運用において収集・保存しない | 運営者として収集しない点は事実、 OS ベンダー側の挙動は別途 Privacy Policy で説明 |

### 4.8 「未来縛らない原則」 表現例

Privacy Policy で使う表現の例:
- × 「音声入力データを一切送信しません」
- ○ 「音声入力は端末標準の音声認識機能を使用します。 一部の端末では OS / ブラウザの仕様により、 音声データが OS 提供元(Apple / Google 等)のサーバーで処理される場合があります。 運営者(Novem Intelligence)のサーバーには送信されません」
- × 「Whisper には対応しません」
- ○ 「現時点では端末標準の音声認識機能のみに対応しています。 将来、 BYOK 型の高精度音声認識サービスへの対応を検討しています」

### 4.9 リスク・トレードオフ

| # | リスク | 対処 |
|---|---|---|
| STT-1 | Web Speech API の精度が低く家族テスターが「使えない」 と感じる | ベータでは「テキスト + 3択ボタン」 がメイン入力、 音声は補助、 精度問題は v1.1 で BYOK STT 追加検討 |
| STT-2 | iOS Safari の制約で音声入力が動かないケース | UI に「音声入力が使えない場合はテキスト入力をご利用ください」 案内、 検出時に自動フォールバック |
| STT-3 | OS ベンダーへのデータ送信の説明責任 | Privacy Policy で明示開示、 法的書類起草指示書 v0.3 と連携 |
| STT-4 | 「将来 Whisper 対応」 と書きながら実装が遅延 | 「検討しています」 表現で約束しない |

---

## 5. 通知設計(v0.3 §1 から継承、 リナンバー)

### 5.1 要件整理

たかしさん指示書 §2.3:
- **18:00**(仕事終わり想定、 設定で調整可推奨)に コーチング通知
- 発火条件: Google Tasks に未完了タスクがある日
- 通知媒体: Telegram(既存 PC1 MIYU 基盤) または 別手段
- 通知 → ユーザーがアプリを開く → MIYU/セバスチャンと一緒にタスク見直し

### 5.2 候補3案

| 案 | 通知媒体 | バックエンド依存 | iOS/Android 対応 | ベータ v1.0 適合 |
|---|---|---|---|---|
| 1(推奨) | **Google Calendar Event リマインダー** | なし(FE完結 + Calendar API) | ◎ OS ネイティブ通知 | ◎ |
| 2 | Telegram Bot(既存 PC1 MIYU 基盤を流用) | Telegram API + Apps Script 等 | ◎(Telegram アプリ必要) | △ 家族にスマホ音痴がいる、 Telegram 導入ハードル |
| 3 | Web Push API(PWA + Service Worker) | 自前 Push サーバー必要 | iOS 16.4+ PWA インストール時のみ | △ iOS 制約、 バックエンド必要 |

### 5.3 推奨: 案1 Google Calendar Event リマインダー

#### 5.3.1 根拠

1. **FE 完結を維持**(§2 バックエンド方針との整合)、 自前 Push サーバー不要
2. **仕様書 v1.4 §7 と整合** — そもそも通知インフラとして Calendar Event を選択していた経緯がある
3. **OS ネイティブ通知** — iOS / Android 標準の通知 UI、 IT 音痴ユーザーにも馴染みやすい
4. **Telegram 不要** — 家族テスター([[feedback_ux_three_layer]])に Telegram 導入を強いずに済む
5. **MIYU 専用カレンダー**(仕様書 §7.3 自動作成)を活用可、 ユーザーのメインカレンダーを汚染しない

#### 5.3.2 設計フロー

```
PWA 起動時(または1日1回バッチ):
  1. MIYU 専用カレンダー(初回起動時に作成済み)に
     「MIYU - 18:00 タスク見直し」 イベントを翌日分(または今日 18:00 前)作成
  2. リマインダー: { method: 'popup', minutes: 0 } で 18:00 ジャストに通知
  3. イベント本文に「📱 アプリを開いて MIYU と整理しよう」 リンク
  4. 既存の同イベントがあれば更新、 重複作成しない

18:00 ユーザーのスマホで通知発火:
  1. OS の Calendar 通知が表示
  2. ユーザーがタップ → ブラウザ or PWA 起動
  3. PWA が「コーチングモード」 で起動
     - Google Tasks から未完了タスクを取得
     - ランク別に集計(A:○件、 B:○件、 C:○件、 D:○件)
     - 選択中キャラの口調でプッシュメッセージ生成
  4. MIYU / セバスチャン がチャット冒頭で発言
```

#### 5.3.3 設定可能項目

- **通知時刻**: 18:00 デフォルト、 設定画面で調整可(時刻スライダー)
- **通知頻度**: 毎日 / 平日のみ / カスタム曜日
- **通知 OFF**: 設定で完全に切れる
- **通知条件**: 「未完了タスクがある日のみ」(デフォルト) / 「毎日(タスクなしでも声かけ)」

### 5.4 副案 — Telegram Bot 連携(将来オプション)

ベータ v1.0 後の v1.1 で、 たかしさん本人(パワーユーザー)向けに Telegram Bot 連携をオプション追加可能。 PC1 既存 MIYU の Telegram Bot 基盤と統合する道筋。 ベータ v1.0 では不要。

### 5.5 Web Push API は本筋ではない

- iOS 16.4+ + PWA インストール状態でしか動かない、 家族の環境制約大
- 自前 Push サーバー必要、 §2 FE完結方針と矛盾
- ベータ v1.0 では除外、 商品化版で再検討

---

## 6. タスク管理コーチング機能(v0.3 §2 から継承、 リナンバー)

### 6.1 要件整理(指示書 §2.2 / §2.3 / §3.1)

- ランク別(A/B/C/D)の促し方
- 「これCランクだけど、まだやる予定ある?」(削除提案)
- 「Aの〇〇、いつやる?」(実施日決定促進、 ただし時刻指定不要)
- 「すぐできないならBに下げる?」(ランク変更促進)
- 「重要じゃないならC?」(ランク変更促進)
- **キャラ別口調で発動**(MIYU 砕け / セバスチャン フォーマル)

### 6.2 プッシュロジック設計

#### 6.2.1 起動時のタスク状態分析

PWA がコーチングモードで起動すると、 サービス層が以下を計算:

```typescript
interface TaskCoachingContext {
  // ランク別集計
  countByRank: { A: number; B: number; C: number; D: number };
  // ランク × 経過日数
  staleTasks: {
    A: Task[];  // 3日以上経過した A
    B: Task[];  // 7日以上経過した B
    C: Task[];  // 7日以上経過した C(削除候補)
    D: Task[];  // 7日以上経過した D(削除候補)
  };
  // 期限切れタスク
  overdue: Task[];
  // 今日完了したタスク
  completedToday: Task[];
}
```

#### 6.2.2 プッシュ優先順位ロジック

以下の順序で、 1回のコーチング内で最大3〜4論点を取り上げる(情報過多回避):

| 優先 | トリガー | プッシュ内容 |
|---|---|---|
| 1 | 期限切れタスクあり | 「期限過ぎてるやつあるよ、 どうする?」 |
| 2 | A ランクで 3日以上経過 | 「Aの〇〇、 いつやる?」 |
| 3 | B ランクで 7日以上経過 | 「Bの〇〇、 A に上げる? C に下げる?」 |
| 4 | C/D ランクで 7日以上経過 が3件以上 | 「C/D で溜まってるやつ、 整理しよ?」 |
| 5 | 今日完了タスクあり | 「今日 〇〇 終わったね、 お疲れ!」(肯定的締め) |

優先 1 〜 4 を順に取り上げ、 最後に 5 で肯定的に締める(MIYU/セバスチャン キャラ共通の「ジャッジしない」 軸との整合)。

#### 6.2.3 ユーザー回答の受け取り

各プッシュ項目に対して、 ユーザー回答は 3択ボタン式UI(仕様書 §22 / v1.5 §22 本文化と整合)で受け取る:

| プッシュ | 3択ボタン |
|---|---|
| 「いつやる?」(A 滞留) | ①今日 / ②明日 / ③今週中 / ④もう少し考える |
| 「ランク変えるか?」(B 滞留) | ①A に上げる / ②C に下げる / ③そのまま |
| 「整理する?」(C/D 滞留) | ①消す / ②残す / ③1件ずつ確認 |
| 「期限過ぎてるが」 | ①完了にする / ②期限延ばす / ③消す |

### 6.3 キャラ別プッシュ口調

(v0.3 §2.3 から継承、 内容は Phase 2 Sprint 1 コーチングMD 2本セット v0.1 に正式版あり)

### 6.4 「いつやる?」 への回答 と 時刻指定の扱い

(v0.3 §2.4 から継承、 メモ退避案で吸収)

### 6.5 ベータ v1.0 のスコープ範囲

(v0.3 §2.5 から継承)

---

## 7. キャラクター選択UI(v0.3 §3 から継承、 §7.3 を修正)

### 7.1 v0.2 §6A から追加する点

- 各キャラに「コーチングテンプレート(coaching.md)」 を紐付け
- キャラ選択画面でユーザーが選んだキャラ ID を保存、 コーチングモード起動時に
  そのキャラのテンプレートを使用
- キャラ切り替えは「設定画面 → キャラクター選択」 でいつでも可、 切り替え直後
  からコーチング口調が変わる

### 7.2 キャラメタデータ JSON 更新案

`MIYU_App_Data/config/characters/index.json`:

```json
{
  "characters": [
    {
      "id": "miyu",
      "displayName": "MIYU",
      "characterMdPath": "config/characters/miyu.md",
      "coachingMdPath": "config/characters/miyu.coaching.md",
      "voicevoxSpeakerId": 1,
      "voicevoxCreditLine": "VOICEVOX:ずんだもん",
      "description": "ギャル口調、 親友のように対等",
      "bundledInBeta": true
    },
    {
      "id": "sebastian",
      "displayName": "セバスチャン",
      "characterMdPath": "config/characters/sebastian.md",
      "coachingMdPath": "config/characters/sebastian.coaching.md",
      "voicevoxSpeakerId": 13,
      "voicevoxCreditLine": "VOICEVOX:青山龍星",
      "description": "ベテランコンシェルジュ、 静かな観察と丁寧な助言",
      "bundledInBeta": true
    }
  ]
}
```

### 7.3 PC1 既存 MIYU との関係 — 同期不要、 完全別物として並走【v0.4 修正】

**v0.3 §3.3 では「InvokeAide が source、 PC1 既存 MIYU は読み取り」 の単方向同期を提案しましたが、 Q17 確定により「同期不要・完全別物として並走」 に修正します**(CLAUDE.md §9「自分の誤認を隠さない」 運用)。

#### 7.3.1 確定方針(Q17、 CLAUDE.md §1.4 整合)

- **PC1 既存 MIYU(たかしさん個人用、 Aさん・Bさん 管理)** と **InvokeAide(商品化版、 Sさん・Tさん 管理)** は **完全に別物として並走**
- **コードベース完全分離**(CLAUDE.md §6)、 character.md / coaching.md も別物として独立管理
- 共有は **ドキュメント・知見ベースのフィードバック** のみ(CLAUDE.md §1.4「現行版での改善 → 汎用にフィードバック」)

#### 7.3.2 設計上の含意

- **同期インフラ不要**: InvokeAide 側で character.md / coaching.md を独立管理、 Drive 完結
- **編集競合の心配なし**: 両プロジェクトが互いに read もしない
- **設計判断の独立性**: InvokeAide は商品化前提の設計判断(汎用性、 BYOK、 法的要件等)を遠慮なく行える、 PC1 既存 MIYU の個人用ニーズに引きずられない
- **共通の哲学は維持**: 思想書 v0.1 / 共通核 4軸(ジャッジしない / 疲れない / 本質鋭い / 答え押し付けない)は両プロジェクトで共有(これは「知見ベース」 共有)

#### 7.3.3 v0.3 認識訂正の経緯

v0.3 を起草した時点(2026-05-18)で、 私は「PC1 既存 MIYU と InvokeAide はキャラクター定義を共有すべき」 と仮定していました。 この仮定は **両プロジェクトの境界線設計を読み違えていた** ものです:
- たかしさんは PC1 既存 MIYU を「個人用」 として継続充実、 InvokeAide を「商品化版」 として独立展開する設計判断を持っていた
- 共有すべきは「思想・知見」 であり、 「実装データ(character.md)」 ではない
- 商品化版の設計判断が個人用版に引きずられる構造は、 むしろ汎用性を損なう

これは feedback メモリ [[feedback_publicity_and_concept_check]]「コアコンセプト整合チェックを各設計レイヤーで独立に」 の運用テストでもあり、 「PC1 とのデータ共有は便利機能だが、 InvokeAide のコアコンセプト『商品化版』 と整合しているか」 のチェックを省略していたことに気づきました。

---

## 8. スプリント計画再評価(v0.3 §4 から継承、 リナンバー)

### 8.1 工数増加の見積もり

v0.2 §12.1 比で、 コーチング機能 + 通知設計の追加で 約 1〜1.5週間 の工数増加(v0.3 §4.1 と同じ表)。

### 8.2 更新後スプリント計画(3人体制)

(v0.3 §4.2 と同じ表)

### 8.3 信頼度評価

(v0.3 §4.3 と同じ評価、 楽観 5割 / 標準 7割 / 悲観 2割)

### 8.4 Uさん スコープ案の更新

(v0.3 §4.4 と同じ表)

### 8.5 「コーチング機能は削れない最優先項目」 として位置付け

(v0.3 §4.5 と同じ整理、 削減順位: VOICEVOX > セバスチャン > VOICEVOX + セバスチャン)

---

## 9. Sさん 視点での所感(v0.3 §5 から継承、 §9.2 を修正)

### 9.1 設計上の小さなテンション — 「期限のみ」 vs 「いつやる?」

(v0.3 §5.1 と同じ、 メモ退避案で吸収)

### 9.2 PC1 既存 MIYU との関係 — 同期不要・完全別物として並走【v0.4 修正】

**v0.3 §5.2 では「単方向同期を推奨」 と書きましたが、 Q17 確定により「同期不要・完全別物として並走」 に修正します**(§7.3 と整合、 CLAUDE.md §9 運用)。

設計判断としての含意:
- InvokeAide は商品化版として独立した設計判断を遠慮なく行う
- PC1 既存 MIYU(Aさん・Bさん 管理)の個人用ニーズに引きずられない
- 共通の哲学(思想書 v0.1、 共通核 4軸)は「知見ベース」 で共有、 「データベース」 では共有しない
- Aさん/Bさん との擦り合わせは「設計判断の独立性を保ったまま、 思想・知見のフィードバックループのみ維持」、 これはエルトン経由で調整

私の v0.3 §5.2 単方向同期提案は **両プロジェクトの境界線設計の読み違い** であり、 訂正します(§7.3 末尾の経緯参照)。

### 9.3 ランク自動付与(仕様書 §17.4)はベータでは「提案」 まで

(v0.3 §5.3 と同じ、 ベータでは「これ C ランクっぽいけどどう?」 提案まで)

### 9.4 プッシュ頻度の過剰化リスク

(v0.3 §5.4 と同じ、 v1.1 で対策、 クールダウン / 完了肯定の比重 / 控えめモード設定)

### 9.5 エルトン §2.1 経緯への共感

(v0.3 §5.5 と同じ、 コアコンセプト整合チェックの自己反省)

### 9.6 私からの異論はなし

(v0.3 §5.6 と同じ、 大方針への異論なし、 細部・運用上の懸念のみ)

### 9.7 v0.4 で新たに気づいた所感【新規】

#### 9.7.1 4項目を独立章化したことで見えた構造的な整合性

§1〜§4 を厚く書き直したことで、 4項目が **adapter pattern という1つの設計思想で統一されている** ことが見えました:
- LLM 抽象化: AIProvider interface(§3)
- STT 抽象化: STTProvider interface(§4)
- TTS 抽象化: TTSProvider interface(§2.10)
- Storage 抽象化: StorageProvider interface(Phase 2 Sprint 1 Interface契約 v0.1)
- Auth 抽象化: AuthProvider interface(同上)
- Notify 抽象化: NotifyProvider interface(同上)

「**全 Provider が同じ adapter pattern で書かれる**」 = 学習コスト最小、 各 Provider 差し替え可能、 法的要件「未来縛らない原則」 構造的担保。 これは v0.3 時点では「FE完結」「Drive完結」 等の個別原則の集合体として見えていましたが、 v0.4 で再整理することで「**provider 化原則**」 という上位概念が浮かび上がりました。

#### 9.7.2 BYOK 認知負荷の管理が STT 選定の決め手だった

§4 で STT の選定根拠を整理する中で、 「BYOK 認知負荷の最小化」 が決定的な観点だと気づきました。 ベータ家族テスター層に対して **API キー登録を何回求めるか** が UX の生命線で、 1回(Gemini のみ)で済むなら音声の精度は犠牲にできる、 という優先順位。 これは商品化版で「BYOK を OAuth に置き換える」 構想と整合します(別途検討、 今回スコープ外)。

#### 9.7.3 「未来縛らない原則」 の言語表現が contract と Privacy Policy をつなぐ

§3.8 / §4.8 で「未来縛らない原則」 の表現例を書きながら気づきましたが、 これは:
- **contract レベル**: interface + 「Claude / OpenAI Provider は contract 互換 stub のみ」
- **言語表現レベル**: 「現時点で対応しています / 将来検討しています」

の **2層構造** で初めて成立します。 contract だけだと言語が断定的になり、 言語だけだと contract に裏打ちがない。 両方揃って「実装と法務の整合」 が取れます。 これは [[feedback_test_三位一体]]「言った/実装した/テストした」 と同じ構造で、 法務にも適用される観点だと感じました。

---

## 10. リスク・トレードオフ(v0.3 §6 から継承、 4項目関連を追加)

### 10.1 主要リスク

| # | リスク | 影響度 | 対処 | 起源 |
|---|---|---|---|---|
| FE-1〜FE-3 | フロントエンド関連 | 🟢🟡 | §1.6 参照 | v0.4 新規 |
| BE-1〜BE-4 | バックエンド関連 | 🟡 | §2.9 参照 | v0.4 新規 |
| LLM-1〜LLM-4 | LLM 抽象化関連 | 🟡 | §3.9 参照 | v0.4 新規 |
| STT-1〜STT-4 | STT 関連 | 🟡 | §4.9 参照 | v0.4 新規 |
| 10 | Calendar Event 自動作成の OAuth スコープ拡張 | 🟡 | 段階的同意取得 | v0.3 から継承 |
| 11 | プッシュ頻度過剰でユーザーが通知 OFF | 🟡 | §9.4 対策 | v0.3 から継承 |
| 12 | 18:00 通知が「仕事終わり」 でない人に不適合 | 🟡 | 設定画面で時刻調整 | v0.3 から継承 |
| 13 | 家族テスター(IT 音痴)が通知に応じない可能性 | 🟡 | 模擬テストで導線確認 | v0.3 から継承 |
| 14 | Tasks/Calendar API レート制限 | 🟢 | モックで開発、 実 API は Sprint 末集中検証 | v0.3 から継承 |

### 10.2 トレードオフ

1. **コーチング機能の充実 vs スプリント計画の現実性**: 機能優先で +1〜1.5週間、 7/4-7/5 配布信頼度が 7割
2. **「期限のみ」 vs ユーザー時刻表現**: §9.1 メモ退避で吸収、 シンプル維持
3. **プッシュ口調の差別化 vs character.md 肥大化**: 別ファイル化(§6.3) で解消
4. **【v0.4 新規】Vue 3 採用 vs React の業界標準**: ベータ規模では Vue 3 が最適、 商品化拡大時の移行余地は残す
5. **【v0.4 新規】LLM 抽象化を自作 vs LangChain 等の SDK 採用**: 自作 interface で bundle size と BYOK 相性を優先、 高機能フレームワークは不採用
6. **【v0.4 新規】STT 精度 vs BYOK 認知負荷**: 認知負荷最小化を優先、 OS 標準 STT、 精度向上は v1.1 検討
7. **【v0.4 新規】PC1 既存 MIYU とのデータ同期 vs 設計独立性**: 同期不要・完全別物として並走、 設計独立性を優先(Q17 確定、 §7.3)

---

## 11. たかしさんに判断を仰ぎたい事項

### 11.1 v0.4 新規(4項目関連)

| # | 事項 | Sさん 感触 |
|---|---|---|
| **Q22** | フロントエンド: Vue 3 + TypeScript + Vite + Pinia + Vue Router で確定 OK か(§1) | 推奨、 v0.3 から継続 |
| **Q23** | バックエンド: 二層構造(層 1 サーバーレス + 層 2 VOICEVOX Cloud Run)で確定 OK か(§2) | 推奨、 §5.1 確定と整合 |
| **Q24** | LLM 抽象化: AIProvider interface(adapter pattern)、 初期 GeminiProvider のみ実装 + Claude/OpenAI stub で確定 OK か(§3) | 推奨、 法的要件 §4.1 と整合 |
| **Q25** | STT: Web Speech API + STTProvider interface 準備で確定 OK か(§4) | 推奨、 BYOK 認知負荷最小化 |
| **Q26** | 「未来縛らない原則」 の言語表現例(§3.8 / §4.8)を Privacy Policy / 利用規約 起草時に法的書類 v0.4(エルトン起草中)へ反映依頼してよいか | 推奨、 contract と Privacy Policy の整合のため |

### 11.2 v0.3 から継承(コーチング機能関連)

| # | 事項 | Sさん 感触 | v0.4 補足 |
|---|---|---|---|
| Q13 | 通知設計案1(Calendar Event)で確定 OK か | 推奨 | v0.3 から継続 |
| Q14 | プッシュ優先順位ロジック(§6.2.2)で OK か | 推奨 | v0.3 から継続 |
| Q15 | プッシュテンプレートを character.md から別ファイル化で OK か | 推奨 | Sprint 1 で確定済 |
| Q16 | 「いつやる?」 時刻入り回答はメモ退避で OK か(§9.1) | 推奨 | v0.3 から継続 |
| ~~Q17~~ | ~~PC1 既存 MIYU との同期は単方向で OK か~~ | **確定済(同期不要・完全別物として並走、 §7.3 / §9.2)** | **v0.4 で認識訂正** |
| Q18 | ランク自動付与は「提案 + 3択受諾」 で OK か(§9.3) | 推奨 | v0.3 から継続 |
| Q19 | スプリント計画再評価(§8.2)、 配布信頼度 7割で OK か | 進めるなら推奨、 ゲート維持 | v0.3 から継続 |
| Q20 | コーチング機能を「削れない最優先項目」 として位置付け(§8.5)で OK か | 推奨 | v0.3 から継続 |
| Q12(再) | Phase 2 第1スプリント着手指示は v0.3 承認後に出すか | 着手済(2026-05-19 GO)、 Sprint 1 整合性チェック v0.1 で完了確認済 | **v0.4 では確定済として扱う** |

---

## 12. 副次的に気づいた課題

### 12.1 仕様書 v1.5 への反映依頼

エルトン側で仕様書 v1.5 本文化時に新章追加推奨(v0.3 §8.1 から継承):
- 第 X 章「コーチング機能」(通知設計 + プッシュロジック + キャラ別口調)
- 第 X 章「タスク管理(ランクA/B/C/D)」
- §22「入力UX」 にコーチング 3択ボタン回答UI を含める

**【v0.4 追加】**:
- 第 X 章「技術スタック」 として §1〜§4 の選定根拠を仕様書 v1.5 本文に章立て(v0.4 を別文書として参照する形でもよい)
- §11「第三者AIサービス抽象化」 として AIProvider interface 設計を法的要件と紐づけて記載

### 12.2 法的書類 v0.4 への反映依頼

法的書類 v0.4(エルトン起草中、 起草指示書 v0.3 に基づく)に以下を反映依頼:
- Privacy Policy「音声合成のため一時的に処理、 保存しない」(§2.8)
- Privacy Policy「音声入力データの OS ベンダー送信」 明示開示(§4.7 / §4.8)
- 利用規約「現時点で Gemini に対応、 将来 Claude / OpenAI 等を検討」(§3.8)
- 法的書類 v0.4 の起草スケジュールはエルトンから別途共有想定

### 12.3 Tさん テスト戦略 v0.2 への影響

(v0.3 §8.3 から継承)

**【v0.4 追加】**:
- AIProvider contract テスト(stub 含む)
- STTProvider contract テスト
- TTSProvider contract テスト(VOICEVOX + Web Speech フォールバック切替)
- Provider 互換性テスト(将来 Claude / OpenAI 追加時の回帰防止)

### 12.4 iOS Safari 落とし穴集 v0.2 への追記候補

(v0.3 §8.4 から継承)

**【v0.4 追加】**:
- Vue 3 + Vite + vite-plugin-pwa の iOS Safari 固有挙動
- Web Speech API の iOS Safari 制約(継続認識・マイク権限リセット)の実機検証結果

### 12.5 feedback メモリ更新候補(自己メンテ)

v0.4 §9.7.1〜9.7.3 で気づいた以下を、 たかしさん許可を得てから feedback メモリ化候補として記録:
- 「**Provider 化原則**」 を上位概念として扱う(adapter pattern 統一)
- 「**BYOK 認知負荷の管理**」 がベータ家族テスター層 UX の生命線
- 「**未来縛らない原則 = contract + 言語表現の2層構造**」 が法務と実装の整合の鍵

新ルール適用中、 追加保存はたかしさん許可を得てから(本書 §11 末尾の Q27 として打診):

**Q27**: 上記 3 観点を feedback メモリに追加してよいか

---

## 13. 完了報告フォーマット(STさん指示書 §9 / CLAUDE.md §7 準拠)

```
[完了報告: Phase 1 Step 3 v0.4(技術選定報告、 CLAUDE.md §5.2 4項目 確定版)]
完了日時: 2026-05-21(木) 午前
所要時間: 起草約3〜4時間(v0.3 継承部分 + 4項目章新規 + §7.3 / §9.2 修正)
成果物のファイルパス: C:\dev\InvokeAide\docs\Phase1\Phase1_技術スタック決定提案_v0.4_2026-05-21.md
旧記録: C:\dev\InvokeAide\docs\Phase1\Phase1_技術スタック決定提案_v0.3_2026-05-18.md(部分陳腐化として残置、 CLAUDE.md §9 運用)

主要な発見 / 判断:
  - 4項目を独立章化することで、 全 Provider が adapter pattern という1つの設計思想で
    統一されていることが構造的に見えた(§9.7.1「Provider 化原則」)
  - フロントエンド: Vue 3 + TypeScript + Vite + Pinia + Vue Router(§1)
  - バックエンド: 二層構造、 層 1 サーバーレス + 層 2 VOICEVOX Cloud Run(§2)
  - LLM 抽象化: AIProvider interface、 初期 GeminiProvider のみ実装 + Claude/OpenAI stub(§3)
  - STT: Web Speech API + STTProvider interface 準備、 BYOK 認知負荷最小化(§4)
  - PC1 既存 MIYU との関係: v0.3 単方向同期提案を Q17 確定「同期不要・完全別物」 に
    修正、 認識訂正を §7.3 / §9.2 に明記(CLAUDE.md §9 運用)
  - 「未来縛らない原則」 が contract + 言語表現の2層構造で初めて成立する観点を明文化
    (§9.7.3)

推奨する次のアクション:
  - 本書レビュー、 §11 Q22〜Q27 + v0.3 継承 Q の判断(5/26 議論前に確定希望)
  - 法的書類 v0.4(エルトン起草中)に §12.2 反映依頼
  - 仕様書 v1.5 本文化に §12.1 反映依頼(エルトン主導)
  - Uさん 内容レビュー(指示書 §3 補足、 Sさん 報告後)
  - Tさん テスト戦略 v0.2 への新論点反映(§12.3)

たかしさんに判断を仰ぎたい事項: 本書 §11 に 6 + 7点(Q22〜Q27 新規 + Q13〜Q20 継承)

副次的に気づいた課題: 本書 §12 に 5点
```

---

## 14. 変更履歴

| 版 | 日時 | 変更内容 | 起草者 |
|---|---|---|---|
| v0.1 | 2026-05-18(月) 朝 | 初版起草 | Sさん(Sonnet) |
| v0.2 | 2026-05-18(月) 昼 | 重要方針変更4点反映(VOICEVOX 採用、 キャラ選択UIベータ繰上、 Vue 3 動作軽さ根拠補足、 Drive 完結) | Sさん(Sonnet) |
| v0.3 | 2026-05-18(月) 夜 | コーチング機能追加(通知設計、 タスク管理コーチング)、 キャラ別プッシュ口調統合、 スプリント計画再評価、 Sさん 視点の所感、 リスク・Q・課題更新 | Sさん(Sonnet) |
| **v0.4** | **2026-05-21(木) 午前** | **CLAUDE.md §5.2 4項目を §1〜§4 として独立章化(FE / BE / LLM 抽象化 / STT、 各章「選定 + 根拠 + 却下案理由」 を網羅)、 §7.3 / §9.2 で PC1 既存 MIYU 単方向同期記述を Q17 確定「同期不要・完全別物として並走」 に修正、 v0.3 §1〜§10 を §5〜§14 にリナンバー継承、 §11 に Q22〜Q27 新規追加、 §10 に FE/BE/LLM/STT リスク追加、 §9.7 に v0.4 新規所感3点追加** | **Sさん(Sonnet)** |

---

**以上、 Sさん(Sonnet) Phase 1 Step 3 v0.4 改訂版報告終わり。**

本書提出後は完了報告(CLAUDE.md §7 フォーマット、 §13 参照)を別途出します。 純粋待機モードに戻ります。

(個人メモ) 本書 §12.5 / §11.1 Q27 で示唆した feedback メモリ追加 3観点(Provider 化原則 / BYOK 認知負荷管理 / 未来縛らない原則 = 2層構造)は、 たかしさん許可を得てから実行します。
