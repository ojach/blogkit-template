# OJapp Blog Kit Readme

Markdownで記事を書き、静的サイトとして公開できる軽量ブログキットです。WordPressなどからの移行にも、新しくブログを始める場合にも使えます。記事データはMarkdownとJSONで管理し、ビルドするとHTML、検索インデックス、RSS、サイトマップなどを生成します。

## 主な機能

- Markdown記事から静的HTMLを生成
- 日本語・英語の記事と表示に対応
- 目次、関連記事、検索、RSS、サイトマップを生成
- OGP画像を記事ごとに自動生成（Noto Sans JP同梱）
- 記事画像とサムネイルのJPG/PNGをWebPへ自動変換
- 広告枠、固定ページ、カスタムHTMLを設定可能
- GitHub PagesやCloudflare Pagesなどに公開可能
- オプションで記事ごとのPWAアイコン画像を生成

## 必要な環境

- Node.js 20以上
- npm

## クイックスタート

1. このフォルダで依存パッケージをインストールします。

   ```bash
   npm install
   ```

2. `site.json` のサイト名、説明、公開URL、作者名などを自分のサイトに合わせて編集します。`url` は公開するサイトのURLにしてください。

3. `content/` にあるサンプル記事を編集するか、新しい `.md` ファイルを追加します。記事情報は `articles.json` に登録します。

4. ビルドします。

   ```bash
   npm run build
   ```

生成された `dist/` をWebサーバーで配信してください。ローカルで確認する場合は、たとえば次のコマンドを使えます。

```bash
npx serve dist
```

## 記事の追加

`content/` にMarkdownファイルを作成し、同じファイル名のキーを `articles.json` に追加します。

```markdown
# 記事タイトル

本文をMarkdownで書きます。
```

```json
{
  "getting-started": {
    "title": "記事タイトル",
    "published": "2026-10-23",
    "category": "お知らせ",
    "excerpt": "一覧ページに表示する短い紹介文です。",
    "summary": "記事の要点を短くまとめます。",
    "thumbnail": "covers/getting-started.jpg",
    "thumbnail_alt": "記事のサムネイル"
  }
}
```

記事ファイル名がURLの基本になります。`permalink` を指定すればURLを変更できます。既存サイトから移行する場合、以前のURLに合わせて `permalink` を設定するとリンク切れを減らせます。

主な記事項目:

| 項目 | 説明 |
| --- | --- |
| `title` | 記事タイトル。省略時はMarkdownの最初のH1を使います。 |
| `published` | 公開日（`YYYY-MM-DD`）。 |
| `permalink` | URLのパス。省略時はファイル名を使います。 |
| `category` | 一覧に表示するカテゴリ。 |
| `excerpt` | 一覧や関連記事に表示する紹介文。 |
| `summary` | 記事冒頭に表示する折りたたみ式の要約。 |
| `meta_description` | 検索・OGP向けの説明文。 |
| `language` | 記事の言語。英語記事は `en` を指定します。 |
| `translation` | 翻訳記事同士を結びつけるキー。 |
| `thumbnail` | 記事上部に表示するサムネイル画像。 |
| `thumbnail_alt` | サムネイルの代替テキスト。 |
| `show_thumbnail` | `false` にするとサムネイルを非表示にします。 |
| `next_article` | 次に読む記事のキーまたはパーマリンク。 |
| `pwa_icon` | 記事固有のPWAアイコン画像。 |

## 画像とWebP変換

画像は `public/images/` に置き、記事ではMarkdownで参照します。

```markdown
![作業画面](editor.png)
```

画像をフォルダ分けする場合:
```text
public/images/screenshots/editor.png
```
記事では次のように参照します。
```markdown
![作業画面](screenshots/editor.png)
```

ビルド時に `public/images/` 内のJPG、JPEG、PNGをWebPに変換します。記事本文と `thumbnail` では、変換された画像が自動で使われます。元画像も `dist/images/` にコピーされるため、変換前のファイルも保持されます。GIF、SVG、WebPなどは変換せず、そのまま使います。

特定の画像を元形式のまま表示したい場合は、画像タイトルに `blogkit:original` を指定します。

```markdown
![細部まで見せたい画像](screenshots/detail.png "blogkit:original")
```

この指定は画像ごとに使えます。HTMLの `title` 属性には出力されません。

## サイト設定

`site.json` でサイト全体の設定を行います。

```json
{
  "title": "My Blog",
  "description": "ブログの説明",
  "url": "https://example.com/",
  "author": "Your Name",
  "brand_color": "#187a68",
  "icon": "site-icon.png",
  "author_image": "author.png",
  "language": "ja-JP",
  "features": {
    "article_summary": true,
    "article_pwa_icons": false
  }
}
```

`url` には公開URLを設定してください。GitHub Pagesのプロジェクトサイトではリポジトリ名を含めたURL（例: `https://username.github.io/repository/`）を指定します。

### 記事ごとのPWAアイコン（任意）

`site.json` で `features.article_pwa_icons` を `true` にすると、記事タイトルから正方形のアイコン画像を生成し、各記事のHTMLに次のメタタグを追加します。

```json
"features": {
  "article_pwa_icons": true
}
```

独自のアイコンを使う記事では、`articles.json` の記事情報に `pwa_icon` を指定できます。指定がない記事だけ自動生成します。生成した画像は `dist/images/pwa-icons/` に出力されます。`templates/custom-head.html` などに利用側のスクリプトを追加して、`ojapp:icon` メタタグを読み取る構成にもできます。

## 英語記事

`articles.json` で記事に `"language": "en"` を設定すると、英語用のURL（既定では `/en/記事キー/`）と英語の表示ラベルを使います。翻訳記事を用意する場合は、それぞれの記事の `translation` に相手側の記事キーを設定してください。

```json
{
  "hello-world": {
    "title": "Hello, world",
    "published": "2026-10-23",
    "language": "en",
    "translation": "hello-world-ja"
  }
}
```

サイトの既定言語は `site.json` の `language` で指定します。翻訳記事の対応状況や切り替えリンクは、記事の `translation` 情報をもとに表示されます。

## 固定ページ

`pages/` にMarkdownファイルを追加し、必要に応じて `pages.json` にタイトル、説明、URLなどを設定します。固定ページは記事一覧に含まれず、フッターに表示できます。

## 広告枠

記事本文に `[[ad]]` または `[[ad2]]` から `[[ad6]]` を記述すると、その位置に広告画像リンクを挿入できます。画像、リンク先、代替テキストは `site.json` の `ads` で設定します。未設定の枠は空のままになります。

## OGP画像とフォント

ビルド時に記事ごとのOGP画像を `dist/ogp/` に生成します。日本語表示用のNoto Sans JP可変フォントは `assets/fonts/` に同梱しているため、ビルド環境に別途フォントをインストールする必要はありません。

## 公開

### Cloudflare Pages

GitリポジトリをCloudflare Pagesに接続し、次の設定を使います。

- Build command: `npm run build`
- Build output directory: `dist`
- Node.js: 20以上

独自ドメインを使う場合は、Cloudflare Pages側でドメインを設定し、その公開URLを `site.json` の `url` に入力します。

### GitHub Pages

リポジトリにはGitHub Pages用のWorkflowを同梱しています。GitHubリポジトリの **Settings → Pages** でGitHub Actionsによる公開を選択してください。Workflowがビルドして `dist/` を公開します。

`site.json` の `url` は、ユーザーサイトなら `https://username.github.io/`、プロジェクトサイトなら `https://username.github.io/repository/` のように設定します。

## 移行時のヒント

- 旧サイトの記事URLに合わせて `permalink` を設定します。
- WordPressなどから本文をMarkdownへ変換し、記事ごとに `content/` へ保存します。
- 画像を `public/images/` に置き、記事本文中の参照先を更新します。JPG/PNGはビルド時にWebP化されます。
- リダイレクトが必要な場合は、利用するホスティングサービスのリダイレクト設定を追加します。
- 移行後は、代表的な記事・画像・英語記事・固定ページをプレビューして確認します。

## ディレクトリ構成

```text
content/          記事Markdown
public/           CSS、JavaScript、画像などの静的ファイル
pages/            固定ページMarkdown
templates/        HTMLテンプレート
assets/fonts/     OGP生成用フォント
scripts/          ビルド処理
articles.json     記事ごとの設定
pages.json        固定ページごとの設定
site.json         サイト全体の設定
dist/             ビルド出力（自動生成）
```
