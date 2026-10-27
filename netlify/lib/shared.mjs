import { getStore } from '@netlify/blobs';
import { timingSafeEqual } from 'node:crypto';

export const CUTS = {
  head: 'Head',
  jowl: 'Jowl',
  neck: 'Neck',
  shoulder: 'Shoulder',
  picnic: 'Picnic',
  backfat: 'Back Fat',
  loin: 'Loin & Chops',
  ribs: 'Ribs',
  belly: 'Belly & Bacon',
  leg: 'Leg & Ham',
  trotters: 'Hocks & Trotters',
};

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
export const UID_RE = /^[a-z0-9]{12,40}$/;

export const store = (name) => getStore({ name, consistency: 'strong' });

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export const bad = (msg, status = 400) => json({ error: msg }, status);

export function isAdmin(req) {
  const key = process.env.ADMIN_KEY || '';
  const given = req.headers.get('x-admin-key') || '';
  if (key.length < 8 || !given) return false;
  const a = Buffer.from(key), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Trim, strip control characters, cap length. Output is always escaped by the frontend. */
export function clean(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

export function cleanList(value, maxItems, maxLen) {
  const arr = Array.isArray(value) ? value : String(value ?? '').split('\n');
  return arr.map((s) => clean(s, maxLen)).filter(Boolean).slice(0, maxItems);
}

export const slugify = (s) =>
  String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim()
    .replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'recipe';

export async function readJSON(req) {
  try {
    const text = await req.text();
    if (text.length > 6_000_000) return null;
    return JSON.parse(text || '{}');
  } catch {
    return null;
  }
}

/** Fetch every JSON blob under a prefix (small collections only). */
export async function listJSON(st, prefix) {
  const { blobs } = await st.list({ prefix });
  const items = await Promise.all(blobs.map((b) => st.get(b.key, { type: 'json' }).catch(() => null)));
  return items.filter(Boolean);
}

/** Very small per-IP cooldown to slow spam. Returns true when the caller must wait. */
export async function throttled(context, bucket, seconds) {
  const ip = (context && context.ip) || 'unknown';
  const st = store('ratelimit');
  const key = `${bucket}/${ip.replace(/[^a-zA-Z0-9.:]/g, '_')}`;
  const last = await st.get(key, { type: 'json' }).catch(() => null);
  const now = Date.now();
  if (last && now - last.t < seconds * 1000) return true;
  await st.setJSON(key, { t: now });
  return false;
}
