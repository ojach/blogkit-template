import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;

function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[char]);
}

function safeColor(value) {
  const color = String(value ?? '').trim();
  return /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(color) ? color : '#187a68';
}

function tint(hex, amount = 0.9) {
  let value = hex.slice(1);
  if (value.length === 3) value = [...value].map((part) => part + part).join('');
  const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
  return `#${channels.map((channel) => Math.round(channel + (255 - channel) * amount).toString(16).padStart(2, '0')).join('')}`;
}

function splitTitle(value, maxCharacters) {
  const text = String(value ?? '');
  if (/^[\x00-\x7f\s]+$/.test(text) && /\s/.test(text)) {
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      if (!line || line.length + word.length + 1 <= maxCharacters) {
        line = line ? `${line} ${word}` : word;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }
  const chars = [...text];
  const lines = [];
  while (chars.length) lines.push(chars.splice(0, maxCharacters).join(''));
  return lines.length ? lines : [''];
}

async function embeddedImage(root, value) {
  const filename = String(value ?? '').trim().replace(/^\/+/, '').replace(/^images\//, '');
  if (!filename || /^[a-z][a-z\d+.-]*:/i.test(filename) || filename.startsWith('//')) return '';
  const file = path.resolve(root, 'public/images', filename);
  const imagesRoot = path.resolve(root, 'public/images') + path.sep;
  if (!file.startsWith(imagesRoot)) throw new Error(`OGP icon must be inside public/images/: ${value}`);
  try {
    const image = await sharp(file).resize(96, 96, { fit: 'cover' }).png().toBuffer();
    return `data:image/png;base64,${image.toString('base64')}`;
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`OGP icon not found: public/images/${filename}`);
    throw error;
  }
}

function iconMarkup(data, x, y, size, clipId, fallback, accent) {
  if (data) {
    return `<clipPath id="${clipId}"><circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}"/></clipPath><image href="${data}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`;
  }
  const initial = [...String(fallback || '?')][0];
  return `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}" fill="${tint(accent, 0.82)}"/><text x="${x + size / 2}" y="${y + size * 0.68}" text-anchor="middle" font-family="Noto Sans JP, Noto Sans CJK JP, Yu Gothic, Meiryo, sans-serif" font-size="${Math.round(size * 0.48)}" font-weight="700" fill="${accent}">${escapeXml(initial)}</text>`;
}

export async function generateOgp({ root, destination, title, site, brandColor }) {
  const accent = safeColor(brandColor);
  const frame = tint(accent, 0.87);
  const blogIcon = await embeddedImage(root, site.icon);
  const authorIcon = await embeddedImage(root, site.author_image);
  const fullTitle = [...String(title ?? '')];
  const displayTitle = fullTitle.length > 60 ? `${fullTitle.slice(0, 59).join('')}…` : String(title ?? '');
  const lines = splitTitle(displayTitle, fullTitle.length > 50 ? 23 : fullTitle.length > 32 ? 20 : 17);
  const fontSize = fullTitle.length > 50 ? 43 : fullTitle.length > 32 ? 50 : 58;
  const lineHeight = Math.round(fontSize * 1.34);
  const titleHeight = lines.length * lineHeight;
  const titleStartY = Math.round(330 - titleHeight / 2 + fontSize * 0.82);
  const titleMarkup = lines.map((line, index) => `<text x="92" y="${titleStartY + index * lineHeight}" font-family="'Noto Sans CJK JP'" font-size="${fontSize}" font-weight="700" letter-spacing="-1.5" fill="#17212b">${escapeXml(line)}</text>`).join('');
  const siteName = escapeXml(site.title || 'My Blog');
  const authorName = escapeXml(site.author || '著者');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#17212b" flood-opacity=".08"/></filter>
      <clipPath id="cardClip"><rect x="20" y="20" width="1160" height="590" rx="28"/></clipPath>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${frame}"/>
    <rect x="20" y="20" width="1160" height="590" rx="28" fill="#fff" filter="url(#shadow)"/>
    ${iconMarkup(blogIcon, 76, 72, 56, 'blogIcon', site.title || 'B', accent)}
    <text x="148" y="111" font-family="'Noto Sans CJK JP'" font-size="27" font-weight="700" fill="#17212b">${siteName}</text>
    <g clip-path="url(#cardClip)">
      <circle cx="1140" cy="68" r="185" fill="${tint(accent, 0.91)}" opacity=".72"/>
      <circle cx="1000" cy="185" r="120" fill="${tint(accent, 0.96)}" opacity=".9"/>
      <circle cx="1200" cy="265" r="150" fill="none" stroke="${accent}" stroke-width="2" opacity=".62"/>
    </g>
    ${titleMarkup}
    <rect x="92" y="475" width="108" height="6" rx="3" fill="${accent}"/>
    ${iconMarkup(authorIcon, 926, 510, 66, 'authorIcon', site.author || '著者', accent)}
    <text x="1010" y="552" font-family="'Noto Sans CJK JP'" font-size="23" font-weight="600" fill="#475569">${authorName}</text>
  </svg>`;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(destination);
}
