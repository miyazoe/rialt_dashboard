# 失敗ログ

---

## 失敗1
### 内容（何が起きたか）
`mcp__serena__execute_shell_command` に絶対パスのスクリプトを渡すとパスが二重になり、ファイルが見つからずエラーになった。

### 原因（なぜ起きたか）
serena がカレントディレクトリを先頭に付加するため、絶対パスがさらに結合されてしまった。

### 対策（次どうするか）
- スクリプトはプロジェクトルートに置き、**相対パス**で呼ぶ
- または `cd /d "..." && py -3.12 script.py` で cwd を先に移動してから実行する

---

## 失敗2
### 内容（何が起きたか）
`mcp__serena__replace_content` を使うとパスが二重化するバグがあり、ファイルを書き換えられなかった。

### 原因（なぜ起きたか）
serena の replace_content ツール自体にパス結合バグがある（既知の問題）。

### 対策（次どうするか）
**replace_content は使用禁止**。代わりに Pythonパッチスクリプト方式を使う:
1. `create_text_file` でパッチPyスクリプト作成
2. `execute_shell_command` で `py -3.12 script.py` を実行
3. 確認後 `del script.py` で削除

---

## 失敗3
### 内容（何が起きたか）
`Edit` / `Write` ツールで index.html を編集しようとすると `EEXIST` エラーが出て書き込めなかった。

### 原因（なぜ起きたか）
Windows 環境で Claude の Edit/Write ツールがファイルロックまたはパーミッションの問題を起こす。

### 対策（次どうするか）
index.html の編集は必ず**Pythonパッチスクリプト方式**を使う（失敗2の対策と同じ）。

---

## 失敗4
### 内容（何が起きたか）
テーマ切替後もダッシュボードの Canvas チャートが白いまま変わらなかった。

### 原因（なぜ起きたか）
`initRialt()`（チャート描画）を `loadRialtTheme()`（テーマクラス適用）より**前**に呼んでいたため、チャート描画時点でテーマクラスが付いておらず、CSS変数が取得できなかった。

### 対策（次どうするか）
初期化順序を必ず **`loadRialtTheme()` → `initRialt()`** の順にする。
チャートの色は描画タイミングで `_rialtChartBg()` 等のヘルパー関数経由で取得する設計にする。

---

## 失敗5
### 内容（何が起きたか）
`applyRialtTheme()` の中でテーマ変更後に `renderDashCharts()` を呼んでいたが、その関数が存在せずチャートが再描画されなかった。

### 原因（なぜ起きたか）
関数名を誤って記述した（正しくは `renderDashboard()`）。

### 対策（次どうするか）
チャート再描画を呼ぶ前に、対象関数名が実際に存在するかコード内で確認する。
テーマ適用後のリドロー関数は `renderDashboard()` / `renderTrendChart()` / `renderDashPie()`。

---

## 失敗6
### 内容（何が起きたか）
パッチスクリプトで `assert old in src` が通ったのに、実際には別の箇所の似たパターンを誤って置換してしまった。

### 原因（なぜ起きたか）
old_string が短すぎて同じ文字列が複数箇所に存在し、意図しない箇所が置換された。

### 対策（次どうするか）
- `src.count(old)` で**一致数が1であること**をパッチ前に確認する
- old_string は前後の文脈を十分含めた長い文字列にする
- `replace(old, new, 1)` で最初の1件のみ置換する

---

## 失敗7
### 内容（何が起きたか）
Pythonスクリプトを `execute_shell_command` で実行しても stdout が空で返ってくる。処理が成功したのか失敗したのか判断できなかった。

### 原因（なぜ起きたか）
Windows のコードページ問題で、日本語を含む print 出力がエンコードエラーになりサイレントに失敗していた。

### 対策（次どうするか）
パッチスクリプトの冒頭に必ず `sys.stdout.reconfigure(encoding='utf-8')` を入れる。
または `sys.stdout.buffer.write(b'ok')` でバイト出力する。

---

## 失敗8
### 内容（何が起きたか）
ドリルダウンで「全て」を選んでドリルした後、右クリック（戻る）を押すと何も表示されなくなった。

### 原因（なぜ起きたか）
「全て」からドリルダウンした際に `fromAllMode` と `allModeLevel` を drillState に保存していなかったため、戻り先の情報が消えてしまっていた。

### 対策（次どうするか）
「全て」行クリック時に `{ fromAllMode: true, allModeLevel: st.level }` を drillState に付加する。
`goBack*` 関数では `fromAllMode` フラグを見て元の allMode 画面に戻る分岐を実装する。

---

## 失敗9
### 内容（何が起きたか）
Canvas の donut チャートの穴（中央円）がテーマ変更後も白いままだった。

### 原因（なぜ起きたか）
穴の描画コード `ctx.fillStyle = '#fff'` がパッチの検索パターンに引っかからなかった。コンテキスト（前後の行）を見ないとどのfillStyleか区別できず、最初のパッチで見落とした。

### 対策（次どうするか）
canvas 関連のパッチは `r * 0.48` 等の**固有文脈**を含めた長いパターンで検索・置換する。
パッチ適用後は必ず `assert src != orig` で変更が入ったことを確認する。

---

## 失敗10
### 内容（何が起きたか）
`node --check index.html` が `ERR_UNKNOWN_FILE_EXTENSION` エラーで使えなかった。JS構文確認ができないと思い込んでいた。

### 原因（なぜ起きたか）
Node.js は `.html` ファイルを直接チェックできない。

### 対策（次どうするか）
HTML から `<script>` タグの中身を正規表現で抽出して `.js` ファイルに書き出し、`node --check _chk.js` で確認する。
```python
import re
scripts = re.findall(r'<script[^>]*>(.*?)</script>', src, re.DOTALL)
with open('_chk.js', 'w', encoding='utf-8') as f: f.write('\n'.join(scripts))
```

---

## 失敗11
### 内容（何が起きたか）
カレンダーリマインダープロジェクトの `gas/` `pc/` フォルダを 経営ダッシュボード（Desktop/）フォルダの**中に**作成してしまった。
その状態で `/plan` を実行したため、Dashboard の `.claude/task.md` がカレンダー内容で上書きされた。

### 原因（なぜ起きたか）
`/plan` コマンドは常に**カレントプロジェクト**の `.claude/task.md` を上書きする。
別プロジェクトを同一フォルダで作業していたことに気づかなかった。

### 対策（次どうするか）
- **プロジェクトは必ず独立したフォルダに作る**。既存プロジェクトのサブフォルダには絶対に作らない。
  ```
  ✅ C:\Users\00001512\Desktop\Claude\Calendar\    ← 独立フォルダ
  ❌ C:\Users\00001512\Desktop\Claude\Desktop\Calendar\  ← Dashboardの中に混入
  ```
- 新プロジェクト開始時にCWDを確認し、既存プロジェクトのフォルダ内でないことを確かめる
- `task.md` は定期的に git commit して復元可能にしておく
---

## 失敗12
### 内容（何が起きたか）
施設名マッピング（RESORT_FACS の `pl` フィールド）と resort_table.js のキー名が一致しておらず、ロッジ虎の湯・TSMART のデータが表示されなかった。

### 原因（なぜ起きたか）
resort_table.js は Excel ファイル上の施設名（「九重虎の湯」「Tsmart」）をそのままキーにするが、UI側の `pl` フィールドは表示名（「ロッジ虎の湯」「TSMART」）を使っており、名称が不一致だった。

### 対策（次どうするか）
RESORT_FACS の各施設エントリに `tableKey` フィールドを追加し、`getPlRow()` / `calcRow()` 等は常に `fac.tableKey || fac.pl` でキーを引く。
施設を追加・変更する際は `pl`（表示名）と `tableKey`（resort_table.jsキー）の両方を設定すること。

---

## 失敗13
### 内容（何が起きたか）
Claude in Chrome の file:// タブでスクリーンショットが取れず、「Frame with ID 0 is showing error page」エラーが出続けた。

### 原因（なぜ起きたか）
Chrome拡張は file:// スキームへのアクセスが制限されており、screenshot / get_page_text 等のツールが動作しない。

### 対策（次どうするか）
file:// ページの動作確認はユーザーに手動で行ってもらう。
JS構文確認は `node --check _chk.js` で代替する。

---

## 失敗14
### 内容（何が起きたか）
GAS コード（18,639文字）を `mcp__Claude_in_Chrome__javascript_tool` で Monaco エディタに注入する際、巨大なBase64文字列を直接 JS に埋め込む必要があった。

### 原因（なぜ起きたか）
GAS コードには特殊文字・改行が含まれるため、文字列としてそのまま渡すとエラーになる。

### 対策（次どうするか）
1. Python で GAS コードを Base64 エンコードして `_inject.js` ファイルに書き出す
2. `_inject.js` の内容を `mcp__Claude_in_Chrome__javascript_tool` の text パラメータに渡す
3. Monaco 側で `atob(b64)` してデコードし `models[0].setValue(code)` でセットする
