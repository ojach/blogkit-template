# Use this templateから始める設定と使い方

OJapp Blog Kitは、テンプレートから自分用のGitHubリポジトリを作り、記事を追加して公開できます。ここでは、最初の設定から記事公開までを説明します。

## 1. 自分用のリポジトリを作る

1. OJapp Blog KitのGitHubリポジトリを開きます。
2. **Use this template** → **Create a new repository** を選びます。
3. リポジトリの名前を入力し、自分のアカウントに作成します。
4. できたリポジトリを開き、テンプレートのファイルが入っていることを確認します。

これで、記事や設定を自分で管理できるリポジトリができます。以降の変更はこのリポジトリに保存します。

## 2. 公開先を選ぶ

### GitHub Pagesで公開する

このテンプレートには、GitHub Pages用のActionsワークフローが含まれています。

1. リポジトリの **Settings → Pages** を開きます。
2. **Build and deployment → Source** を **GitHub Actions** にします。
3. `main`へ変更をPushすると、Actionsがビルドして`dist/`を公開します。
4. 公開URLや処理状況は **Actions** タブで確認できます。

独自ドメインを使わないプロジェクトサイトでは、`site.json`の`url`を実際の公開URLに合わせます。たとえば`https://ユーザー名.github.io/リポジトリ名/`です。

### Cloudflare Pagesで公開する

Cloudflare PagesのGit連携を使うと、GitHubへPushした変更をCloudflareが自動でビルドして公開します。

1. Cloudflare Dashboardの **Workers & Pages** からPagesプロジェクトを作成し、**Connect to Git** を選びます。
2. GitHubを認証し、作成したリポジトリを選択します。
3. Production branchは通常 `main` にします。
4. ビルド設定を次のようにします。

| 設定 | 値 |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |

Cloudflare Pagesが依存関係のインストール、ビルド、公開を行います。以降はリポジトリに変更をPushすると自動で更新されます。

独自ドメインを使う場合は、Pagesプロジェクトの **Custom domains** から設定します。

> Cloudflare PagesとGitHub Pagesは別の公開先です。CloudflareのGit連携を使う場合、GitHub Pages用Actionsの設定は必要ありません。

## 3. ブログ情報を設定する

プロジェクト直下の`site.json`を開き、ブログ名、説明、公開URL、作者名を自分のものに変更します。

```json
{
  "title": "My Blog",
  "description": "自分のブログの説明です。",
  "url": "https://blog.example.com",
  "author": "Your Name",
  "brand_color": "#187a68",
  "language": "ja-JP"
}
```

`url`はcanonicalやサイトマップなどにも使われるため、公開するURLを正確に設定します。ブログアイコンや作者アイコンを使う場合は画像を`public/images/`に置き、`site.json`でファイル名を指定します。

## 4. Markdown記事を追加する

`content/`にMarkdownファイルを作成します。最初の`#`見出しが記事タイトルになります。

```md
# はじめての記事

ここから本文を書きます。

## 見出し

段落やリスト、リンク、画像、コードブロックなどを使えます。
```

たとえば`content/my-first-post.md`なら、設定がない場合のURLは`/my-first-post/`です。画像は`public/images/`に置いて、本文ではファイル名を指定します。

## 5. 必要な記事情報だけ追加する

記事の公開日や「次に読む」記事などを指定したい場合は、`articles.json`にファイル名をキーとして追加します。拡張子の`.md`は付けません。

```json
{
  "my-first-post": {
    "published": "2026-10-14",
    "next_article": "next-post"
  }
}
```

タイトルはMarkdownの最初の見出し、パーマリンクはファイル名から自動で決まります。説明文も本文から生成されるため、すべての記事に設定を手入力する必要はありません。必要な項目だけ指定できます。

`next_article`には、リンク先記事のファイル名かパーマリンクを指定します。シリーズや読んでほしい順番を作りたいときに使います。

## 6. 記事を公開・更新する

GitHubの画面から記事ファイルを追加・編集して**Commit changes**を押すか、VS CodeからコミットしてPushします。Cloudflare PagesのGit連携またはGitHub Pages Actionsがビルドを行い、公開サイトを更新します。

手元で確認したいときは、プロジェクトフォルダで次を実行します。

```bash
npm install
npm run build
```

生成された`dist/`が公開用データです。`dist/`の中身はビルド成果物なので、記事の編集元として使いません。
