import { CUTS, store, listJSON } from '../lib/shared.mjs';

const esc = (s) => String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

/** RSS feed: customers can follow new and updated recipes in any feed reader. */
export default async (req) => {
  const origin = new URL(req.url).origin;
  const list = (await listJSON(store('recipes'), 'r/'))
    .filter((r) => r.published)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 30);
  const items = list.map((r) => {
    const isUpdate = r.updatedAt !== r.createdAt && r.changelog && r.changelog.length;
    const note = isUpdate ? r.changelog[r.changelog.length - 1].note : '';
    return `<item><title>${esc((isUpdate ? 'Updated: ' : '') + r.title)}</title>` +
      `<link>${origin}/r/${r.slug}</link><guid isPermaLink="false">${esc(r.slug + '@' + r.updatedAt)}</guid>` +
      `<category>${esc(CUTS[r.cut] || r.cut)}</category><pubDate>${new Date(r.updatedAt).toUTCString()}</pubDate>` +
      `<description>${esc(note ? note + ' | ' + r.intro : r.intro)}</description></item>`;
  }).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>The Gilt Recipes</title>` +
    `<link>${origin}/</link><description>Recipes for every cut from The Gilt Butchery</description>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=300' } });
};

export const config = { path: ['/api/feed', '/feed.xml'] };
