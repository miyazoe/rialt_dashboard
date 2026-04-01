# 経営ダッシュボード — 仕様書

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | メインアプリ（HTML + CSS + JS 単一ファイル、約300KB JS） |
| `data.js` | 週次TOP報告データ（`window.DASHBOARD_DATA["YYYY-WNN"]`） |
| `rialt_data.js` | RIALT月次PLデータ（`window.RIALT_DATA`）、約17MB |
| `resort_table.js` | TGR月次PLフラットテーブル（`window.RESORT_TABLE`）、約1MB |
| `generate_rialt.py` | CP932 CSV → rialt_data.js 生成スクリプト |
| `tools/generate_resort_table.py` | TGR xlsx → resort_table.js 生成スクリプト |
| `tools/resort_gas.gs` | GAS Web App ソース（バックアップ用） |
| `notebooklm_prompt.md` | NotebookLM 用抽出プロンプト集 |

---

## データ構造

### TOP報告データ（data.js）

```js
window.DASHBOARD_DATA["YYYY-WNN"] = {
  report:    { owner, title, period },
  important: [{ text, source }],   // Prompt1 / Tab1・Tab3
  anomalies: [{ text, source }],   // Prompt1 / Tab3
  random:    [{ text, source }],   // Prompt1 / Tab1
  trends:    [{ text, source }],   // Prompt1 / Tab3
  teams:     [{ text, source }],   // Prompt1 / Tab1
  numbers:   [{ text, source }],   // Prompt1 / Tab1・Tab3
  apparel:   [{ text, source }],   // Prompt2 / Tab2
  resort:    [{ text, source }],   // Prompt2 / Tab2
  secretary: [{ text, source }],   // Prompt2 / Tab2
  private:   [{ text, source }]    // Prompt2 / Tab4
};
```

インポートブロック形式:

```js
// [IMPORT:2026-W09:2026/03/01 12:00:START]
window.DASHBOARD_DATA = window.DASHBOARD_DATA || {};
if (!window.DASHBOARD_DATA["2026-W09"]) window.DASHBOARD_DATA["2026-W09"] = {};
Object.assign(window.DASHBOARD_DATA["2026-W09"], { ... });
// [IMPORT:2026-W09:END]
```

### RIALTデータ（rialt_data.js）

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

### TGRデータ（resort_table.js）

```js
window.RESORT_TABLE = {
  "施設名": {
    "YYYY-MM": { year, month, facility, source, ...PLフィールド169列 }
  }
}
// キー例: "九重久織亭", "九重虎の湯", "宮若虎の湯", "Tsmart", etc.
```

---

## 外タブ構成

```
[RIALT] [TGR] [TOP]
  ↑月次PL  ↑リゾート ↑週次TOP報告
```

---

## TOP報告セクション（data.js 連携）

### Tab1 — TOP_MSG（幹部メッセージ）

| パネルID | データソース | アクセントカラー |
|---|---|---|
| exec-ishibashi | source="石橋" | 黄 `#e3b341` |
| exec-nagata | source="永田" | 青 `#58a6ff` |
| exec-makikusa | source="牧草" | 緑 `#3fb950` |
| exec-uchiyama | source="内山" | オレンジ `#f0883e` |

### Tab2 — 実務

| パネルID | データソース | アクセントカラー |
|---|---|---|
| resort | resort 配列 | ライトブルー `#79c0ff` |
| apparel | apparel 配列 | パープル `#bc8cff` |
| secretary | secretary 配列 | ピンク `#ff9bce` |
| ai | AI キーワード自動抽出 | シアン `#00e5cc` |

### Tab3 — トピック

| パネルID | データソース | アクセントカラー |
|---|---|---|
| trends | trends 配列 | 青 `#58a6ff` |
| numbers | numbers 配列 | オレンジ `#f0883e` |
| anomalies | anomalies 配列（下段全幅） | 赤 `#f85149` |

### Tab4 — プライベート

| パネルID | データソース | アクセントカラー |
|---|---|---|
| private | private 配列（2カラムグリッド、固定30件） | グレー `#8b949e` |

---

## RIALTセクション（rialt_data.js 連携）

### 内タブ: ダッシュボード
- KPI 5件（売上・荒利・管理可能費・経常利益前年比 + 荒利率）
- 期間フィルター（直近12/24/36ヶ月 / カスタム）
- Chart①: 売上・荒利・経常利益 月次推移（棒＋折線コンボ）
- Chart②: 費用比率内訳 積み上げ推移
- Chart③: 管理可能費率 vs 荒利率 散布図
- Chart④⑤⑥: 構成比 円グラフ3枚（売上・荒利・経常利益）
- Chart⑦: ライン別 売上前年比／荒利率 横棒
- 階層フィルター（全体 / ブロック / ゾーン / エリア / 店舗 / ディビジョン / ライン / 部門）

### 内タブ: ドリルダウン
- 商品階層ドリル（ディビジョン → ライン → 部門）
- 店舗階層ドリル（ブロック → ゾーン → エリア → 店舗）
- SL（スタイルライン）別ドリル
- 合計行（最上段）・全て行（最下段）
- `fromAllMode` + `allModeLevel` で「全て」からのドリル後の戻り先を保持

### 内タブ: 単月分析
- 月選択・KPI4件・ワースト20商品/店舗テーブル
- ワーストメトリック: 売上/荒利/経常利益/人件費/在庫
- Gemini AI分析パネル（APIキーはSettings保存 → localStorage: `gemini_api_key_v1`）

### 内タブ: PL明細
- 条件セレクター・会計年度ナビ・合計列・前年対比モード
- 行折りたたみ（`btn.textContent === '▼'` で判定、innerHTML不可）

### テーマシステム
- テーマ切替: A（Dark Financial）/ B（Modern SaaS）/ C（Professional Navy）/ デフォルト
- `localStorage` キー: `rialt_theme_v1`
- CSS: `#outer-rialt.theme-X { --変数 }` にスコープ（TOP報告へ影響しない）
- グローバルCSS変数（全テーマ共通）: `--th-header / --th-border / --th-accent / --th-accent2 / --th-muted`
  → ヘッダー・設定モーダル・ナビゲーションが全テーマで統一
- Canvas チャート色: `_rialtChartBg()` / `_rialtAxisColor()` 等のヘルパー関数経由
- **初期化順序**: `loadRialtTheme()` → `initRialt()` の順（逆にするとチャートが白くなる）

---

## TGRセクション（resort_table.js + GAS 連携）

### Layer 1: 月次PLランキング
- 全施設 × 当月の達成率ワースト順・色分け
- resort_table.js から取得（window.RESORT_TABLE）

### Layer 2: 施設ドリルダウン
- KPIカード（売上・稼働率・ADR・RevPAR等）
- 日別売上チャート（GAS APIから取得）
- 売上内訳（泊/食/売店）

### RESORT_FACS — 施設マスタ（index.html内）
各施設に `pl`（表示名）と `tableKey`（resort_table.jsのキー）を持つ:
```js
{ label: 'ロッジ虎の湯', pl: 'ロッジ虎の湯', tableKey: '九重虎の湯' }
{ label: 'TSMART',       pl: 'TSMART',        tableKey: 'Tsmart' }
```
→ `getPlRow()` は `tableKey` で参照することで名称不一致を回避

### GAS Web App
- **デプロイURL**: `https://script.google.com/a/macros/retail-ai.jp/s/AKfycbwggw9i2KD2JzxcXSSFayAxAYMT1HUJ5MpLklrY-NRJjiT8hdhNSnhx4Dn8MQbuNiemSg/exec`
- **現在のバージョン**: v34（2026/04/01 19:20）
- **ルーティング**:
  - `?ir=1[&callback=xxx]` → `fetchIRData()` 呼び出し（4社比較データ、JSONP対応）
  - `?facility=xxx&month=YYYY-MM` → TGR施設日別売上データ
  - その他 → 月次集約データ

### GAS IR機能（fetchIRData） — v34: 4社比較
- **対象4社**: PPIH(141A.T)、ユニクロ/FR(9983.T)、コスモス薬品(3349.T)、イオン(8267.T)
- **並列取得**: `UrlFetchApp.fetchAll()` で13リクエスト並列（4社×3 + ニュース1）
- **各社取得フィールド**: price(current/change/changePct/high/low/volume/week52High/week52Low/marketCap), valuation(per/pbr/psr), financial(revenue/targetMeanPrice/recommendationKey), chart(90日スパークライン)
- **ニュース**: PPIH「トライアルホールディングス」Google News RSS（最大5件）
- **レスポンス構造**: `{ generated, companies:[{ticker,name,...}×4], news:[] }`

| フィールド | ソース | 状態 |
|---|---|---|
| price系 / chart / week52 | v8/chart 3mo（各社） | ✅ 動作 |
| per / pbr / psr / marketCap / open | minkabu.jp スクレイピング（各社） | ✅ 動作 |
| targetMeanPrice / recommendationKey | minkabu.jp スクレイピング（各社） | ✅ 動作 |
| revenue | minkabu.jp/settlement meta description（各社） | ✅ 動作 |
| ev / ebitda / operatingMargin 等 | — | ❌ 削除（取得不可）|

**minkabuスクレイピング正規表現（v34）**:
- PER/PBR/PSR: `/<th[^>]*>PER[\s\S]*?<\/th>\s*<td[^>]*>([\d.]+)\s*倍/` （`<span>`タグをまたぐため`[\s\S]*?`使用）
- 時価総額: `/時価総額[\s\S]{0,100}?<td[^>]*>([\d,]+)\s*(億円|百万円|兆円)/`
- 始値: `/始値[\s\S]{0,50}?<td[^>]*>([\d,]+\.?\d*)\s*円/`
- 売上高（settlement meta）: `/【売上高】([\d,]+)百万円/`（テーブルはJS描画のためmeta descriptionから取得）

---

## 主要機能

### 自動ローテーション
- Fisher-Yates シャッフルで N 件表示（デフォルト 4 件、設定可）
- 設定可能インターバルで自動更新（5 / 10 / 20 / 30 / 60 / 120 / 300s）
- private パネルは固定 30 件表示

### 既読管理
- `localStorage` キー: `dashboard_read_v1`
- item key = `(source + '::' + text).slice(0, 120)`
- `[ ]` ボタンで既読マーク → 次の未読に差し替え

### AI 自動フィルタキーワード
`AI` / `人工知能` / `機械学習` / `生成AI` / `LLM` / `GPT` / `DX` / `自動化` / `データ基盤` / `デジタル化` / `SkipCart`
対象配列: important / random / trends / numbers

### インポート
- `↓` ボタン → ペーストダイアログ → NotebookLM 出力を貼付
- File System Access API で `data.js` に直接書き込み
- IndexedDB (`dashboard_import_v1`) にファイルハンドルを永続化

### 公開モード（`?public`）
- TOP報告・インポート・P1/P2・設定・検索を非表示
- GitHub Pages: `https://trial-dx.github.io/rialt_dashboard/index.html?public`

---

## キーボードショートカット

| キー | 動作 |
|---|---|
| `1` | Tab1 TOP_MSG |
| `2` | Tab2 実務 |
| `3` | Tab3 トピック |
| `4` | Tab4 プライベート |
| `/` | 検索インプットにフォーカス |
| `Esc` | 検索クリア |

---

## ワークフロー（週次更新）

1. NotebookLM に社内報告書をアップロード
2. `P1` ボタン → プロンプトコピー → NotebookLM で実行 → 出力を `↓IMPORT` で貼付
3. `P2` ボタン → プロンプトコピー → NotebookLM で実行 → 出力を `↓IMPORT` で貼付
4. Prompt1 + Prompt2 がパネル単位でマージされ、1週分完成

---

## ファイル編集ルール

- `Edit` / `Write` ツールは Windows で `EEXIST` エラーになるため**使用不可**（大きいファイルは特に）
- **正しい手順**:
  1. `mcp__serena__create_text_file` で Python パッチスクリプトを作成
  2. `mcp__serena__execute_shell_command` で `py -3.12 script.py` を実行
  3. 確認後 `del script.py` で削除
  4. JS構文確認: `<script>` 抽出 → `node --check _chk.js`

---

## localStorage キー

| キー | 用途 |
|---|---|
| `dashboard_read_v1` | 既読管理 |
| `dashboard_settings_v2` | 設定（フォントサイズ・表示件数・インターバル） |
| `rialt_theme_v1` | RIALTテーマ設定 |
| `gemini_api_key_v1` | Gemini APIキー |

---

## デフォルト設定値

```js
{
  'exec-ishibashi': 60, 'exec-nagata': 60, 'exec-makikusa': 60, 'exec-uchiyama': 60,
  resort: 60, apparel: 60, secretary: 120, ai: 60,
  trends: 60, numbers: 60, anomalies: 10, private: 120,
  fontSize: 12, displayCount: 4
}
```
