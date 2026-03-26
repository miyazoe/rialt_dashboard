# 経営ダッシュボード — タスク & 仕様管理

> このファイルは **プロジェクトの目的・画面構成・実装済み機能** を記録する。
> 新しい画面・機能を追加したら必ず末尾の「変更ログ」を更新すること。

---

## プロジェクト概要

| 項目 | 内容 |
|---|---|
| 目的 | 経営者・幹部が週次報告書と月次PL実績を素早く把握するためのダッシュボード |
| 対象ユーザー | 経営者・幹部 / 経営企画・事務局 |
| 形式 | 単一 HTML ファイル（+ データJS）、サーバー不要でブラウザで開くだけ |
| データ更新 | 週次：NotebookLM → インポート / 月次：CSVから generate_rialt.py で生成 |

---

## ファイル構成

| ファイル | 役割 | サイズ目安 |
|---|---|---|
| `index.html` | メインアプリ本体（HTML + CSS + JS） | ~19万文字 |
| `data.js` | 週次TOP報告データ（`window.DASHBOARD_DATA`） | 週次追記 |
| `rialt_data.js` | RIALT月次PLデータ（`window.RIALT_DATA`） | ~17MB |
| `resort_table.js` | TGR月次PLフラットテーブル（`window.RESORT_TABLE`） | ~1MB |
| `generate_rialt.py` | CP932 CSV → rialt_data.js 生成スクリプト | — |
| `tools/generate_resort_table.py` | TGR xlsx → resort_table.js 生成スクリプト | — |
| `tools/resort_gas.gs` | GAS Web App — 全施設日別売上集約エンドポイント | — |
| `notebooklm_prompt.md` | NotebookLM用プロンプト集（Prompt1 / Prompt2） | — |
| `data/tgr/` | TGR月次xlsxソースファイル（2024.xlsx + YYYYMM.xlsx） | — |

---

## 画面構成

### 外タブ構成

```
[RIALT] [TGR] [TOP]  ← TGRは全員表示、TOPはprivate-only
```

---

### TOP報告セクション（data.js 連携）

#### Tab1 — TOP_MSG（幹部メッセージ）

| パネルID | データソース | アクセントカラー |
|---|---|---|
| exec-ishibashi | source="石橋" | 黄 `#e3b341` |
| exec-nagata | source="永田" | 青 `#58a6ff` |
| exec-makikusa | source="牧草" | 緑 `#3fb950` |
| exec-uchiyama | source="内山" | オレンジ `#f0883e` |

#### Tab2 — 実務

| パネルID | データソース | アクセントカラー |
|---|---|---|
| resort | resort 配列 | ライトブルー `#79c0ff` |
| apparel | apparel 配列 | パープル `#bc8cff` |
| secretary | secretary 配列 | ピンク `#ff9bce` |
| ai | AIキーワード自動抽出 | シアン `#00e5cc` |

AIキーワード: `AI` / `人工知能` / `機械学習` / `生成AI` / `LLM` / `GPT` / `DX` / `自動化` / `データ基盤` / `デジタル化` / `SkipCart`

#### Tab3 — トピック

| パネルID | データソース | アクセントカラー |
|---|---|---|
| trends | trends 配列 | 青 `#58a6ff` |
| numbers | numbers 配列 | オレンジ `#f0883e` |
| anomalies | anomalies 配列（下段全幅） | 赤 `#f85149` |

#### Tab4 — プライベート

| パネルID | データソース | アクセントカラー |
|---|---|---|
| private | private 配列（2カラムグリッド、固定30件） | グレー `#8b949e` |

#### TOP報告 共通機能

- 自動ローテーション（Fisher-Yates シャッフル、デフォルト4件・60秒）
- 既読管理（localStorage: `dashboard_read_v1`）
- 全文検索（`/` でフォーカス、`Esc` でクリア、検索中はローテーション停止）
- インポート（File System Access API → data.js に直接書き込み）
- プロンプトコピー（P1ボタン: Prompt1 / P2ボタン: Prompt2）
- 週選択セレクトボックス（複数週切替、最新週がデフォルト）

---

### RIALTセクション（rialt_data.js 連携）

#### 内タブ: ダッシュボード

- KPI 5件（売上・荒利・管理可能費・経常利益の前年比 + 荒利率）
- 期間フィルター（直近12/24/36ヶ月 / カスタム開始〜終了月）
- Chart①: 売上・荒利・経常利益 月次推移（棒＋折線コンボ）
- Chart②: 費用比率内訳 積み上げ推移
- Chart③: 管理可能費率 vs 荒利率 散布図（目標ゾーン付き）
- Chart④⑤⑥: 構成比 円グラフ3枚（売上・荒利・経常利益）
- Chart⑦: ライン別 売上前年比／荒利率 横棒
- 階層フィルター（全体 / ブロック / ゾーン / エリア / 店舗 / ディビジョン / ライン / 部門）
- テーマ切替（A: Dark Financial / B: Modern SaaS / C: Professional Navy）

#### 内タブ: ドリルダウン

- 商品階層ドリル（ディビジョン → ライン → 部門）
- 店舗階層ドリル（ブロック → ゾーン → エリア → 店舗）
- SL（スタイルライン）別ドリル
- 在庫回転率・売上トレンドグラフ
- 各階層に 合計行（最上段）・全て行（最下段、下階層全件表示）

#### 内タブ: 単月分析

- 月選択セレクトボックス
- KPI 4件（売上高・荒利率・人件費率・経常利益率）
- ワースト20 商品テーブル（ディビジョン / ライン / 部門 切替）
- ワースト20 店舗テーブル（ブロック / ゾーン / エリア / 店舗 切替）
- ワーストメトリック: 売上 / 荒利 / 経常利益 / 人件費 / 在庫
  - 在庫: 期末在庫（千）/ 昨年期末在庫（千）/ 差（今-昨）/ 昨対比 / 在庫回転率
- Gemini AI分析パネル（前年比・市場比・ベンチマーク比、APIキーはSettings保存）

#### 内タブ: PL明細

- 条件セレクター（全社合計 / ブロック / ゾーン / エリア / 店舗 / ディビジョン / ライン / 部門）
- 会計年度ナビ（7月〜翌年6月、前年/翌年ボタン）
- 合計列（期間合計・加重平均）
- 前年対比モード切替（数値=今年/昨年% / 比率=今年-昨年 pt）
- 行折りたたみ（セクション単位）
- 全展開 / 全折りたたみボタン

#### RIALT データ構造

```js
window.RIALT_DATA = {
  months: ["202307", ...],
  monthly:    { "202307": { sales, gross, grossRate, labor, ... } },
  byBlock:    { "ブロック名": { "202307": {...} } },
  byZone:     { "B/Z":       { "202307": {...} } },
  byArea:     { "B/Z/A":     { "202307": {...} } },
  byStore:    { "B/Z/A/S":   { "202307": {...} } },
  byDivision: { "Div":       { "202307": {...} } },
  byLine:     { "Div/Line":  { "202307": {...} } },
  byDept:     { "Div/Line/Dept": { "202307": {...} } },
}
```

---

## 開発ルール・制約

### ファイル編集
- `Edit` / `Write` ツールは Windows で `EEXIST` エラーになるため**使用不可**
- **正しい手順**:
  1. `mcp__serena__create_text_file` で Python パッチスクリプトを作成
  2. `mcp__serena__execute_shell_command` で `py -3.12 script.py` を実行
  3. 確認後 `del script.py` で削除
  4. JS構文確認: JS部分を抽出して `node --check _chk.js`

### テーマ設計
- テーマCSS は `#outer-rialt.theme-X { --変数 }` にスコープ（TOP報告へ影響しない）
- Canvas チャートの背景・軸色は `_rialtChartBg()` / `_rialtAxisColor()` 等のヘルパー経由

### localStorage キー
| キー | 用途 |
|---|---|
| `dashboard_read_v1` | 既読管理 |
| `dashboard_settings_v2` | 設定（フォントサイズ・表示件数・インターバル） |
| `rialt_theme_v1` | RIALTテーマ設定 |
| `gemini_api_key_v1` | Gemini APIキー |

---

## 変更ログ

| 日付 | 追加・変更した画面/機能 | 担当 |
|---|---|---|
| 2026-03-16 | RIALT基盤（ドリルダウン・単月分析・PL明細）新規追加 | — |
| 2026-03-16 | RIALTダッシュボードタブ新規追加（KPI+Chart×4） | — |
| 2026-03-17 | PL明細: 前年対比モード・合計列・全展開ボタン追加 | — |
| 2026-03-17 | ダッシュボード: 円グラフ×3・期間フィルター・階層フィルター追加 | — |
| 2026-03-17 | 単月分析: Gemini AI分析パネル追加 | — |
| 2026-03-17 | テーマ切替（A/B/C）追加・Canvas チャート対応 | — |
| 2026-03-17 | ドリルダウン: 合計行・全て行追加・全てからの戻り対応 | — |
| 2026-03-17 | スキャンライン（横縞）削除 | — |
| 2026-03-19 | 単月分析ワースト: 在庫メトリック追加（期末在庫・昨対比・回転率） | — |
| 2026-03-20 | 公開モード（`?public`）実装 — TOP報告・設定・P1/P2・インポート・検索を非表示、data.js動的ロード | — |
| 2026-03-20 | GitHub Pages デプロイ（trial-dx/rialt_dashboard）— `?public` URLで外部公開 | — |
| 2026-03-20 | config.js 追加 — Gemini APIキーをファイルで管理、getGeminiKey()でlocalStorage→config.jsの順にフォールバック | — |
| 2026-03-23 | SLドリルダウン修正 — データなし階層（不在等）も子が存在すれば表示・ドリル可能に | — |
| 2026-03-24 | リゾートタブ用データ基盤構築 — TGR xlsx解析・フラットテーブル生成（旅館169列/ゴルフ169列）| — |
| 2026-03-24 | generate_resort_table.py — ADR/RevPAR削除・内訳保持（役員報酬・給与手当・広告宣伝費等）・見込み除外・旅館/ゴルフCSV分割 | — |
| 2026-03-25 | generate_resort_table.py バグ修正 — parse_pl の施設列オフセット修正（start=2）、九重久織亭 欠落・全施設1列ズレを解消 | — |
| 2026-03-25 | settings.local.json / ~/.claude/settings.json — bypassPermissions + skipDangerousModePermissionPrompt 設定（グローバル適用） | — |
| 2026-03-26 | TGRタブ新規追加 — resort_table.js(1MB) ロード、Layer1: 月次PLランキング（達成率ワースト順・色分け）、Layer2: KPIカード+日別チャート | — |
| 2026-03-26 | GAS Web App デプロイ — 全11施設日別売上集約エンドポイント（旅館/ゴルフ自動判別・JSONP対応） | — |
| 2026-03-26 | TGRタブ テーマ統一・タブ順変更 — RIALTライトテーマ適用、順序 RIALT→TGR→TOP、ラベル変更 | — |

---

## 公開モード仕様（実装済み）

| 項目 | 内容 |
|---|---|
| URL | `https://trial-dx.github.io/rialt_dashboard/index.html?public` |
| フル版 | `index.html`（社内・自分用、全機能有効） |
| 公開版 | `index.html?public`（RIALT+Tab2のみ、下記を非表示） |

**公開版で非表示にするもの**（`.private-only` CSS クラス）:
- TOP報告タブボタン、data.js のロード、インポートボタン（`↓`）
- P1/P2ボタン、設定ボタン（⚙）、検索ボックス

**Gemini APIキー管理**:
- `config.js` にキーをハードコード → GitHub にアップ（URLは非公開）
- `getGeminiKey()`: `localStorage` → `window.GEMINI_API_KEY`（config.js）の順にフォールバック

---

## 今後の追加予定（バックログ）

> 追加予定の機能・画面はここに記載し、完了したら変更ログへ移動する。

### TGRタブ（実装済み・残課題あり）

#### 実装済み
- 外タブ「TGR」追加（順序: RIALT → TGR → TOP）
- RIALTライトテーマに統一（背景 #f4f6f9、白カード）
- **Layer 1: 月次PLランキング**（達成率ワースト順・色分け）
- **Layer 2: 施設別ドリルダウン**（KPIカード + GAS日別チャート + 売上内訳）
- GAS Web App デプロイ済み（組織内アクセス制限、JSONP対応）
  - URL: `https://script.google.com/a/macros/retail-ai.jp/s/AKfycbwggw9i2KD2JzxcXSSFayAxAYMT1HUJ5MpLklrY-NRJjiT8hdhNSnhx4Dn8MQbuNiemSg/exec`

#### 既知の課題・残タスク
| 優先度 | 課題 | 対処方針 |
|---|---|---|
| 高 | ゴルフ3施設のPLデータが全て0 | resort_table.js に大分/若宮/阿蘇コースのxlsxデータが入っていない可能性 → 要調査 |
| 中 | Layer2 GASチャート未確認 | 組織Googleアカウントでログイン状態でTGRタブ → 施設クリックして確認 |
| 低 | `?tgr` URL制御（TGRタブのみ表示） | 未実装 |

#### データ構造（完成済み）

**ソースファイル**: `data/tgr/` 内の xlsx
- `2024.xlsx` — 2024年7月〜2025年6月（年次、月別シート12枚）
- `YYYYMM.xlsx` — 2025年7月以降（月次個別ファイル）

**生成スクリプト**: `tools/generate_resort_table.py`
- 出力: `resort_table.js`（`window.RESORT_TABLE`）+ `data/tgr/_table.json`

**CSV（確認・分析用）**:
- `data/tgr/ryokan.csv` — 旅館系施設（バグ修正後再生成が必要）
- `data/tgr/golf.csv` — ゴルフ系施設（バグ修正後再生成が必要）
- ※ ryokan.csv/golf.csv を閉じてから `py -3.12 tools/generate_resort_table.py` で再生成すること

**施設分類**:
```
旅館: 九重久織亭, 九重虎の湯, 宮若虎の湯, 小塚久の葉, 仙石原久の葉,
      古民家煉り, 九重PJ, Tsmart, 旅館事業合計, 本社旅館
ゴルフ: 若宮コース, 大分コース, 阿蘇コース, ゴルフ事業合計, 本社ゴルフ
```

**カラム構成（169列）**:
```
year, month, facility, source
+ PL全項目_実績/予算（内訳含む・ADR/RevPAR/見込みは除外）
  売上内訳: 飲食売上高, 旅館売上高, 売店売上高
  人件費内訳: 役員報酬, 給与手当, 法定福利費 ...等
  運営費・固定費内訳: 広告宣伝費, 水道光熱費 ...等
```

**カバレッジ（確認済み）**: 全20ヶ月・主要4指標でOK
```
2024-07〜2025-06: annual (2024.xlsx)
2025-07〜2026-02, 2026-11: monthly (個別xlsx)
```

#### CFO視点での必要KPI定義（確定）

| 分類 | 指標 | 取得方法 |
|---|---|---|
| 収益性 | 売上高・粗利・営業利益・利益率 | PLデータ（全期間OK） |
| 旅館KPI | 販売客室数・客室稼働率（OCC） | 全体PLシート行4-5（要Excel保存） |
| ゴルフKPI | ラウンド数・稼働率 | 全体PLシート行4-5（直値、取得済み） |
| 計算KPI | ADR = 宿泊売上 ÷ 販売客室数 | ダッシュボード側で計算 |
| 計算KPI | RevPAR = ADR × OCC | ダッシュボード側で計算 |
| 予算管理 | 全指標_予算 | 対予算シート（全期間OK） |

#### データ欠けの原因と対処（確定）

**原因**: 月次xlsx（202507〜）の旅館KPI行は数式参照のみで保存されていない
→ `data_only=True` でopenpyxlが読むと全てNULL

**対処**: 各xlsxをExcelで開いてCtrl+S上書き保存 → 計算値がセルに保存される

**対象ファイル（8ファイル）**:
```
202507.xlsx, 202508.xlsx, 202509.xlsx, 202510.xlsx,
202512.xlsx, 202601.xlsx, 202602.xlsx, 202611.xlsx
```

#### generate_resort_table.py 修正方針（確定）

1. **parse_pl を修正**: KPI行（販売客室数・客室稼働率）を取得対象に追加
   - 全体PLシートのindex 2-11（旅館）・index 12-15（ゴルフ）両方から取得
2. **ADR・RevPAR**: ソースデータから除外（スクリプト内で計算して追加）
   - `ADR_実績 = 宿泊売上高_実績 / 販売客室数_実績`
   - `RevPAR_実績 = ADR_実績 × 客室稼働率_実績`
3. **ゴルフKPI**: 「販売客室数」→「ラウンド数」に名称変更して区別

#### CFO視点 管理方針（確定）

**管理アプローチ：例外管理（Management by Exception）**
- 月次PLで問題施設を特定 → 日別売上にドリルダウンして問題の所在を特定
- 日別コストデータは存在しない（施設別スプレッドシートは売上・稼働のみ）
- 旅館/ゴルフは準固定費構造 → **売上変動 ≒ 利益変動** が成立するため日別売上で代替可

#### 2層アーキテクチャ（設計確定）

```
Layer 1：月次P&Lランキング（問題施設の特定）
  ├─ 全施設 × 当月の予算達成率
  ├─ 営業利益率の推移（12ヶ月）
  └─ ワーストN施設を赤ハイライト → クリックでLayer2へ

Layer 2：施設ドリルダウン（問題の所在特定）
  ├─ 月次P&L詳細（売上・費用内訳・利益率 vs 予算）  ← xlsx由来
  ├─ 日別売上チャート（予算/予約/実績の3本線）       ← GAS由来
  ├─ 売上内訳（泊/食/売店）                          ← GAS由来
  └─ 稼働率トレンド（OCC / 組数）                    ← GAS由来
       → 「単価問題か稼働問題か」を切り分け可能
```

#### データソース対応表

| データ | ソース | 粒度 | 状態 |
|---|---|---|---|
| 月次P&L（売上〜営業利益） | TGR月次xlsx | 月次・施設別 | 取得済み（ryokan.csv/golf.csv） |
| 日別売上・稼働率 | 施設別スプレッドシート（GAS） | 日次・施設別 | GAS設計中 |
| 予約ペース（着地予測） | 施設別スプレッドシート（GAS） | 日次・施設別 | GAS設計中 |
| 日別コスト | 存在しない | — | 対象外 |

#### 施設別スプレッドシートID（全11施設）

| 施設名 | タイプ | スプレッドシートID |
|---|---|---|
| 宮若虎の湯 | 旅館 泊+食 | 1TpeXg8S3j3tDY8ifqYAfg_xDW7VGdw-_WtP3lCrT5Ck |
| 古民家煉り | 旅館 泊のみ | 1FOfNps2-dP0wIrBkJulj-Wn4vdTxftvv8ctVf-y0qEM |
| Tsmart | 旅館 泊+食 | 1HVpaoPG-riSu0RrtBTgsIeba_7YaDlfzmVLv6qmMCCE |
| 九重久織亭 | 旅館 泊+食 | 1AXKvdoFsD7tUmeP-CUuq1Squ-vyZRkubz9k5bhV2e00 |
| 九重虎乃湯(ロッジ) | 旅館 泊+食 | 1cbkvN09SbMiIO0n0urOUjjjCK-HIm7s7V0AMPedMlwI |
| 仙石原久の葉 | 旅館 泊+食 | 1KyL_p0S8Hw0JjRIXJcz5MqjC_Ey9SRnmeC60hhDdk8g |
| 小塚久の葉 | 旅館 泊+食 | 13PMcODCT0OeQC3rue8YMFNsFRNiM_LsIE0rYufd8_DI |
| 阿蘇ホテル | 旅館 泊+食 | 1Mp5NlAW-5qHZk4zNLzrBetyfwC6gi0jhauqKIsm5WZk |
| 大分コース | ゴルフ | 1tY4RPS92mYe_FCxaPy5Evqd6khnX7yhSipmOOxQiAWc |
| 若宮コース | ゴルフ | 1xrqIuDqTcw_0DgmXWIhbwzsoKHdjFSKGoEsWwIuiLOk |
| 阿蘇コース | ゴルフ | 1u3dNX-qv87m8XI9RI47fbQurYKjMXpvy2ket7RRCmlg |

#### 列構成（確認済み）

**旅館型（8施設）— 列A〜M**

| 列 | 内容 |
|---|---|
| A | 日付 |
| B | 曜日 |
| C/D/E | 総売上（予算/予約/実績） |
| F/G/H/I/J | 売上内訳（泊/食/売店/ドリンク/追加食事） ※古民家煉りはF=泊, H=売店のみ |
| K/L/M | 部屋数（予算/予約/実績） |

**ゴルフ型（3施設）— 列A〜N前後**

| 列 | 内容 |
|---|---|
| A | 日付 |
| B | 曜日 |
| C/D/E | 総売上（予算/予約/実績） |
| F/G/H | 組数（予算/予約/実績） |
| I/J/K | 来場者数（予算/予約/実績） |
| L/M | 稼働率・組単価 |

#### GAS Web App 設計

**エンドポイント設計:**
- GET ?month=2025-07 → 全11施設の当月日別データをJSONで返す
- レスポンス: { "month": "2025-07", "ryokan": [...], "golf": [...] }

**GASスクリプト構成:**
1. 施設マスタ（ID + タイプ）
2. doGet(e) — monthパラメータ受取・全施設集約
3. parseRyokan(sheet) — 旅館型パーサー（A-M列）
4. parseGolf(sheet) — ゴルフ型パーサー
5. getSheetByMonth(ss, month) — YYYY.M 形式でシート特定
6. CORS対応（ContentService JSON）

#### 次のステップ

**次のステップ（残課題）**
1. [ ] ゴルフ3施設のPLデータ欠落を調査・修正
2. [ ] Layer2 GASチャートの動作確認（組織アカウントでログインして施設クリック）
3. [ ] `?tgr` URL制御（TGRタブのみ表示、共有URL用）
4. [ ] 12ヶ月推移チャートをLayer1に追加（オプション）



## 実行フロー
以下の順番で実行すること：

### 1. Planner
- タスクを分解
- 実装方針を決める
- まだ実装しない

### 2. Builder
- Plannerの計画に従って実装
- 余計なことはしない

### 3. Reviewer
以下の観点で必ずチェックする：

- 仕様を満たしているか？
- 既存機能を壊していないか？
- 不要な変更が入っていないか？
- エッジケースを考慮しているか？
- エラーハンドリングは適切か？


問題があれば：
- どこがダメか明確に指摘
- 修正案も提示する