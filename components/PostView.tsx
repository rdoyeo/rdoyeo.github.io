import SiteChrome from '@/components/SiteChrome';
import LangSwitch from '@/components/LangSwitch';
import Markdown from '@/components/Markdown';
import ZoomableArticle from '@/components/ZoomableArticle';
import { LANGS, formatDate, postHref } from '@/lib/posts';
import type { Post, PostVersion } from '@/lib/posts';

const MONO = "font-mono";
const SMALL = `${MONO} text-[12px] font-medium tracking-[0.08em] uppercase`;

export default function PostView({ post, version }: { post: Post; version: PostVersion }) {
  const ko = version.lang === 'ko';
  const hrefs = Object.fromEntries(LANGS.filter((l) => post.versions[l]).map((l) => [l, postHref(post.slug, l)]));
  const backHref = ko ? '/writing?lang=ko' : '/writing';
  const backLabel = ko ? '모든 글' : 'All writing';
  const linkCls = `${SMALL} inline-flex min-h-11 items-center gap-2 text-[var(--muted)] no-underline transition-colors hover:text-[var(--ink)] focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--green-text)]`;

  return (
    <SiteChrome progress>
      <main lang={version.lang} className="mx-auto box-border flex w-full max-w-[720px] flex-1 flex-col gap-10 px-[clamp(20px,4cqw,32px)] pt-[clamp(40px,7cqw,80px)] pb-24">
        <a href={backHref} className={`${linkCls} self-start`}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          {backLabel}
        </a>

        <header className="flex flex-col gap-[18px]">
          <h1 className="m-0 text-[clamp(32px,5cqw,44px)] leading-[1.15] font-extrabold tracking-[-0.02em]">{version.title}</h1>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className={`${SMALL} flex flex-wrap items-center gap-x-4 gap-y-2 text-[var(--muted)]`}>
              <time dateTime={version.date}>{formatDate(version.date, version.lang)}</time>
              <span aria-hidden="true">·</span>
              <span>{ko ? `${version.minutes}분` : `${version.minutes} min read`}</span>
              {version.tags.length > 0 && (
                <span className="flex flex-wrap gap-2">
                  {version.tags.map((t) => (
                    <span key={t} className="rounded-md border border-[var(--line-strong)] px-2 py-[3px] text-[var(--ink)]">
                      {t}
                    </span>
                  ))}
                </span>
              )}
            </div>
            <LangSwitch current={version.lang} hrefs={hrefs} />
          </div>
        </header>

        <ZoomableArticle ko={ko} className="prose flex flex-col gap-6 border-t border-[var(--line)] pt-10">
          <Markdown source={version.body} lang={version.lang} />
        </ZoomableArticle>

        <nav aria-label="Post" className={`${SMALL} flex flex-wrap justify-between gap-4 border-t border-[var(--line)] pt-6`}>
          <a href={backHref} className={linkCls}>{backLabel}</a>
          <a href="#top" className={linkCls}>{ko ? '맨 위로' : 'Back to top'}</a>
        </nav>
      </main>
    </SiteChrome>
  );
}
