const dictionaries = {
  ja: {
    articles: '記事一覧', rss: 'RSS', search: '記事を検索', searchPlaceholder: 'タイトル・説明文から検索',
    noArticles: '記事はまだありません。', noDate: '日付未設定',
    introTitle: 'OJapp Tips', introDescription: 'PWAツール開発者が書く Web のノウハウ集',
    sideDescription: '机上の理論だけじゃない。実際に作って、試して得た知見を。',
    toc: '目次', summary: '1分で読める要約', next: '次に読む',
    author: 'この記事を書いた人', profile: 'プロフィールを見る',
    recommendations: 'おすすめ記事',
    backToArticles: '← 記事一覧へ戻る', articleActions: '記事の操作',
    copyCode: 'コードをコピー', copyCodeSuccess: 'コードをコピーしました', copyCodeFailure: 'コードをコピーできませんでした',
    copyLink: '記事リンクをコピー', shareArticle: '記事を共有',
    linkCopying: 'リンクをコピーしています…', sharing: '共有しています…',
    linkCopied: 'リンクをコピーしました', copyFailed: 'コピーできませんでした',
    shared: '共有しました', shareCancelled: '共有をキャンセルしました',
    urlCopied: 'URLをコピーしました', shareFailed: 'コピーできませんでした。記事URLをアドレスバーからコピーしてください。',
    previousPage: '← 前の15件', nextPage: '次の15件 →', pagination: '記事一覧ページ',
    hub: '関連記事まとめ', externalLinks: '外部リンク',
    languageName: 'EN',
  },
  en: {
    articles: 'Articles', rss: 'RSS', search: 'Search articles', searchPlaceholder: 'Search by title or description',
    noArticles: 'No articles yet.', noDate: 'Date not set',
    introTitle: 'OJapp Tips', introDescription: 'Web Tips from a Tool Developer',
    sideDescription:  'Real-world insights from building and testing web tools.',
    toc: 'Contents', summary: 'A 1-minute summary', next: 'Next to read',
    author: 'About the author', profile: 'View profile',
    recommendations: 'Recommended articles',
    backToArticles: '← Back to articles', articleActions: 'Article actions',
    copyCode: 'Copy code', copyCodeSuccess: 'Code copied', copyCodeFailure: 'Could not copy code',
    copyLink: 'Copy article link', shareArticle: 'Share article',
    linkCopying: 'Copying link…', sharing: 'Sharing…',
    linkCopied: 'Article link copied', copyFailed: 'Could not copy',
    shared: 'Shared', shareCancelled: 'Sharing cancelled',
    urlCopied: 'URL copied', shareFailed: 'Could not copy. Please copy the article URL from the address bar.',
    previousPage: '← Previous 15', nextPage: 'Next 15 →', pagination: 'Article pages',
    hub: 'Related Articles', externalLinks: 'External links',
    languageName: 'JA',
  },
};

export function localeKey(language = 'ja') {
  return /^en(?:-|$)/i.test(String(language)) ? 'en' : 'ja';
}

export function localeText(language = 'ja') {
  return dictionaries[localeKey(language)];
}

export function htmlLanguage(language = 'ja') {
  const key = localeKey(language);
  return key === 'en' ? 'en-US' : 'ja-JP';
}

export function formatDate(value, language = 'ja') {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(htmlLanguage(language), {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  }).format(date);
}
