# 引き継ぎ帳：InvokeAide ── 2026-06-02

**作成**: 技術顧問エルトン（Claude.ai）
**宛先**: 次回チャットのエルトン
**担当CC**: PC2（ノートPC）/ InvokeAide開発担当（Sさん・Tさん・Uさん）
**リポジトリ**: github.com/Novemin/InvokeAide（private）

---

## ⚠️ 次回の最優先：2e-1（競合検知メカニズムの確定）

2eは本丸（PendingQueueStore・ConflictResolver・LWW競合検知）。
**まず2e-1の設計判断から入ること**。これが決まらないと2e-3/2e-5が宙に浮く。

### 2e-1で決めるべきこと

現状、`etagMap` に入っているのは Drive の `version`（整数）で、
HTTP `If-Match` が期待する ETag とは別物。

Drive API v3 は `files.update` に対する `If-Match` を v2ほど素直にサポートしない可能性があるため、
現実的なLWWは「書き込み直前に version/modifiedTime を再取得して比較（read-before-write の楽観ロック）」になる可能性が高い。

**次回エルトンがやること**：
1. Drive API v3 の条件付き更新仕様を調査
2. Uさんに方式を提示して確定
3. 必要であればSさんに実機確認を依頼

---

## 本日の成果（全てcommit/push済み）

| commit | 内容 | 担当 |
|---|---|---|
| 7e8ebe3 | DriveStorageProvider 段階2a（キャッシュ層） | U |
| 5203383 | DriveStorageProvider 段階2b（profile/index/manual load-save） | U |
| 11c49f9 | DriveStorageProvider 段階2c（bundledアセット＋キャラMD） | U |
| 2bf1f7f | DriveStorageProvider 段階2d（履歴系） | U |
| 5174f25 | check:coaching 対象ディレクトリ追加 | T |

**注意**: push は未実施（全commit はローカルmainのみ）。次回セッション開始時にpushするか確認。

---

## B2実装の現在地

| ユニット | 状態 |
|---|---|
| IndexedDbSecretStore | ✅ 完成 |
| GoogleAuthProvider | ✅ 完成 |
| DriveStorageProvider 段階1 | ✅ 完成 |
| DriveStorageProvider 段階2a（キャッシュ層） | ✅ 完成 |
| DriveStorageProvider 段階2b（profile/index/manual） | ✅ 完成 |
| DriveStorageProvider 段階2c（bundledアセット＋キャラMD） | ✅ 完成 |
| DriveStorageProvider 段階2d（履歴系） | ✅ 完成 |
| DriveStorageProvider 段階2e（オフライン＋競合） | 🔴 未着手（次回本丸） |
| DriveStorageProvider 段階2f（watch＋SyncState） | 🔴 未着手 |
| VoicevoxTTSProvider | スケルトンのみ |

---

## 2cで確定したbundledキャラクター情報

| id | displayName | voicevoxSpeakerId | description |
|---|---|---|---|
| miyu | ギャル秘書 MIYU | 春日部つむぎ（暫定ID:8） | みゆだよ、明るく軽やかなノリで、予定もタスクも人間関係もまとめて先読みするギャル系天才秘書です。 |
| bro | コーチング秘書 兄ちゃん | 雀松朱司（暫定ID:52・確度低） | 兄ちゃんだ、あなたの可能性を信じ、行動力と自信に火をつける情熱型のコーチング秘書だ。 |
| sebastian | 熟練コンシェルジュ秘書 セバスチャン | 剣崎雌雄（暫定ID:21） | セバスチャンでございます、長年の経験と冷静な判断で、あなたが進むべき道を静かに整えるベテランコンシェルジュです。 |

**要実機確認**：voicevoxSpeakerId は暫定数値。特にbro=52は確度低。Sさんが `/speakers` で実機確認する。

---

## 残課題（PENDING）

| 課題 | 内容 | 優先度 |
|---|---|---|
| **2e-1 競合検知方式の確定** | Drive API v3のIf-Match仕様調査 → Uさんと確定 | 最高・次回冒頭 |
| **2e-2 PendingQueueStore** | internal/配下に新規作成 | 高 |
| **2e-3 ConflictResolver** | internal/配下に新規作成 | 高 |
| **2e-4 offline書込み＋flushPending＋getSyncState** | 2e-2/2e-3完了後 | 高 |
| **2e-5 全save系へのLWW一貫配線** | 2e-1/2e-3完了後 | 高 |
| **2f watchSettings/watchSyncState** | 2e完了後 | 中 |
| index.tsのwiring未接続 | 初回Drive seeding・loadCharacterIndexのbundled fallback | 中 |
| voicevoxSpeakerId実機確認 | Sさん領域 | 中 |
| contract v0.2の6件修正（C1〜C6） | Sさん領域 | 中 |
| 単体テストのMock配置 | tests/mocks vs tests/helpers、Tさん確認事項 | 中 |
| 仕様書v1.5改訂（エルトン宿題） | §7.3「専用カレンダー自動作成」→「メインカレンダー集約」等 | 高 |

---

## 運用メモ

- **Uさんの再起動**：今日は2a〜2dまで長時間稼働。次回は引き継ぎメモを読ませてからクリーンな状態で2e-1に入ること
- **push未実施**：全commitはローカルのみ。次回セッション開始時に `git push` するかたかしさんに確認
- **指示文の鉄則**：①設計原典を参照させる ②実装前に現状確認を報告させる ③スコープ外を明示 ④commitせず報告まで
- **check:coachingのパス**：src/assets/characters が追加済み（Tさん、5174f25）

---

## 次回の入り

1. このチャットを開いたらまずエルトンが Drive API v3 の条件付き更新仕様を調査
2. Uさんを再起動して現状確認報告を受ける
3. 2e-1の方式を確定してGOを出す
4. push未実施の確認（たかしさんに）
