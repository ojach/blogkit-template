# OJapp Blog Kit

**Built for the AI Writing Era.**  
**Write freely. Own what you build.**

Markdownで記事を書き、自分のブログとして公開するための静的ブログエンジンです。
記事一覧・検索・RSS・サイトマップ・OGP画像などは、ビルド時に自動生成します。

## まずはGitHub Pagesで公開

[サンプルサイト](https://ojach.github.io/blogkit-template/)

1. GitHubで **Use this template** → **Create a new repository** を選び、自分のリポジトリを作ります。
2. 作成したリポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選びます。
3. `site.json`を開き、`url`を自分のGitHub PagesのURLに書き換えます。

   ```json
   "url": "https://ユーザー名.github.io/リポジトリ名/"
   ```

4. 変更をコミットします。GitHub Actionsがビルドして公開します。公開先のURLと実行状況は **Actions** タブで確認できます。

これでGitHub Pagesでブログを公開できます。GitHub上で記事を追加・編集する場合、ローカルで`npm install`や`npm run build`をする必要はありません。

## 記事を書く

`content/`にMarkdownファイルを作ります。たとえば`content/kiji.md`です。

```md
# 記事タイトル

ここから本文を書きます。

## 見出し

文章やリスト、リンク、画像、コードブロックなどを書けます。
```

最初の`#`見出しが記事タイトルになり、URLはファイル名から自動で作られます。公開日や「次に読む」記事などを指定したいときだけ、`articles.json`に設定を追加します。ファイルをコミットすると、Actionsがサイトを更新します。

## 使い方を詳しく見る

サンプルサイトに、設定や記事の書き方をまとめた記事があります。

- [はじめまして。OJapp Blog Kitへようこそ](https://ojach.github.io/blogkit-template/welcome/)
- [Use this templateから始める設定と使い方](https://ojach.github.io/blogkit-template/getting-started/)
- [GitHubを使わずに使う方法](https://ojach.github.io/blogkit-template/without-github/)
- [コードブロックを、読む人にも書く人にもわかりやすく](https://ojach.github.io/blogkit-template/code-blocks/)

## 独自ドメインで公開する(Cloudflare+Github)

GitHub Pagesでの公開後、独自ドメインを使いたくなったらCloudflare Pagesへ接続します。

Cloudflare Pagesの **Workers & Pages → Create application → Pages → Connect to Git** から、自分のGitHubリポジトリを選び、次の内容でビルドを設定します。

| 設定 | 値 |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Framework preset | `None` |

Pagesの **Custom domains** で独自ドメインを設定し、`site.json`の`url`も独自ドメインに変更します。以降はGitHubへコミットすると、Cloudflare Pagesが自動でビルド・公開します。

## ローカルで使う場合(Cloudflare+PC)

Node.js 20以上が必要です。ローカルでビルドする場合は、

- プロジェクトのフォルダで一度だけ依存関係をインストール

```bash
npm install
```

- Cloudflareにログインする。

```bash
npx wrangler login
```

- 記事や設定を編集したら、ビルドしてデプロイする。

```bash
npm run build
npx wrangler pages deploy dist --project-name Cloudflareのプロジェクト名
```

生成された`dist/`が公開用ファイルです。`dist/`はビルド時に作られるため、直接編集しません。
