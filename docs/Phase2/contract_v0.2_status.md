# contract v0.2 main マージ完了

**マージ日**: 2026-05-26
**main commit**: `263d408 feat(interfaces): apply contract v0.2 (C1-C6 from Q-U-j answers)`
**source branch**: `feature/contract-v0.2`(残置、 後日整理)

---

## Uさん 着手時の合図

**contract v0.2 が main に入りました。 暫定 local 定義 を contract import に切替可能です。**

### 切替対象(C1〜C6 全件、 詳細は Q-U-j 回答メモ §10)

```typescript
// 切替前(暫定 local 定義)
interface SecretStoreDeps { clock: Clock; logger?: Logger }

// 切替後
import type { SecretStoreDeps } from '@/interfaces/SecretStore';
```

| # | 切替 import 例 |
|---|---|
| C1 | `import type { SecretStoreDeps } from '@/interfaces/SecretStore'` |
| C2 | `import type { StageChangeCause } from '@/interfaces/AuthProvider'` |
| C3 | (新規メソッド)`getGrantedScopes()` を AuthProvider impl に実装 |
| C4 | (union 拡張)`'bundled'` 値を DriveStorageProvider impl で使用 |
| C5 | (union 拡張)`'speaker_required'` を VoicevoxTTSProvider impl で返却 |
| C6 | `import type { TTSCapabilities, PlayResult } from '@/interfaces/TTSProvider'`、 `capabilities` プロパティを実装側で必須宣言 |

### ベータ v1.0 確定

- **VoicevoxTTSProvider のみ実装**(`capabilities: { synthesize: true, synthesizeAndPlay: false }`)
- WebSpeechTTSProvider は **v1.1 以降**(ベータでは未実装)

### 詳細リンク

- `docs/Phase2/Phase2_QUj_Sさん_contract確認回答_v0.1_2026-05-26.md` §10(※ `feature/quj-s-answers` ブランチ、 main 取り込みは別途指示待ち)
- `docs/Phase2/B2_contract引き継ぎメモ_Sさん_to_Uさん_2026-05-24.md`(§6.2 WebSpeech 論点は本 v0.2 で解消済 = 案 Z 採用)

---

## 取り決め(再掲)

- 実装コード本体は **GO-C 維持**(Uさん 着手は技術顧問の GO サインで)
- 着手順序: SecretStore → AuthProvider → DriveStorageProvider → VoicevoxTTSProvider(Sさん 引き継ぎメモ §7、 Uさん 実装設計 v0.1 §7.1)
