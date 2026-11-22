/**
 * Reads the posts in content/posts.
 *
 * Each post is a folder named after its URL slug, holding one Markdown file per language:
 *
 *   content/posts/how-math-looks/en.md
 *   content/posts/how-math-looks/ko.md   (optional: a translation)
 *
 * Each file starts with front matter:
 *
 *   ---
 *   title: How math looks on this blog
 *   date: 2026-11-20
 *   tags: [mathematics, meta]
 *   draft: false            # optional; drafts are hidden
 *   ---
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export const LANGS = ['en', 'ko'] as const;
export type Lang = (typeof LANGS)[number];
/** the language a post opens in at /writing/<slug>; the other one lives at /writing/<slug>/<lang> */
export const DEFAULT_LANG: Lang = 'en';

const POSTS_DIR = path.join(process.cwd(), 'content', 'posts');

export type PostVersion = {
  slug: string;
  lang: Lang;
  title: string;
  date: string;       // YYYY-MM-DD
  tags: string[];
  body: string;       // the Markdown after the front matter
  minutes: number;
};

export type Post = {
  slug: string;
  date: string;
  versions: Partial<Record<Lang, PostVersion>>;
};

export function isLang(x: string): x is Lang {
  return (LANGS as readonly string[]).includes(x);
}

function toDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const date = String(v ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid post date: ${String(v)}. Use YYYY-MM-DD.`);
  }
  return date;
}

function readingMinutes(body: string, lang: Lang): number {
  const text = body.replace(/\$\$[\s\S]*?\$\$|\$[^$\n]*\$|```[\s\S]*?```/g, ' ');
  // roughly 230 English words or 500 Korean characters a minute
  const units = lang === 'ko' ? text.replace(/\s+/g, '').length / 500 : text.split(/\s+/).filter(Boolean).length / 230;
  return Math.max(1, Math.round(units));
}

function readVersion(slug: string, lang: Lang): PostVersion | null {
  const file = path.join(POSTS_DIR, slug, `${lang}.md`);
  if (!fs.existsSync(file)) return null;
  const { data, content } = matter(fs.readFileSync(file, 'utf8'));
  if (data.draft === true && process.env.NODE_ENV === 'production') return null;
  return {
    slug,
    lang,
    title: String(data.title ?? slug),
    date: toDate(data.date),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    body: content,
    minutes: readingMinutes(content, lang),
  };
}

export function getPost(slug: string): Post | null {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return null;
  const versions: Post['versions'] = {};
  for (const lang of LANGS) {
    const v = readVersion(slug, lang);
    if (v) versions[lang] = v;
  }
  const first = versions[DEFAULT_LANG] ?? Object.values(versions)[0];
  if (!first) return null;
  return { slug, date: first.date, versions };
}

/** every post, newest first */
export function getAllPosts(): Post[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => getPost(d.name))
    .filter((p): p is Post => p !== null)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** the version to show for a language, falling back to whichever exists */
export function pick(post: Post, lang: Lang): PostVersion {
  return (post.versions[lang] ?? post.versions[DEFAULT_LANG] ?? Object.values(post.versions)[0]) as PostVersion;
}

export function postHref(slug: string, lang: Lang): string {
  return lang === DEFAULT_LANG ? `/writing/${slug}` : `/writing/${slug}/${lang}`;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatDate(date: string, lang: Lang): string {
  const [y, m, d] = date.split('-').map(Number);
  return lang === 'ko' ? `${y}년 ${m}월 ${d}일` : `${String(d).padStart(2, '0')} ${MON[m - 1].toUpperCase()} ${y}`;
}

export function formatDay(date: string, lang: Lang): string {
  const [, m, d] = date.split('-').map(Number);
  return lang === 'ko' ? `${m}월 ${d}일` : `${String(d).padStart(2, '0')} ${MON[m - 1].toUpperCase()}`;
}

export function formatMonth(date: string, lang: Lang): string {
  const [y, m] = date.split('-').map(Number);
  return lang === 'ko' ? `${y}년 ${m}월` : `${MONTH[m - 1]} ${y}`;
}
