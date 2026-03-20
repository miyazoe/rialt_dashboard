# 経営ダッシュボード — 仕様書

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | メインアプリ（HTML + CSS + JS 単一ファイル） |
| `data.js` | 週次データ（`window.DASHBOARD_DATA["YYYY-WNN"]`） |
| `notebooklm_prompt.md` | NotebookLM 用抽出プロンプト集 |

---

## データ構造

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

### data.js 内のインポートブロック形式

```js
// [IMPORT:2026-W09:2026/03/01 12:00:START]
window.DASHBOARD_DATA = window.DASHBOARD_DATA || {};
if (!window.DASHBOARD_DATA["2026-W09"]) window.DASHBOARD_DATA["2026-W09"] = {};
Object.assign(window.DASHBOARD_DATA["2026-W09"], { ... });
// [IMPORT:2026-W09:END]
```

---

## タブ・パネル構成

| タブ | パネル ID | データソース | アクセントカラー |
|---|---|---|---|
| Tab1 TOP_MSG | exec-ishibashi | important 等を source="石橋" でフィルタ | 黄 `#e3b341` |
| Tab1 | exec-nagata | source="永田" | 青 `#58a6ff` |
| Tab1 | exec-makikusa | source="牧草" | 緑 `#3fb950` |
| Tab1 | exec-uchiyama | source="内山" | オレンジ `#f0883e` |
| Tab2 実務 | resort | resort 配列 | ライトブルー `#79c0ff` |
| Tab2 | apparel | apparel 配列 | パープル `#bc8cff` |
| Tab2 | secretary | secretary 配列 | ピンク `#ff9bce` |
| Tab2 | ai | AI キーワード自動抽出 | シアン `#00e5cc` |
| Tab3 トピック | trends | trends 配列 | 青 `#58a6ff` |
| Tab3 | numbers | numbers 配列 | オレンジ `#f0883e` |
| Tab3 | anomalies | anomalies 配列（下段全幅） | 赤 `#f85149` |
| Tab4 プライベート | private | private 配列（2カラムグリッド） | グレー `#8b949e` |

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
- 「既読を表示」ON で全件表示、OFF で未読のみ（全件既読なら NO_DATA 表示）
- パネルヘッダーに未読件数バッジを表示（accent カラー）

### AI 自動フィルタキーワード
`AI` / `人工知能` / `機械学習` / `生成AI` / `LLM` / `GPT` / `DX` / `自動化` / `データ基盤` / `デジタル化` / `SkipCart`
対象配列: important / random / trends / numbers

### 週選択
- セレクトボックスで複数週を切替
- `window.DASHBOARD_DATA` のキーを降順ソートして最新週をデフォルト表示

### インポート
- `↓` ボタン → ペーストダイアログ → NotebookLM 出力を貼付
- 週キー形式を検証（`YYYY-WNN`）
- 既存同週データと `Object.assign` でマージ（Prompt1 + Prompt2 を合成）
- File System Access API で `data.js` に直接書き込み
- IndexedDB (`dashboard_import_v1`) にファイルハンドルを永続化
- 書き込み成功後 2 秒でリロード

### プロンプトコピー
- `P1` ボタン: Prompt1（幹部・トピック用）をクリップボードへコピー
- `P2` ボタン: Prompt2（部門・プライベート用）をクリップボードへコピー

### 検索
- テキストボックスで text / source をリアルタイムフィルタリング
- 検索中はローテーション無効・全マッチ表示（最大 30 件）
- `/` キーでフォーカス、`Esc` でクリア

### 設定モーダル（⚙ ボタン）
- `localStorage` キー: `dashboard_settings_v2`
- FONT_SIZE: 10 / 11 / 12 / 13 / 14 / 15 px（デフォルト 12）
- PANEL_ITEMS: 2 / 3 / 4 / 5 / 6 / 8 件（デフォルト 4、private は固定 30）
- 各パネルの更新インターバル（Tab2 / Tab3 / Tab4 対象）

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

## デフォルト設定値

```js
{
  'exec-ishibashi': 60, 'exec-nagata': 60, 'exec-makikusa': 60, 'exec-uchiyama': 60,
  resort: 60, apparel: 60, secretary: 120, ai: 60,
  trends: 60, numbers: 60, anomalies: 10, private: 120,
  fontSize: 12, displayCount: 4
}
```
