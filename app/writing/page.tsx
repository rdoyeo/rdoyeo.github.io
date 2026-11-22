/**
 * /writing — every post, grouped by month, newest first. /writing?lang=ko shows Korean titles;
 * a post with no version in the chosen language shows its other title, marked.
 */

import { Suspense } from 'react';
import type { Metadata } from 'next';
import SiteChrome from '@/components/SiteChrome';
import LangSwitch from '@/components/LangSwitch';
import { formatDay, formatMonth, getAllPosts, pick, postHref } from '@/lib/posts';
import type { Lang, Post } from '@/lib/posts';
import ArchiveLanguage from './ArchiveLanguage';
import './writing.css';

export const metadata: Metadata = { title: 'Writing · Doyeon' };

const MONO = "font-mono";

function WritingArchive({ lang, posts }: { lang: Lang; posts: Post[] }) {
  const months: { key: string; label: string; rows: { href: string; day: string; title: string; lang: Lang; only: boolean }[] }[] = [];
  for (const post of posts) {
    const key = post.date.slice(0, 7);
    let month = months[months.length - 1];
    if (!month || month.key !== key) {
      month = { key, label: formatMonth(post.date, lang), rows: [] };
      months.push(month);
    }
    const v = pick(post, lang);
    month.rows.push({ href: postHref(post.slug, v.lang), day: formatDay(post.date, lang), title: v.title, lang: v.lang, only: v.lang !== lang });
  }

  return (
    <main className="mx-auto box-border flex w-full max-w-[760px] flex-1 flex-col gap-12 px-[clamp(20px,4cqw,32px)] pt-[clamp(40px,7cqw,88px)] pb-24">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className={`${MONO} m-0 text-[12px] leading-4 font-medium tracking-[0.08em] text-[var(--muted)] uppercase`}>
          {lang === 'ko' ? '글' : 'Writing'} · {String(posts.length).padStart(2, '0')}
        </h1>
        <LangSwitch current={lang} hrefs={{ en: '/writing', ko: '/writing?lang=ko' }} />
      </div>

      {posts.length === 0 && <p>{lang === 'ko' ? '아직 게시된 글이 없습니다.' : 'No posts published yet.'}</p>}
      {months.map((m) => (
        <section key={m.key} className="flex flex-col gap-1.5">
          <h2 className="m-0 mb-1.5 text-[22px] leading-[1.3] font-extrabold tracking-[-0.01em]">{m.label}</h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {m.rows.map((r) => (
              <li key={r.href} className="border-t border-[var(--line)]">
                <a
                  href={r.href}
                  lang={r.lang}
                  className="group box-border flex min-h-[52px] items-baseline gap-5 py-3 text-[var(--ink)] no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--green-text)]"
                >
                  <span className={`${MONO} flex-[0_0_64px] text-[12px] font-medium tracking-[0.08em] text-[var(--muted)]`}>{r.day}</span>
                  <span className="min-w-0 flex-auto text-[18px] leading-normal decoration-[var(--line-strong)] underline-offset-[5px] group-hover:underline">
                    {r.title}
                  </span>
                  {r.only ? (
                    <span className={`${MONO} flex-none text-[11px] font-medium tracking-[0.08em] text-[var(--muted)]`}>
                      {r.lang === 'ko' ? '한국어' : 'ENGLISH'}
                    </span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

export default function WritingPage() {
  const posts = getAllPosts();
  const english = <WritingArchive lang="en" posts={posts} />;
  const korean = <WritingArchive lang="ko" posts={posts} />;
  return (
    <SiteChrome>
      <Suspense fallback={english}>
        <ArchiveLanguage english={english} korean={korean} />
      </Suspense>
    </SiteChrome>
  );
}
