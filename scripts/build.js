import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import sharp from 'sharp';
import { codeToHtml } from 'shiki';
import { generateOgp, generatePwaIcon } from './ogp.js';
import { formatDate, htmlLanguage, localeKey, localeText } from './locales.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const readJson = async (file) => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const slug = (value) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ぁ-んァ-ヶ一-龠ー]+/g, '-').replace(/^-|-$/g, '') || 'section';
const codeEscape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const codeLanguageLabels = {
  bash: 'Bash', c: 'C', cpp: 'C++', css: 'CSS', diff: 'Diff', html: 'HTML',
  java: 'Java', javascript: 'JavaScript', js: 'JavaScript', json: 'JSON',
  jsx: 'JSX', markdown: 'Markdown', md: 'Markdown', php: 'PHP', py: 'Python',
  python: 'Python', sh: 'Shell', shell: 'Shell', sql: 'SQL', ts: 'TypeScript',
  tsx: 'TSX', typescript: 'TypeScript', txt: 'Text', text: 'Text', xml: 'XML',
  yaml: 'YAML', yml: 'YAML',
};

function parseCodeInfo(info) {
  const raw = String(info || '').trim();
  const language = raw.split(/\s+/, 1)[0].toLowerCase();
  return {
    language,
    label: codeLanguageLabels[language] || (language ? language : 'Text'),
  };
}

function decodeHtmlCode(value) {
  const namedEntities = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  };
  return String(value).replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (match, entity) => {
    if (entity[0] !== '#') return namedEntities[entity.toLowerCase()] ?? match;
    const hex = entity[1]?.toLowerCase() === 'x';
    const codePoint = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : match;
  });
}

function greatestCommonDivisor(a, b) {
  return b ? greatestCommonDivisor(b, a % b) : a;
}

function indentationUnit(code, language) {
  const widths = String(code).split('\n').map((line) => {
    const content = language === 'diff' && /^[+-]/.test(line) ? line.slice(1) : line;
    const indent = content.match(/^[ \t]+/)?.[0] || '';
    return indent.includes('\t') ? indent.length * 2 : indent.length;
  }).filter(Boolean);
  return widths.reduce((unit, width) => greatestCommonDivisor(unit, width), 0) || 2;
}

async function renderCodeBlock({ text, lang, labels }) {
  const { language, label } = parseCodeInfo(lang);
  const diff = language === 'diff';
  const indentSize = indentationUnit(text, language);
  const sourceLines = String(text).replace(/\r\n?/g, '\n').split('\n');
  let highlighterLanguage = language || 'text';
  let highlighted;
  const transformers = [{
    name: 'ojapp-code-block-guides',
    line(node, lineNumber) {
      let sourceLine = sourceLines[lineNumber - 1] || '';
      if (diff && /^[+-]/.test(sourceLine)) sourceLine = sourceLine.slice(1);
      const indent = sourceLine.match(/^[ \t]+/)?.[0] || '';
      const width = indent.includes('\t') ? indent.length * 2 : indent.length;
      node.properties.style = `--indent-width:${Math.floor(width / indentSize) * indentSize}ch`;
      if (diff && sourceLines[lineNumber - 1]?.startsWith('+')) this.addClassToHast(node, 'is-addition');
      if (diff && sourceLines[lineNumber - 1]?.startsWith('-')) this.addClassToHast(node, 'is-deletion');
    },
  }];

  try {
    highlighted = await codeToHtml(String(text), { lang: highlighterLanguage, theme: 'dark-plus', transformers });
  } catch {
    // Unknown language names remain readable as plain text instead of failing the whole build.
    highlighterLanguage = 'text';
    highlighted = await codeToHtml(String(text), { lang: highlighterLanguage, theme: 'dark-plus', transformers });
  }

  const copyData = Buffer.from(String(text), 'utf8').toString('base64');
  return `<div class="code-block${diff ? ' code-block--diff' : ''}" style="--indent-size:${indentSize}ch"><div class="code-header"><span class="code-language">${codeEscape(label)}</span><button class="code-copy" type="button" data-copy-code="${copyData}" data-copy-success="${codeEscape(labels.copyCodeSuccess)}" data-copy-failure="${codeEscape(labels.copyCodeFailure)}" aria-label="${codeEscape(labels.copyCode)}" title="${codeEscape(labels.copyCode)}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button><span class="code-copy-status" data-code-copy-status role="status" aria-live="polite"></span></div>${highlighted}</div>\n`;
}

function collectCodeTokens(tokens, result = []) {
  for (const token of tokens || []) {
    if (token.type === 'code' || token.type === 'ojappHtmlCode') result.push(token);
    if (token.tokens) collectCodeTokens(token.tokens, result);
    if (token.items) {
      for (const item of token.items) collectCodeTokens(item.tokens, result);
    }
  }
  return result;
}

function withBase(basePath, pathname) {
  const cleanPath = `/${String(pathname).replace(/^\/+/, '')}`;
  return `${basePath}${cleanPath}` || '/';
}

function fillTemplate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '');
}

function imageUrl(basePath, value) {
  const image = String(value ?? '').trim();
  if (!image) return '';
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(image)) return image;
  const imagePath = image.startsWith('/')
    ? image
    : `/images/${image.replace(/^images\//, '')}`;
  return withBase(basePath, imagePath);
}

const webpImages = new Map();
const rasterExtensions = new Set(['.jpg', '.jpeg', '.png']);

async function generateWebpImages() {
  const sourceRoot = path.join(root, 'public/images');
  const visit = async (directory) => {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const source = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(source);
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      if (!entry.isFile() || !rasterExtensions.has(extension)) continue;
      const relative = path.relative(sourceRoot, source);
      const webpRelative = path.join(path.dirname(relative), `${path.basename(relative, extension)}.webp`);
      const destination = path.join(out, 'images', 'webp', webpRelative);
      try {
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await sharp(source).rotate().webp({ quality: 82, effort: 4 }).toFile(destination);
        webpImages.set(relative.split(path.sep).join('/'), `/images/webp/${webpRelative.split(path.sep).join('/')}`);
      } catch (error) {
        console.warn(`WebP conversion skipped for ${relative}: ${error.message}`);
      }
    }
  };
  await visit(sourceRoot);
}

function optimizedImageUrl(basePath, value, preserveOriginal = false) {
  const image = String(value ?? '').trim();
  if (!image || preserveOriginal || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(image)) return imageUrl(basePath, image);
  const suffixIndex = image.search(/[?#]/);
  const imagePath = suffixIndex < 0 ? image : image.slice(0, suffixIndex);
  const suffix = suffixIndex < 0 ? '' : image.slice(suffixIndex);
  const normalized = imagePath.startsWith('/') ? imagePath : `/images/${imagePath.replace(/^images\//, '')}`;
  if (!normalized.startsWith('/images/')) return imageUrl(basePath, image);
  const relative = normalized.slice('/images/'.length).split('/').join(path.sep);
  const extension = path.extname(relative).toLowerCase();
  if (!rasterExtensions.has(extension)) return imageUrl(basePath, image);
  const webp = webpImages.get(relative.split(path.sep).join('/'));
  return webp ? `${withBase(basePath, webp)}${suffix}` : imageUrl(basePath, image);
}

function shell({ title, description, canonical, site, basePath, body, extra = '', ogImage = '', pwaIcon = '', customHeadHtml = '', customBodyHtml = '', footerHtml = '', lang = 'ja', brandColor = '#187a68', labels = localeText(lang), homePath = '/', languageHomeUrl = '' }) {
  const homeUrl = withBase(basePath, homePath);
  const cssUrl = withBase(basePath, '/css/style.css');
  const highlightUrl = withBase(basePath, '/css/highlight.css');
  const rssUrl = withBase(basePath, '/rss.xml');
  const faviconUrl = site.icon ? imageUrl(basePath, site.icon) : '';
  const faviconTag = faviconUrl ? `<link rel="icon" href="${esc(faviconUrl)}">` : '';
  const pwaIconUrl = pwaIcon ? imageUrl(basePath, pwaIcon) : '';
  const pwaIconTag = pwaIconUrl ? `<meta name="ojapp:icon" content="${esc(pwaIconUrl)}">` : '';
  const ogImageTags = ogImage
    ? `<meta property="og:image" content="${esc(ogImage)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(ogImage)}">`
    : '<meta name="twitter:card" content="summary">';
  return `<!doctype html><html lang="${esc(htmlLanguage(lang))}" style="--brand:${brandColor}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}">${faviconTag}${pwaIconTag}<meta property="og:type" content="${extra ? 'article' : 'website'}"><meta property="og:site_name" content="${esc(site.title)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}">${ogImageTags}<meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><link rel="stylesheet" href="${esc(cssUrl)}"><link rel="stylesheet" href="${esc(highlightUrl)}"><link rel="alternate" type="application/rss+xml" title="${esc(site.title)} RSS" href="${esc(rssUrl)}">${extra}${customHeadHtml}</head><body><header class="site-header"><div class="header-inner"><a class="brand" href="${esc(homeUrl)}">${esc(site.title)}</a><nav class="nav"><a href="${esc(homeUrl)}">${esc(labels.articles)}</a><a href="${esc(rssUrl)}">${esc(labels.rss)}</a>${languageHomeUrl ? `<a href="${esc(languageHomeUrl)}" lang="${lang === 'en' ? 'ja' : 'en'}">${esc(labels.languageName)}</a>` : ''}</nav></div></header>${body}${footerHtml}${customBodyHtml}</body></html>`;
}

await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });

const [site, metadata, pageMetadata] = await Promise.all([readJson('site.json'), readJson('articles.json'), readJson('pages.json')]);
const shareScript = await fs.readFile(path.join(root, 'public/js/share.js'), 'utf8');
const homeTemplate = await fs.readFile(path.join(root, 'templates/index.html'), 'utf8');
const pageTemplate = await fs.readFile(path.join(root, 'templates/page.html'), 'utf8');
const customHeadHtml = await fs.readFile(path.join(root, 'templates/custom-head.html'), 'utf8');
const customBodyHtml = await fs.readFile(path.join(root, 'templates/custom-body-end.html'), 'utf8');
const siteUrl = new URL(site.url);
const basePath = siteUrl.pathname.replace(/\/$/, '');
const brandColor = /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(String(site.brand_color || '')) ? site.brand_color : '#187a68';
const absoluteUrl = (pathname) => new URL(withBase(basePath, pathname), siteUrl.origin).href;
await generateWebpImages();
const renderer = new marked.Renderer();
renderer.image = ({ href, title, text }) => {
  const preserveOriginal = title?.trim().toLowerCase() === 'blogkit:original';
  const imageTitle = preserveOriginal ? '' : title;
  return `<img src="${esc(optimizedImageUrl(basePath, href, preserveOriginal))}" alt="${esc(text)}"${imageTitle ? ` title="${esc(imageTitle)}"` : ''} loading="lazy">`;
};

const adHtmlFor = (number) => {
  const ad = site.ads?.[number] || (number === 1 ? site.ad : null);
  const image = imageUrl(basePath, ad?.image);
  let href = '';
  try {
    const candidate = new URL(String(ad?.url || ''));
    if (candidate.protocol === 'https:' || candidate.protocol === 'http:') href = candidate.href;
  } catch {
    // Leave the marker empty when its ad URL is missing or invalid.
  }
  return image && href
    ? `<a class="ad-banner" href="${esc(href)}" rel="sponsored noopener"><img src="${esc(image)}" alt="${esc(ad?.alt || '')}" loading="lazy"></a>`
    : '';
};
const codeBlockHtml = new Map();
let activeCodeLanguage = localeKey(site.language || 'ja');
marked.use({
  extensions: [{
    name: 'ojappAd',
    level: 'block',
    start(source) {
      return /^\[\[ad(?:[1-6])?\]\]\s*$/m.exec(source)?.index;
    },
    tokenizer(source) {
      const match = /^\[\[ad([1-6])?\]\](?:\r?\n|$)/.exec(source);
      if (match) return { type: 'ojappAd', raw: match[0], number: match[1] || '1' };
    },
    renderer(token) {
      const adHtml = adHtmlFor(token.number);
      return adHtml ? `${adHtml}\n` : '';
    },
  }, {
    name: 'ojappHtmlCode',
    level: 'block',
    start(source) {
      return /<pre\b/i.exec(source)?.index;
    },
    tokenizer(source) {
      const match = source.match(/^<pre\b[^>]*>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>(?:\r?\n|$)/i);
      if (!match) return;
      const classValue = match[1].match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const classes = classValue?.slice(1).find(Boolean) || '';
      const language = classes.match(/(?:^|\s)language-([\w.+-]+)/i)?.[1];
      if (!language) return;
      return {
        type: 'ojappHtmlCode',
        raw: match[0],
        text: decodeHtmlCode(match[2]),
        lang: language,
      };
    },
    renderer(token) {
      const key = JSON.stringify([activeCodeLanguage, token.text, token.lang || '']);
      return codeBlockHtml.get(key)
        || `<pre><code>${codeEscape(token.text)}</code></pre>\n`;
    },
  }],
});

const pageDirectory = path.join(root, 'pages');
await fs.mkdir(pageDirectory, { recursive: true });
const pageFiles = (await fs.readdir(pageDirectory)).filter((file) => file.endsWith('.md'));
const pages = [];
for (const file of pageFiles) {
  const key = path.basename(file, '.md');
    const raw = await fs.readFile(path.join(pageDirectory, file), 'utf8');
  const tokens = marked.lexer(raw);
  const firstHeading = tokens.find((token) => token.type === 'heading' && token.depth === 1);
  const headingText = (token) => token.tokens?.map((part) => part.text || part.raw || '').join('') || token.text || '';
  const meta = pageMetadata[key] || {};
  const title = meta.title || (firstHeading && headingText(firstHeading)) || key.replace(/[-_]/g, ' ');
  const permalink = (meta.permalink || key).replace(/^\/+|\/+$/g, '');
  const description = meta.description || raw.replace(/^#+ .*$/gm, '').replace(/<[^>]*>/g, ' ').replace(/[`*_>#\[\]()-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) || title;
  pages.push({ key, title, description, permalink, language: localeKey(meta.language || site.language || 'ja'), footerLabel: meta.footer_label || title, showInFooter: meta.show_in_footer !== false, tokens, firstHeading });
}

const footerHtmlFor = (language) => {
  const labels = localeText(language);
  const links = pages.filter((page) => page.language === language && page.showInFooter)
    .map((page) => `<a href="${esc(withBase(basePath, `/${page.permalink}/`))}">${esc(page.footerLabel)}</a>`).join('');
  const pageNav = links ? `<nav class="footer-pages" aria-label="${esc(labels.sitePages)}">${links}</nav>` : '';
  return `<footer class="footer"><div class="footer-inner"><a class="footer-brand" href="${esc(withBase(basePath, language === localeKey(site.language || 'ja') ? '/' : `/${language}/`))}">${esc(site.title)}</a>${pageNav}<p class="footer-tagline">Built for the OJapp Blog Kit.</p></div></footer>`;
};

const files = (await fs.readdir(path.join(root, 'content'))).filter((file) => file.endsWith('.md'));
const articles = [];
for (const file of files) {
  const key = path.basename(file, '.md');
  const raw = await fs.readFile(path.join(root, 'content', file), 'utf8');
  const tokens = marked.lexer(raw);
  const firstHeading = tokens.find((token) => token.type === 'heading' && token.depth === 1);
  const headingText = (token) => token.tokens?.map((part) => part.text || part.raw || '').join('') || token.text || '';
  const meta = metadata[key] || {};
  const title = meta.title || (firstHeading && headingText(firstHeading)) || key.replace(/[-_]/g, ' ');
  const description = meta.meta_description || meta.excerpt || raw.replace(/^#+ .*$/gm, '').replace(/[`*_>#\[\]()-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) || title;
  const defaultPermalink = meta.language && localeKey(meta.language) === 'en' ? `en/${key}` : key;
  const permalink = (meta.permalink || defaultPermalink).replace(/^\/+|\/+$/g, '');
  articles.push({ key, title, description, excerpt: meta.excerpt || description, summary: meta.summary || '', permalink, published: meta.published || '', category: meta.category || '', nextArticleKey: meta.next_article || '', translationKey: meta.translation || '', metaLanguage: meta.language || '', pwaIcon: meta.pwa_icon || '', thumbnail: meta.thumbnail || '', thumbnailAlt: meta.thumbnail_alt || title, showThumbnail: meta.show_thumbnail !== false, tokens, firstHeading });
}
articles.sort((a, b) => (b.published || '').localeCompare(a.published || '') || a.title.localeCompare(b.title));

const permalinkOwners = new Map();
for (const item of [...articles, ...pages]) {
  if (permalinkOwners.has(item.permalink)) {
    throw new Error(`Duplicate permalink "${item.permalink}" used by "${permalinkOwners.get(item.permalink)}" and "${item.key}".`);
  }
  permalinkOwners.set(item.permalink, item.key);
}

for (const item of [...articles, ...pages]) {
  item.language = item.language || localeKey(item.metaLanguage || site.language || 'ja');
  item.labels = localeText(item.language);
  for (const token of collectCodeTokens(item.tokens)) {
    const key = JSON.stringify([item.language, token.text, token.lang || '']);
    if (!codeBlockHtml.has(key)) codeBlockHtml.set(key, await renderCodeBlock({ ...token, labels: item.labels }));
  }
}

const makeSearchIndex = (languageArticles) => languageArticles.map((article) => ({
  title: article.title,
  description: article.description,
  excerpt: article.excerpt,
  url: absoluteUrl(`/${article.permalink}/`),
  published: article.published,
  displayDate: formatDate(article.published, article.language),
  category: article.category,
}));
const defaultLanguage = localeKey(site.language || 'ja');
const defaultLabels = localeText(defaultLanguage);
const languages = [...new Set(articles.map((article) => article.language))];
const articlesPerPage = 15;
const languageHomePath = (language) => language === defaultLanguage ? '/' : `/${language}/`;
for (const language of languages) {
  const languageArticles = articles.filter((article) => article.language === language);
  const labels = localeText(language);
  const route = languageHomePath(language);
  const searchFilename = language === defaultLanguage ? 'search-index.json' : `search-index.${language}.json`;
  const searchIndexUrl = withBase(basePath, `/${searchFilename}`);
  const pageCount = Math.max(1, Math.ceil(languageArticles.length / articlesPerPage));
  const cardsFor = (page) => languageArticles.slice((page - 1) * articlesPerPage, page * articlesPerPage).map((article) => `<li class="article-card" data-card><div class="article-meta">${article.published ? `<time datetime="${esc(article.published)}">${esc(formatDate(article.published, article.language))}</time>` : `<span>${esc(labels.noDate)}</span>`}${article.category ? ` · ${esc(article.category)}` : ''}</div><h2><a href="${esc(withBase(basePath, `/${article.permalink}/`))}">${esc(article.title)}</a></h2><p>${esc(article.excerpt)}</p></li>`).join('');
  const languageHomeUrl = languages.length > 1
    ? withBase(basePath, languageHomePath(language === 'en' ? 'ja' : 'en'))
    : '';
  for (let page = 1; page <= pageCount; page += 1) {
  const pageRoute = page === 1 ? route : `${route.replace(/\/$/, '')}/page/${page}/`;
  const previous = page > 1 ? `<a href="${esc(withBase(basePath, page === 2 ? route : `${route.replace(/\/$/, '')}/page/${page - 1}/`))}">← 前の15件</a>` : '';
  const next = page < pageCount ? `<a href="${esc(withBase(basePath, `${route.replace(/\/$/, '')}/page/${page + 1}/`))}">次の15件 →</a>` : '';
  const pagination = pageCount > 1 ? `<nav class="pagination" aria-label="記事一覧ページ">${previous}<span>${page} / ${pageCount}</span>${next}</nav>` : '';
  const home = fillTemplate(homeTemplate, {
    introTitle: esc(labels.introTitle),
    introDescription: esc(labels.introDescription),
    searchLabel: esc(labels.search),
    searchPlaceholder: esc(labels.searchPlaceholder),
    noResults: esc(language === 'en' ? 'No matching articles.' : '該当する記事はありません'),
    searchIndexUrl: esc(searchIndexUrl),
    articleCards: cardsFor(page) || `<li class="empty">${esc(labels.noArticles)}</li>`,
    pagination,
    sideDescription: esc(labels.sideDescription),
    searchScriptUrl: esc(withBase(basePath, '/js/search.js')),
  });
  const destination = path.join(out, pageRoute.replace(/^\/+|\/+$/g, ''), 'index.html');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, shell({ title: site.title, description: site.description, canonical: absoluteUrl(pageRoute), site, basePath, body: home, pwaIcon: site.pwa_icon || site.icon || '', customHeadHtml, customBodyHtml, footerHtml: footerHtmlFor(language), brandColor, lang: language, labels, homePath: route, languageHomeUrl }));
  }
  await fs.writeFile(path.join(out, searchFilename), JSON.stringify(makeSearchIndex(languageArticles), null, 2));
}
const sitemap = [];
const rss = [];
for (const article of articles) {
  activeCodeLanguage = article.language;
  const toc = [];
  const usedIds = new Map();
  const articleRenderer = new marked.Renderer();
  articleRenderer.image = renderer.image;
  articleRenderer.code = ({ text, lang }) => codeBlockHtml.get(JSON.stringify([article.language, text, lang || ''])) || `<pre><code>${codeEscape(text)}</code></pre>\n`;
  articleRenderer.heading = ({ tokens, depth }) => {
    const rendered = articleRenderer.parser.parseInline(tokens);
    const plain = rendered.replace(/<[^>]*>/g, '');
    const base = slug(plain);
    const count = usedIds.get(base) || 0;
    usedIds.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base;
    if (depth >= 2) toc.push({ id, text: plain, level: depth });
    return `<h${depth} id="${id}">${rendered}</h${depth}>\n`;
  };
  const contentTokens = article.firstHeading ? article.tokens.slice(article.tokens.indexOf(article.firstHeading) + 1) : article.tokens;
  const html = marked.parser(contentTokens, { renderer: articleRenderer, extensions: marked.defaults.extensions });
  const labels = article.labels;
  const tocHtml = toc.length ? `<details class="toc" open><summary>${esc(labels.toc)}</summary><ul>${toc.map((item) => `<li class="${item.level === 3 ? 'toc-h3' : ''}"><a href="#${esc(item.id)}">${esc(item.text)}</a></li>`).join('')}</ul></details>` : '';
  const canonical = absoluteUrl(`/${article.permalink}/`);
  const author = site.author_locales?.[article.language] || {};
  const authorName = author.name || site.author || (article.language === 'en' ? 'Author' : '著者');
  const authorDescription = author.description || site.author_description || '';
  const authorUrl = author.url || site.author_url || '';
  const ogpFilename = `${slug(article.key)}.png`;
  const ogpPath = path.join(out, 'ogp', ogpFilename);
  const localizedSite = { ...site, author: authorName };
  await generateOgp({ root, destination: ogpPath, title: article.title, site: localizedSite, brandColor });
  const generatedPwaIcon = `pwa-icons/${slug(article.key)}.png`;

if (site.features?.article_pwa_icons === true && !article.pwaIcon) {
  await generatePwaIcon({
    root,
    destination: path.join(out, 'images', generatedPwaIcon),
    title: article.title,
    site,
    brandColor,
  });
}
  const ogImage = absoluteUrl(`/ogp/${ogpFilename}`);
  const articleIndex = articles.indexOf(article);
  const explicitNext = article.nextArticleKey
    ? articles.find((candidate) => candidate !== article && (candidate.key === article.nextArticleKey || candidate.permalink === article.nextArticleKey))
    : null;
  const sameLanguageArticles = articles.filter((candidate) => candidate.language === article.language);
  const fallbackNext = sameLanguageArticles[sameLanguageArticles.indexOf(article) + 1]
    || sameLanguageArticles.find((candidate) => candidate !== article);
  const nextArticle = explicitNext || fallbackNext;
  const summaryNextHtml = nextArticle
    ? `<p class="article-summary-next"><span>${esc(labels.next)}</span><a href="${esc(withBase(basePath, `/${nextArticle.permalink}/`))}">${esc(nextArticle.title)}</a></p>`
    : '';
  const summaryHtml = site.features?.article_summary !== false && article.summary
    ? `<details class="article-summary"><summary>${esc(labels.summary)}</summary><div class="article-summary-content">${marked.parse(article.summary)}${summaryNextHtml}</div></details>`
    : '';
  const recommendations = articles.filter((candidate) => candidate.language === article.language && candidate !== article && candidate !== nextArticle).slice(0, 3);
  const nextSection = nextArticle
    ? `<section class="next-read" aria-labelledby="next-read-title"><div class="section-label">${esc(labels.next)}</div><h2 id="next-read-title"><a href="${esc(withBase(basePath, `/${nextArticle.permalink}/`))}">${esc(nextArticle.title)}</a></h2><p>${esc(nextArticle.excerpt)}</p></section>`
    : '';
  const authorImage = site.author_image
    ? `<img src="${esc(imageUrl(basePath, site.author_image))}" alt="" loading="lazy">`
    : `<span aria-hidden="true">${esc([...String(authorName)][0])}</span>`;
  const authorSection = `<section class="author-card" aria-label="${esc(labels.author)}"><div class="author-avatar">${authorImage}</div><div class="author-copy"><div class="section-label">${esc(labels.author)}</div><strong>${esc(authorName)}</strong>${authorDescription ? `<p>${esc(authorDescription)}</p>` : ''}${authorUrl ? `<a class="author-link" href="${esc(authorUrl)}" rel="author">${esc(labels.profile)}</a>` : ''}</div></section>`;
  const thumbnailImageUrl = optimizedImageUrl(basePath, article.thumbnail);
  const thumbnail = thumbnailImageUrl && article.showThumbnail
    ? `<figure class="article-thumbnail"><img src="${esc(thumbnailImageUrl)}" alt="${esc(article.thumbnailAlt)}" fetchpriority="high"></figure>`
    : '';
  const articleActions = `<div class="article-actions" aria-label="${esc(labels.articleActions)}"><button type="button" class="icon-button" data-copy-link data-share-url="${esc(canonical)}" data-copy-failed="${esc(labels.copyFailed)}" data-link-copying="${esc(labels.linkCopying)}" data-link-copied="${esc(labels.linkCopied)}" aria-label="${esc(labels.copyLink)}" title="${esc(labels.copyLink)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button><button type="button" class="icon-button" data-share data-share-title="${esc(article.title)}" data-share-url="${esc(canonical)}" data-share-label="${esc(labels.sharing)}" data-copy-failed="${esc(labels.shareFailed)}" data-share-success="${esc(labels.shared)}" data-share-cancelled="${esc(labels.shareCancelled)}" data-url-copied="${esc(labels.urlCopied)}" aria-label="${esc(labels.shareArticle)}" title="${esc(labels.shareArticle)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></svg></button><span class="share-status" data-share-status role="status" aria-live="polite"></span></div>`;
  const recommendationSection = recommendations.length
    ? `<section class="recommendations" aria-label="${esc(labels.recommendations)}"><div class="section-label">${esc(labels.recommendations)}</div><ul class="recommendation-list">${recommendations.map((candidate) => `<li><div class="article-meta">${candidate.published ? `<time datetime="${esc(candidate.published)}">${esc(formatDate(candidate.published, candidate.language))}</time>` : ''}${candidate.category ? ` · ${esc(candidate.category)}` : ''}</div><h3><a href="${esc(withBase(basePath, `/${candidate.permalink}/`))}">${esc(candidate.title)}</a></h3><p>${esc(candidate.excerpt)}</p></li>`).join('')}</ul></section>`
    : '';
  const translation = article.translationKey ? articles.find((candidate) => candidate.key === article.translationKey || candidate.permalink === article.translationKey) : null;
  const translationHtml = translation ? `<a class="translation-link" href="${esc(withBase(basePath, `/${translation.permalink}/`))}" lang="${esc(htmlLanguage(translation.language))}">${esc(labels.languageName)}</a>` : '';
  const jsonld = { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: article.title, description: article.description, datePublished: article.published || undefined, inLanguage: htmlLanguage(article.language), author: { '@type': 'Person', name: authorName }, mainEntityOfPage: canonical, url: canonical, publisher: { '@type': 'Organization', name: site.title } };
  // Inline the small share handler so it still works when a static host's
  // fallback/rewrite rules return HTML for /js/share.js instead of the asset.
  const articleHomePath = languageHomePath(article.language);
  const articleLanguageHomeUrl = languages.length > 1
    ? withBase(basePath, languageHomePath(article.language === 'en' ? 'ja' : 'en'))
    : '';
  const articleBody = `<main class="article"><header class="article-head"><div class="article-meta">${article.published ? `<time datetime="${esc(article.published)}">${esc(formatDate(article.published, article.language))}</time>` : ''}${article.category ? ` · ${esc(article.category)}` : ''}${translationHtml ? ` · ${translationHtml}` : ''}</div><h1>${esc(article.title)}</h1><p class="article-description">${esc(article.description)}</p></header>${thumbnail}${summaryHtml}${tocHtml}<article class="prose">${html}</article>${articleActions}${nextSection}${authorSection}${recommendationSection}<p class="muted"><a href="${esc(withBase(basePath, articleHomePath))}">${esc(labels.backToArticles)}</a></p></main><script>${shareScript}</script>`;
  const defaultLanguageArticle = translation && translation.language === defaultLanguage ? translation : article;
  const alternateLanguages = translation
    ? `<link rel="alternate" hreflang="${esc(htmlLanguage(article.language))}" href="${esc(canonical)}"><link rel="alternate" hreflang="${esc(htmlLanguage(translation.language))}" href="${esc(absoluteUrl(`/${translation.permalink}/`))}"><link rel="alternate" hreflang="x-default" href="${esc(absoluteUrl(`/${defaultLanguageArticle.permalink}/`))}">`
    : '';
  const extra = `${alternateLanguages}<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`;
  const pwaIcon = article.pwaIcon
  || (site.features?.article_pwa_icons === true
    ? generatedPwaIcon
    : site.pwa_icon || site.icon || '');
  const htmlPage = shell({ title: `${article.title} | ${site.title}`, description: article.description, canonical, site, basePath, body: articleBody, extra, ogImage, pwaIcon, customHeadHtml, customBodyHtml, footerHtml: footerHtmlFor(article.language), brandColor, lang: article.language, labels, homePath: articleHomePath, languageHomeUrl: articleLanguageHomeUrl });
  const destination = path.join(out, article.permalink, 'index.html');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, htmlPage);
  sitemap.push(`<url><loc>${esc(canonical)}</loc>${article.published ? `<lastmod>${esc(article.published)}</lastmod>` : ''}</url>`);
  rss.push(`<item><title>${esc(article.title)}</title><link>${esc(canonical)}</link><guid>${esc(canonical)}</guid>${article.published ? `<pubDate>${new Date(`${article.published}T00:00:00Z`).toUTCString()}</pubDate>` : ''}<description>${esc(article.description)}</description></item>`);
}

for (const page of pages) {
  activeCodeLanguage = page.language;
  const pageRenderer = new marked.Renderer();
  pageRenderer.image = renderer.image;
  const contentTokens = page.firstHeading ? page.tokens.slice(page.tokens.indexOf(page.firstHeading) + 1) : page.tokens;
  const content = marked.parser(contentTokens, { renderer: pageRenderer, extensions: marked.defaults.extensions });
  const body = fillTemplate(pageTemplate, {
    pageTitle: esc(page.title),
    pageDescription: page.description ? `<p class="article-description">${esc(page.description)}</p>` : '',
    pageContent: content,
  });
  const canonical = absoluteUrl(`/${page.permalink}/`);
  const destination = path.join(out, page.permalink, 'index.html');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, shell({
    title: `${page.title} | ${site.title}`,
    description: page.description,
    canonical,
    site,
    basePath,
    body,
    customHeadHtml,
    customBodyHtml,
    footerHtml: footerHtmlFor(page.language),
    brandColor,
    lang: page.language,
    homePath: page.language === defaultLanguage ? '/' : `/${page.language}/`,
  }));
}

await fs.writeFile(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(absoluteUrl('/'))}</loc></url>${languages.filter((language) => language !== defaultLanguage).map((language) => `<url><loc>${esc(absoluteUrl(languageHomePath(language)))}</loc></url>`).join('')}${sitemap.join('')}${pages.map((page) => `<url><loc>${esc(absoluteUrl(`/${page.permalink}/`))}</loc></url>`).join('')}</urlset>`);
await fs.writeFile(path.join(out, 'rss.xml'), `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(site.title)}</title><link>${esc(absoluteUrl('/'))}</link><description>${esc(site.description)}</description><language>${esc(site.language || 'ja-JP')}</language>${rss.join('')}</channel></rss>`);
await fs.writeFile(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`);
await fs.cp(path.join(root, 'public'), out, { recursive: true });
console.log(`Built ${articles.length} article(s) and ${pages.length} static page(s) into dist/ (base path: ${basePath || '/'})`);
