# 経営ダッシュボード — 仕様書

## プロジェクト共通ルール

### GitHub Pages 必須データファイル（デプロイ時の必須チェック）

以下のファイルは GitHub Pages（`?tgr` / `?public`）で正常表示するために**必ず git 追跡対象**であること。
**git push 前に `git ls-files` で存在を確認すること。未追跡なら `git add` すること。**

| ファイル | 用途 | 欠落時の症状 |
|---|---|---|
| `resort_table.js` | TGR月次PLデータ | TGR全施設の売上・達成率が表示されない |
| `gas_data.js` | GAS補完データ（ホテルKPI） | **ホテルの稼働率・ADR・RevPAR・来場者数・客単価が「—」になる** |
| `tours_data.js` | TOURS予約データ（666件） | **TOURS売上が700万に激減する**（GASフォールバックで不完全データ） |
| `inbound_budget.js` | インバウンド予算データ FY2026 | 予算対比セクションが空になる |
| `inbound_budget_2025.js` | インバウンド予算データ FY2025 | FY2025切替時に予算データが表示されない |

> ⚠️ これらのファイルが欠落するバグは過去4回発生。ローカルでは存在するためローカルテストでは発見できない。

### 数値表示ルール
- **「○万」「○億」の日本語単位表記を使わない**（流通業では好まれない）
- 金額はカンマ区切り（例: `¥234,289,384`）
- カラムに収まらない場合は千円単位 + 項目名に`（千）`付記
- チャート軸も千円単位 +「千」表記
- 全アウトプット（HTML/JS/GAS/Excel）に適用

### 年度（会計年度）の定義
- **年度期間**: 7月1日 〜 翌年6月30日
- **年度名**: 開始年で呼ぶ（例：2025年7月〜2026年6月 = **2025年度**）
- 実装時の判定: `月 >= 7 ? 年 : 年 - 1`
- 全タブ・全集計で本ルールを適用すること

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
| `tools/resort_gas_ota.gs` | OTA月次CSV出力GAS（exportOTA_CSV()を実行 → ota_monthly.csvをDriveに生成） |
| `tools/generate_ota_js.py` | ota_monthly.csv → ota_data.js 生成スクリプト |
| `ota_data.js` | OTA月次明細データ（`window.OTA_DATA`、generate_ota_js.pyで生成） |
| `data/tgr/ota_monthly.csv` | OTA月次明細（縦型: 施設名,年月,合計売上,ダイレクトイン,トリプラ,OTA売上,OTA比率,直販比率） |
| `inbound_budget.js` | インバウンド予算データ FY2026（`window.INBOUND_BUDGET`、generate_inbound_budget.pyで生成） |
| `inbound_budget_2025.js` | インバウンド予算データ FY2025（`window.INBOUND_BUDGET_2025`、2025ホテルインバウンド.xlsxから手動生成・月+12シフト済み） |
| `tools/generate_inbound_budget.py` | 金堀_インバウンド計画.xlsx → inbound_budget.js 生成スクリプト |
| `notebooklm_prompt.md` | NotebookLM 用抽出プロンプト集 |
| `news/generate_news_data.py` | Excel → news_data.js 生成スクリプト |
| `news/news_data.js` | ニュースデータ（`window.NEWS_DATA`、Excel から自動生成） |
| `news/launch.py` | ダッシュボードランチャー（1日1回 news_data.js 更新 → index.html 開く） |
| `ダッシュボード.bat` | ダブルクリック起動用 bat（py -3.12 news/launch.py を実行） |

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
[RIALT] [TGR] [TOP] [IR] [NEWS]
  ↑月次PL  ↑リゾート ↑週次TOP報告 ↑株価IR ↑業界ニュース
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
- **注意**: `_bodyThemes` の `--bg`/`--panel-bg`/`--text`/`--gap`/`--dim` はTOPタブの`:root`ダーク値（`#07090d`等）を維持すること。明色に変えるとTOPタブパネルが白くなる

---

## TGRセクション（resort_table.js + GAS 連携）

### Layer 1: 月次PLランキング
- 全施設 × 当月の達成率ワースト順・色分け
- resort_table.js から取得（window.RESORT_TABLE）

### Layer 2: 施設ドリルダウン
- KPIカード（売上・稼働率・ADR・RevPAR等）
- 日別売上チャート（GAS APIから取得）
- 売上内訳（泊/食/売店）
- YoY分析タブ（月次KPI前年比・チャート・チャネル分析）

### サブタブ: インバウンド
- 国別売上カード（韓国/台湾/中国）
- 旅行会社TOP10（クリックでTOURSへ遷移）
- 国別・月別推移テーブル
- **予算対比セクション**（`inbound_budget.js` 連携）
  - 施設別: ADR・来期予算室数・予算金額・今期実績・達成率（プログレスバー付き）
  - 月別室数計画テーブル（主要6施設 + 合計）
  - 国別構成比（来期計画 vs 今期実績）
  - データソース: 金堀_インバウンド計画.xlsx（FY2026 = 2026-07〜2027-06）
  - TOURS実績との施設名マッチング: shortName（虎の湯, 煉り, 若宮 等）で照合

### RESORT_FACS — 施設マスタ（index.html内）
各施設に `pl`（表示名）と `tableKey`（resort_table.jsのキー）を持つ:
```js
{ label: 'ロッジ虎の湯', pl: 'ロッジ虎の湯', tableKey: '九重虎の湯' }
{ label: 'TSMART',       pl: 'TSMART',        tableKey: 'Tsmart' }
```
→ `getPlRow()` は `tableKey` で参照することで名称不一致を回避

### GAS Web App
- **デプロイURL**: `https://script.google.com/a/macros/retail-ai.jp/s/AKfycbwT4eHF5q--bGyD22l5WnmM6115C2hImYIXj-dHN92fragEWvG-au4LgGh7GqgAZdmXfw/exec`
- **現在のバージョン**: v94（2026/05/01）
- **ルーティング**:
  - `?budget_ping=1` → 診断エンドポイント（スプレッドシートアクセスなし）
  - `?budget_get=1&fy=YYYY` → 予算データ取得（JSONP対応）
  - `?budget_save=1&fy=YYYY&fac=NAME&data=JSON` → 1施設全月予算保存（JSONP対応）
  - `?budget_save_row=1&fy=YYYY&fac=NAME&month=YYYY-MM&adr=N&KOR=N&TWN=N&HKG=N&CHA=N&EUR=N` → 1セル（施設×月）保存（JSONP対応）
  - `?ir=1[&callback=xxx]` → `fetchIRData()` 呼び出し（5社比較データ、JSONP対応）
  - `?facility=xxx&month=YYYY-MM` → TGR施設日別売上データ
  - その他 → 月次集約データ
- **予算スプレッドシート**: `13X7r8VZkODGbIalBNQ15QarjhloR-FI-6D5f3uLErP0`（ツアーズインバウンド予算）
  - シート名: `FY{年度}` （例: FY2026）
  - 列構成: A=facility, B=ADR, C=month(YYYY-MM/テキスト形式), D=KOR, E=TWN, F=HKG, G=CHA, H=EUR
  - 1施設×1月＝1行（12施設×12ヶ月＝144行/FY）
  - ⚠️ C列はテキスト形式必須（Date自動変換でキー不一致が発生する）
- **予算通信方式**: JSONP GET（IR/TOURSと同じパターン）
  - 読み取り: `_bmJsonpLoad`
  - 書き込み（ADR変更）: `_bmJsonpSaveFacility`×施設数（順次実行、1.5秒デバウンス）
  - 書き込み（室数変更）: `_bmJsonpSaveRow`×変更セル数（1セル1リクエスト、差分のみ）
- **予算データフロー**: GAS読込→enrichment(total/budget/annual/shortName計算)→INBOUND_BUDGET設定→レンダリング。GAS空の場合はinbound_budget.jsからシード
- **差分保存**: `_bmDirtyCells = new Set()` に "施設::YYYY-MM" キーを蓄積 → 保存時に変更セルのみ`budget_save_row`を呼ぶ。ADR変更は`_bmDirtyADR = new Set()`で施設単位

### GAS IR機能（fetchIRData） — v62: 5社比較
- **対象5社**: トライアル(141A.T)、PPIH(7532.T)、ユニクロ/FR(9983.T)、コスモス薬品(3349.T)、イオン(8267.T)
- **並列取得**: `UrlFetchApp.fetchAll()` で5リクエスト並列（5社×1 chart のみ）
- **各社取得フィールド**: price(current/change/changePct/high/low/volume/week52High/week52Low)、その他はnull
- **ニュース**: `news:[]`（Google News RSSはGASサーバーからタイムアウトするため除去済み）
- **レスポンス構造**: `{ generated, companies:[{ticker,name,...}×5], news:[] }`

| フィールド | ソース | 状態 |
|---|---|---|
| price系 / chart / week52 | v8/chart 3mo（各社） | ✅ 動作 |
| marketCap | v8/chart meta.marketCap | ❌ null（v8/chartは返さない）|
| per / pbr / psr / 売上高 / 目標株価 | — | ❌ null（外部サイト全滅）|

### IRセクション — レイアウト・内タブ構成

```
[outer-ir]
  ├── .ir-ai-sidebar（左・幅480px・折りたたみ可）← AI分析サイドバー
  └── #ir-main-area（右・flex:1）
        ├── .ir-inner-tabs
        │     ├── [📊 現在データ]  → #ir-panel（比較テーブル・株価チャート）
        │     ├── [📈 時系列履歴] → #ir-history-panel
        │     └── [📰 ニュース]   → #ir-news-panel（トライアルHD最新ニュース）
        └── ...
```

- ニュースは `#ir-panel` から独立した `#ir-news-panel` に移動（2026/04改修）
- ニュース削除分のスペースは株価推移チャート（`ir-chart-combined`）が flex:1 で自動拡張

### IRセクション — 時系列スナップショット記録

- IRタブを開いてGASデータを取得するたびに **localStorage（`ir_history_v1`）** に自動保存
- 保存単位: 1日1件（当日分は上書き）、最大90日間のローリングウィンドウ
- 保存フィールド: `{ date, ts, companies:[{ticker, name, price:{current,changePct,marketCap}, valuation:{per,pbr,psr}, financial:{revenue}}] }`
- 時系列タブで指標セレクタ（株価指数化 / 時価総額 / PER / PBR / PSR）を選び5社折れ線チャート表示
- 株価は起点=100に正規化して比較

### IRセクション — AI分析サイドバー（左）

- 幅480px、折りたたみ可（`◀` ボタン）
- **2ボタン構成**:
  - `📊 詳細分析`（`id="ir-ai-run-btn-adv"`）: 投資家・経営者視点の専門分析
  - `🌱 初心者向け`（`id="ir-ai-run-btn-beg"`）: 専門用語解説付き・新入社員向け
- **プロンプト**: 最新データ5社 + 直近30日トライアル株価変化率 → JSON形式で応答要求
- **2カード構成**（モード共通）:
  - `trialAnalysis`: トライアルHD単体分析
  - `comparison`: 競合4社との比較
- **初心者向け追加カード**: 📖 用語集（PER/PBR/PSR/時価総額 等の正式英語名・解説）
- **キャッシュ**: 永続キャッシュ（`ir_ai_cache_v1_adv` / `ir_ai_cache_v1_beg`）。再分析まで保持
- **バッジ**: `✓ YYYY/MM/DD HH:MM 保存済` 形式（RIALT互換）
- **ページロード時**: キャッシュがあれば新しい方を自動描画（adv/beg タイムスタンプ比較）

### IRセクション — 表示フォーマット

- `fmtBn(v)`: 円建て値（yen）を億/兆に変換
  - `b = v / 1e8` （億単位に変換）
  - `b >= 10000` → 兆表示（`Math.round(b/1000)/10 + '兆'`）
  - それ未満 → 億表示（`Math.round(b*10)/10 + '億'`）
  - **注意**: しきい値は `10000`（1兆=10,000億）。`1000` にすると10倍ズレる

---

## AI分析 共通仕様（今後の追加時もこの仕様に従う）

各画面にGemini AI分析を追加する際の標準仕様。

### キャッシュ
| 項目 | 仕様 |
|---|---|
| **キー形式** | `{section}_ai_cache_v1_{mode}` （日付なし・永続） |
| **保存タイミング** | API成功後に即 `saveCache(text)` |
| **読込タイミング** | 画面初期化時に自動描画（タイムスタンプ比較で最新モードを優先） |
| **クリック動作** | `forceRefresh=false` → キャッシュ優先 → なければAPI呼び出し |
| **再分析** | キャッシュがある状態で再クリック → 同じくキャッシュ表示（API呼ばない） |
| **バッジ** | `✓ YYYY/MM/DD HH:MM 保存済`（`fmtTs(c.ts)` 形式） |

### スコープ注意
- `callGeminiAPI` / `getGeminiKey` / `formatAIText` / `parseAIJson` は **RIALTのIIFE内** で定義
- IR等の別IIFEから使う場合は `window.callGeminiAPI` 等 `window.*` 経由でアクセスすること
- RIALT IIFE末尾に `window.getGeminiKey = getGeminiKey;` 等のエクスポートが必要

### JSONレスポンス形式
```json
{ "key1": "説明文（N字以内）", "key2": "説明文（N字以内）" }
```
- `responseMimeType: 'application/json'` を `generationConfig` に指定
- `renderAIResult(text, ts, mode)` でパース→カード描画

### 右サイドAIサイドバー（TGR / TOURS / NEWS 共通）

```
[#rs-ai-float-btn] — position:fixed, right:6px, top:74px（collapsed時のみ表示）
[#rs-ai-sidebar] — position:fixed, right:0, top:68px, width:440px (collapsed: width:0 完全非表示)
  ├── ヘッダー（▶（展開時）/ ◀（折りたたみ時） トグル + 「AI 分析」タイトル）
  └── .rs-ai-panel × 3（id: rs-ai-panel-{tgr/tours/news}）
        ├── 実行ボタン（rs-ai-run-{sec}）
        ├── 再分析ボタン（rs-ai-rerun-{sec}）→ runAnalysis(sec, true)
        ├── キャッシュバッジ（rs-ai-badge-{sec}）
        └── 結果エリア（rs-ai-result-{sec}）
```

- **collapsed時**: `width:0` + ボーダーなし + シャドウなし（完全非表示）。フローティングボタン `#rs-ai-float-btn` のみ表示
- **矢印**: collapsed時 `◀`（展開する方向）、expanded時 `▶`（折りたたむ方向）
- **デフォルト**: collapsed（最小化）
- **タブ切替**: `switchOuterTab()` → `CustomEvent('outerTabChange')` → `onTabChange(tabId)` で表示/非表示 + パネル切替
- **IR タブでは非表示**（IR は専用サイドバーを使用）
- **RIALT / TOP タブでは非表示**
- **body クラス**: `rs-sb-visible` / `rs-sb-open` / `rs-sb-close` で外部レイアウト調整

#### TGR AI 分析カード
- `salesDecline`: 売上悪化施設（先月比・前年比）
- `costDecline`: コスト悪化施設（先月比・前年比）
- `improvements`: 高インパクト改善ポイント
- **当月フォールバック**: 今日の月にデータがなければ `≤ todayYM` の最新月を使用

#### TOURS AI 分析カード
- `monthChange`: 先月比の数字変化
- `growing`: 伸びている旅行会社
- `declining`: 減少している旅行会社
- `improvements`: 改善ポイント

#### NEWS AI 分析カード
- `thisWeek`: 直近7日の大きなトピック
- `lastWeek`: その前7日の大きなトピック

### チャットドック（全タブ共通）

```
[#rs-chat-dock] — position:fixed, bottom:0, height:320px (collapsed: 34px)
  ├── ヘッダー（タブ名 Q&A + 履歴消去 + ▲/▼ トグル）
  ├── メッセージエリア（rs-chat-messages）
  └── 入力バー（textarea + 送信ボタン）
```

- **対象タブ**: TGR / TOURS / NEWS / IR（RIALT / TOP では非表示）
- **タブ別独立履歴**: `rs_chat_{sec}` に localStorage 保存
- **自動コンテキスト**: 送信時にアクティブタブのデータ（collectTGR/collectTOURS/collectNEWS/collectIR）を自動添付
- **デフォルト**: collapsed

---

## NEWSセクション（news/news_data.js 連携）

- データソース: `window.NEWS_DATA`（`news/news_data.js`、Excel から generate_news_data.py で生成）
- Excel: `news/リテール業界ニュースリサーチ.xlsx`（統合ファイル。旧: `_YYYYMMDD.xlsx` 日別 → 2026-04-09 に統合）
- 起動: `ダッシュボード.bat` → `news/launch.py` → 1日1回のみ news_data.js を再生成してindex.htmlを開く
- `news/.last_run` マーカーで二重実行防止

### ニュースマトリクス表示

| 項目 | 内容 |
|---|---|
| 表示形式 | 日付 × 列（10列）の2次元テーブル（`table-layout:fixed`・全列幅110px統一） |
| 列構成 | トライアル/西友 / PPIH / ユニクロ/しまむら / コスモス/ロピア / イオン / セブン/ローソン/ファミマ / Amazon/Walmart / NTT/NEC / 電通 / その他 |
| カテゴリ統合 | `NEWS_COLS[].cats[]` で複数カテゴリ・表記揺れ（`トライアル`⇔`トライアルグループ`、`Walmart`⇔`ウォルマート` 等）を吸収 |
| その他列 | `isOther:true` フラグ。`_knownCats()` の補集合（既知カテゴリ以外すべて）を集約 |
| 重要度アイコン | 🔴高 / 🟡中 / 🟢低 |
| ウィンドウ | 直近14日（◀▶で移動） |
| ツールチップ | マウスオーバーで詳細（100〜150字）を `position:fixed` で追従表示 |
| 列単体ビュー | 列ヘッダクリックで遷移（`_focusLabel`）、100件ページネーション、右クリックで全列表示に戻る |

### Excelカラム構成

| 列 | 内容 |
|---|---|
| A | No |
| B | カテゴリ（企業名） |
| C | リリース日 |
| D | 概要（20〜30字） |
| E | 詳細（100〜150字） |
| F | 重要度（高/中/低） |
| G | URL |
| H | 情報ソース |

両シート（今日のニュース・過去履歴）を統合し URL 重複除去、日付降順ソート。

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

### 公開モード（`?public`）— RIALT関係者向け
- 表示タブ: **RIALTのみ**（TGR/TOURS/TOP/IR/NEWS すべて非表示）
- ヘッダー: P1/P2・設定・検索・インポート非表示
- GitHub Pages: `https://trial-dx.github.io/rialt_dashboard/index.html?public`

### TGR公開モード（`?tgr`）— リゾート関係者向け
- 表示タブ: **TGR + TOURS のみ**（RIALT/TOP/IR/NEWS 非表示）
- ヘッダー: 検索・設定・インポート等を非表示
- ページ読込時にTGRタブへ自動切替
- GitHub Pages: `https://trial-dx.github.io/rialt_dashboard/index.html?tgr`

### GitHub Pagesアクセス制御
- パラメータなしでGitHub Pagesにアクセス → `?public`に自動リダイレクト
- ローカル（file://）はリダイレクトなし → 全タブ表示（個人用）
- TOP/IR/NEWSは個人用のため公開URLには含めない

### インバウンド予算編集（TOURS タブ内）
- **✏ 編集**: インライン編集モーダル（施設選択 → ADR・月別室数を編集 → GAS自動保存）
- **💾 出力**: 編集済み予算データを `inbound_budget.js` としてダウンロード
- **📄 取込**: JS/JSONファイルをインポート
- **🔄 リセット**: 編集を破棄し元の `inbound_budget.js` に戻す
- **GAS自動保存**: 入力変更後1.5秒デバウンスでスプレッドシートに自動保存（JSONP GET）
- **サマリー行**: theadの先頭（ヘッダ上）に🏨ホテル合計・⛳ゴルフ合計・🌟総合計の3行を表示（sticky固定）
- **ゴルフ施設判定**: 施設名に「コース」を含むものをゴルフに分類（`_BM_GOLF_FACS`）
- **データフロー**: GAS読込→enrichment(total/budget/annual/shortName計算)→INBOUND_BUDGET設定→レンダリング。GAS空の場合はinbound_budget.jsからシード

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
| `ir_history_v1` | IR日次スナップショット（最大90日分） |
| `ir_ai_cache_v1_adv` | IR AI詳細分析キャッシュ（永続・再分析まで保持） |
| `ir_ai_cache_v1_beg` | IR AI初心者向けキャッシュ（永続・再分析まで保持） |
| `rs_ai_cache_tgr` | TGR AI分析キャッシュ（永続・再分析まで保持） |
| `rs_ai_cache_tours` | TOURS AI分析キャッシュ（永続・再分析まで保持） |
| `rs_ai_cache_news` | NEWS AI分析キャッシュ（永続・再分析まで保持） |
| `rs_chat_tgr` | TGR チャット履歴 |
| `rs_chat_tours` | TOURS チャット履歴 |
| `rs_chat_news` | NEWS チャット履歴 |
| `rs_chat_ir` | IR チャット履歴 |
| `inbound_budget_override_v1` | インバウンド予算ローカル編集データ |

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
