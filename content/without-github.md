# GitHubを使わずに使う方法

OJapp Blog Kitは、GitHubを使わずにローカルで使ったり、ビルド済みファイルを手動で公開したりできます。

まず、次の2つは別の使い方です。

- **ローカルだけで使う**：自分のPCで記事を書き、プレビューする。インターネット上には公開されません。
- **GitHubを使わず公開する**：自分のPCでビルドし、`dist/`をホスティング先へアップロードします。

## ローカルだけで記事を書く・確認する

1. ZIPをPCに展開します。
2. プロジェクトフォルダでターミナルを開き、初回だけ依存関係を入れます。

```bash
npm install
```

3. `content/`のMarkdown記事や`articles.json`を編集します。
4. ビルドします。

```bash
npm run build
```

`dist/`にHTMLが生成されます。表示を確認する場合は、VS CodeのLive ServerなどのローカルWebサーバーで`dist/index.html`を開いてください。HTMLを直接ダブルクリックして`file://`で開くと、記事検索など一部の機能が動かないことがあります。

この使い方なら、記事データと生成結果はPC内にあります。公開URLがなくても執筆や確認はできますが、他の人がインターネットから閲覧することはできません。

## GitHubを使わずCloudflare Pagesへ公開する

ローカルでビルドした`dist/`を、Cloudflare PagesのDirect Uploadでアップロードします。Wranglerのコマンドを使わず、Dashboardから操作できます。

### 初回

1. `site.json`の`url`を、公開予定の`pages.dev` URLまたは独自ドメインに設定します。
2. `npm run build`を実行して`dist/`を作ります。
3. Cloudflare Dashboardの**Workers & Pages**からPagesプロジェクトを作成し、**Drag and drop**で`dist/`をアップロードします。
4. デプロイ後、必要ならPagesプロジェクトの**Custom domains**から独自ドメインを設定します。

### 記事を更新するとき

記事や設定を編集したら、ローカルで再度`npm run build`を実行します。その後、Pagesプロジェクトで新しいデプロイを作成し、更新された`dist/`をアップロードします。

この方法ではGitHubへのPushは不要ですが、ビルドとアップロードは更新のたびに行います。CloudflareのDirect Uploadプロジェクトは、後からGit連携プロジェクトへ切り替えられません。将来GitHub連携に変更するときは、新しいPagesプロジェクトを作る必要があります。

## Wranglerでコマンドから公開する

アップロード操作をコマンドで行う方法もあります。初回はプロジェクト内にWranglerを追加してCloudflareへログインし、Pagesプロジェクトを作ります。

```bash
npm install -D wrangler
npx wrangler login
npx wrangler pages project create
```

プロジェクト名を作成した後は、記事を更新するたびに次を実行します。

```bash
npm run build
npx wrangler pages deploy dist --project-name=プロジェクト名
```

コマンドが苦手ならDashboardからのアップロード、操作をまとめたいならWrangler、という選び方です。どちらもビルド済みの`dist/`を公開します。

## GitHubを使う場合との違い

GitHub連携では、記事をPushすると公開先が自動でビルド・デプロイします。GitHubを使わない場合は、PCでビルドしたあと、自分で`dist/`をアップロードします。

どちらの方法でも、元になる記事は`content/`のMarkdown、設定は`site.json`と`articles.json`です。公開方法を選んでも、記事の内容は自分のファイルとして保持できます。
