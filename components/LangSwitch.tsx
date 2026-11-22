import type { Lang } from '@/lib/posts';

const MONO = "font-mono";

/** EN / 한 switch. Each side is a link; a side with no version to go to is shown dimmed. */
export default function LangSwitch({ current, hrefs }: { current: Lang; hrefs: Partial<Record<Lang, string>> }) {
  const items: { lang: Lang; label: string; name: string }[] = [
    { lang: 'en', label: 'EN', name: 'English' },
    { lang: 'ko', label: '한', name: '한국어' },
  ];
  return (
    <nav
      aria-label="Language"
      className={`${MONO} inline-flex overflow-hidden rounded-md border border-[var(--line-strong)] text-[12px] font-medium tracking-[0.08em]`}
    >
      {items.map((it) => {
        const href = hrefs[it.lang];
        const base = 'inline-flex min-h-9 min-w-11 items-center justify-center px-3 no-underline';
        if (it.lang === current) {
          return (
            <span key={it.lang} lang={it.lang} aria-current="true" aria-label={it.name} className={`${base} bg-[var(--ink)] text-[var(--ground)]`}>
              {it.label}
            </span>
          );
        }
        if (!href) {
          return (
            <span key={it.lang} lang={it.lang} aria-label={`${it.name} (not available)`} className={`${base} text-[var(--line-strong)]`}>
              {it.label}
            </span>
          );
        }
        return (
          <a
            key={it.lang}
            href={href}
            lang={it.lang}
            hrefLang={it.lang}
            aria-label={it.name}
            className={`${base} text-[var(--muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--green-text)]`}
          >
            {it.label}
          </a>
        );
      })}
    </nav>
  );
}
