# OJapp Blog Kit Migrator v0.5.6

WordPress標準XML（WXR）をBlog Kit形式に変換するNode.jsツールです。**XMLと翻訳対応表は外部サーバーに送信しません。** Node.jsのみで動作し、npm installは不要です。

## 使い方

```powershell
node migrate.js ojapptips.WordPress.2026-10-19.xml --translations ojapp-polylang-translations.json
```

変換結果は `migration-output/` に生成されます。

- `articles.json`：通常記事のメタ情報
- `content/*.md`：通常記事の本文（WordPress由来のHTMLを原則そのまま保存）
- `pages.json`：固定ページのメタ情報
- `pages/*.md`：固定ページ本文
- `migration-report.json`：変換内容・翻訳対応・確認が必要な項目

固定ページは `title`, `description`（取得できた場合）, `permalink`, `language`, `show_in_footer:false` を出力します。`footer_label` は省略し、`translation` は付けません。

### 不要な固定ページを除外

```powershell
node migrate.js wordpress.xml --translations ojapp-polylang-translations.json --exclude-page ojapp-pwa-marketing-demo1 --exclude-page ojapp-pwa-marketing-demo2 --exclude-page en/ojapp-pwa-marketing-demo1-2 --exclude-page en/ojapp-pwa-marketing-demo2-2
```

`--exclude-page` は繰り返し指定できます。URLのパスまたはWordPressスラッグで指定してください。すべての固定ページを除外する場合は `--exclude-pages` を指定します。

そのほか `--output フォルダ`, `--include-drafts`, `--overwrite` に対応します。既存の出力フォルダは `--overwrite` を指定しない限り上書きしません。**Blog Kit本体の既存 `pages.json` は自動的には変更しません**。必要なページだけ移行結果から統合してください。

### 注意点

- Blog Kitの `pages.json` は6項目仕様に合わせています。noindex設定や翻訳切替の自動生成はしません。
- WordPressの画像URL、ショートコード、埋め込み、旧プラグインの表示は動作確認が必要です。
- `--translations` はPolylangから別途書き出したJSONを指定します。記事（post）だけを対応付けます。
- WordPressの元URLと出力先のURLが一致するか、公開前に確認してください。

## v0.5: Markdown変換モード

従来どおりの保持モードが初期設定です。Markdown変換する場合だけ `--format markdown` を付けます。

```bash
node migrate.js wordpress.xml --format markdown --output migration-md --translations ojapp-polylang-translations.json
```

- `--format preserve`（初期値）: v0.4と同じくXMLから取得した本文を保持
- `--format markdown`: 一般的なHTMLをMarkdownへ変換。見出し、段落、リスト、画像、リンク、強調、コードブロック、WordPress `[caption]` に対応
- コードブロックは言語指定を優先し、なければ内容から慎重に推測。曖昧なら `text`
- Gutenbergの標準ブロックコメントを除去。カスタムブロックはレポートに注意を記録
- 複雑なHTML（table、iframe、video、script等）は原則そのまま保持。WordPressテーマ／プラグインのCSS・JSは移行しません
- `migration-report.json` の `warnings` と `items[].conversion_warnings` で要確認箇所を確認してください

**注意:** HTMLからMarkdownへの変換は完全再現を保証しません。WordPress独自の装飾、入れ子の複雑なHTML、カスタムショートコードは移行後に確認してください。元のWordPress XMLは必ず保管してください。

## v0.5.3 修正

- HTMLの入れ子リストを階層を維持してMarkdownに変換（`ul` / `ol`）
- 通常のリスト項目間に不要な空行を入れない（tight list）
- リスト内リンク・太字を維持
- `<h2><strong>見出し</strong></h2>` の余分な `**` を抑制
- `--format preserve` の処理は変更なし

※ リストに複数段落や複雑な独自HTMLを含む場合は、生成結果を確認してください。

## v0.5.3

- Markdown mode: add a separating space after bold labels ending in `:` or `：` when text immediately follows (e.g. `<strong>name：</strong>アプリ名` becomes `**name：** アプリ名`).
- Preserve mode and other conversion behavior unchanged.


### v0.5.3 修正

- WordPress本文のHTMLエンティティ（例: `&lt;head&gt;`）を本文取得時にデコードせず、保持したHTMLブロック内でタグ化する問題を修正。
- 画像URL・内部リンクは自動変更しません。

## 画像URLの任意変換（v0.5.6）

`--rewrite-images` を付けると、WordPressの `wp-content/uploads/` 配下にある本文画像URLをBlog Kit用に書き換えます。初期設定はOFFです。画像ファイル自体は取得・移動しません。

```bash
node migrate.js wordpress.xml --format markdown --rewrite-images --output migration-md
```

- Markdown画像: `https://example.com/wp-content/uploads/2026/09/image-312x500.png` → `image.png`
- HTML画像: 同じURL → `/images/image.png`
- HTMLの `srcset` も変換対象です。
- 通常のリンクや、外部CDN/R2など `wp-content/uploads/` 以外のURLは保持します。
- `migration-report.json` の `image_rewrites` に変更履歴、`image_name_collisions` に名前の衝突候補を出します。
- `-312x500` のような寸法表記は除去しますが、元画像の存在は保証できません。元ファイルを `public/images/` に配置してください。
- ファイル名の重複、`-scaled` や最初から寸法付きの名前で保存された画像には注意してください。
- 画像のない場合や、画像URLをそのまま使いたい場合はオプションを付けないでください。


### v0.5.6
Markdown変換時、`<strong>` / `<em>`（および `<b>` / `<i>`）をHTMLのまま保持します。日本語の文字に密着した強調表現で `**` / `*` がそのまま表示される問題を回避します。CLI版とWeb版に適用。

### v0.5.6
- Convert supported WordPress `[video src="..."]` and `[video mp4="..."]` shortcodes to HTML5 `<video controls>` in both preserve and Markdown modes.
- Preserve unknown plugin shortcodes and report warnings.
