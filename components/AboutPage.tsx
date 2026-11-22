'use client';

/**
 * Doyeon — about page.
 *
 * One continuous introduction (no section headings) with link chips in the text, rows of
 * photos between paragraphs (one wide photo, or two side by side) that open in a large view
 * with previous / next, and the paw-print reading bar under a sticky menu bar.
 *
 * Needs: components/SiteChrome.tsx and components/ReadingPaws.tsx (shared menu bar, footer,
 * theme and paw bar), Tailwind CSS v4, and the fonts loaded in app/layout.tsx
 * (Newsreader, Figtree, IBM Plex Mono). Images live in /public (see PHOTO_ROWS below).
 */

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import SiteChrome from '@/components/SiteChrome';

// ---------------------------------------------------------------------------
// Photos, row by row as they appear in the text. Put the image in /public/about/ and set src;
// until then a labelled placeholder shows. A row of one photo is wide; a row of two sits side by side.
// ---------------------------------------------------------------------------

type Photo = { label: string; alt: string; caption: string; src?: string };

const PHOTO_ROWS: Photo[][] = [
  [{ label: '[Photo: Jeju]', alt: 'Jeju', caption: 'Jeju' }],
  [
    { label: '[Photo: my setup]', alt: 'My desk and setup', caption: 'My setup' },
    { label: '[Photo: something I built]', alt: 'Something I built', caption: 'Something I built' },
  ],
  [{ label: '[Photo: the Arch Linux research]', alt: 'My Arch Linux research project', caption: 'Arch Linux research' }],
  [
    { label: '[Photo: CSHS]', alt: 'CSHS', caption: 'CSHS' },
    { label: '[Photo: GreenRush]', alt: 'GreenRush', caption: 'GreenRush' },
  ],
  [{ label: '[Photo: Thank You Jeju]', alt: 'Volunteering with Thank You Jeju', caption: 'Thank You Jeju' }],
  [
    { label: '[Photo: a drawing]', alt: 'One of my drawings', caption: 'Drawing' },
    { label: '[Photo: tennis]', alt: 'Playing tennis', caption: 'Tennis' },
  ],
  [
    { label: 'My dog', alt: 'My dog, drawn in ASCII', caption: 'My dog, in ASCII', src: '/about/dog-ascii.png' },
    { label: '[Photo: my dog]', alt: 'My dog', caption: 'My dog' },
  ],
];

const ALL_PHOTOS = PHOTO_ROWS.flat();
const LOGO_DARK = '/doyeon-icon-background-256.png';
const LOGO_LIGHT = '/doyeon-icon-transparent-256.png';

const MONO = "font-mono";
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--green-text)]';

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

/** an inline link chip: a small icon or letter box, then the name */
function Chip({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  const external = href.startsWith('http');
  return (
    <Link
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={`mx-px inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] py-0 pr-1.5 pl-1 align-[-3px] text-[0.92em] leading-[26px] text-[var(--ink)] no-underline transition-colors hover:border-[var(--ink)] ${FOCUS}`}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function Letter({ children }: { children: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${MONO} inline-flex h-4 w-4 items-center justify-center rounded bg-[var(--line-strong)] text-[10px] leading-none font-medium text-[var(--ground)]`}
    >
      {children}
    </span>
  );
}

function Logo() {
  return (
    <>
      <Image src={LOGO_DARK} alt="" width={18} height={18} className="block h-[18px] w-[18px] rounded [[data-theme=light]_&]:hidden" />
      <Image src={LOGO_LIGHT} alt="" width={18} height={18} className="hidden h-[18px] w-[18px] [[data-theme=light]_&]:block" />
    </>
  );
}

function Stroke({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
      {children}
    </svg>
  );
}

function PhotoRow({ id, row, start, onOpen }: { id: string; row: Photo[]; start: number; onOpen: (i: number, trigger: HTMLButtonElement) => void }) {
  const one = row.length === 1;
  return (
    <ul id={id} aria-label="Photos" className={`my-3 grid scroll-mt-20 list-none gap-3.5 p-0 ${one ? 'grid-cols-1' : 'grid-cols-2 @max-[460px]:grid-cols-1'}`}>
      {row.map((p, k) => (
        <li key={p.label} className="min-w-0">
          <button
            type="button"
            onClick={(event) => onOpen(start + k, event.currentTarget)}
            aria-label={`Enlarge photo: ${p.alt}`}
            className={`relative block w-full cursor-zoom-in overflow-hidden rounded-lg border border-[var(--image-border)] bg-[var(--surface)] p-0 transition-[transform,border-color] duration-200 hover:scale-[1.015] hover:border-[var(--ink)] motion-reduce:transition-none ${one ? 'aspect-video' : 'aspect-[4/3]'} ${FOCUS}`}
          >
            {p.src ? (
              <Image fill sizes="(max-width: 680px) 90vw, 620px" src={p.src} alt={p.alt} className="block h-full w-full object-cover" />
            ) : (
              <span className={`${MONO} absolute inset-0 box-border flex items-center justify-center p-3 text-center text-[12px] tracking-[0.04em] text-[var(--muted)]`}>
                {p.label}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function IconButton({ label, onClick, d, btnRef }: { label: string; onClick: () => void; d: string; btnRef?: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={btnRef}
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-[var(--line-strong)] bg-[var(--surface)] p-0 text-[var(--ink)] transition-colors hover:border-[var(--ink)] ${FOCUS}`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AboutPage() {
  const [open, setOpen] = useState(-1);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const n = ALL_PHOTOS.length;

  const show = useCallback((i: number, trigger: HTMLButtonElement) => {
    lastFocus.current = trigger;
    setOpen(i);
  }, []);
  const close = useCallback(() => {
    dialogRef.current?.close();
    setOpen(-1);
    lastFocus.current?.focus();
  }, []);
  const next = useCallback(() => setOpen((i) => (i + 1) % n), [n]);
  const prev = useCallback(() => setOpen((i) => (i - 1 + n) % n), [n]);

  // keyboard and scroll lock while the large view is open
  useEffect(() => {
    if (open < 0) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, close, next, prev]);

  // where each row's photos start in the full list
  const starts: number[] = [];
  PHOTO_ROWS.reduce((acc, row) => (starts.push(acc), acc + row.length), 0);
  const row = (i: number) => <PhotoRow id={`photos-${i + 1}`} row={PHOTO_ROWS[i]} start={starts[i]} onOpen={show} />;
  const shot = open >= 0 ? ALL_PHOTOS[open] : null;

  return (
    <SiteChrome progress>
      <main className="mx-auto box-border flex w-full max-w-[680px] flex-auto flex-col gap-[22px] px-[clamp(20px,4cqw,32px)] pt-[clamp(40px,7cqw,88px)] pb-24 text-[19px] leading-[1.7]">
        <h1 className={`${MONO} m-0 mb-1.5 text-[12px] leading-4 font-medium tracking-[0.08em] text-[var(--muted)] uppercase`}>About</h1>

        <p className="m-0">
          I&apos;m Doyeon. I grew up on <Chip href="#photos-1" icon={<Letter>J</Letter>}>Jeju</Chip>, and I work on software, mostly where it
          meets security: understanding a system well enough to know how it breaks, then building things that hold up. My resume lists
          the titles. This is the longer story behind them.
        </p>
        {row(0)}

        <p className="m-0">
          Security appeals to me because it rewards curiosity. You read how something is supposed to work, then look for the places where
          it doesn&apos;t, and along the way you end up learning every layer: the network, the operating system, the code, and the people
          using it. I like the building side just as much, end to end, from the backend to the part someone actually touches. This site is
          one of those things; the snow on <Chip href="/" icon={<Logo />}>the home page</Chip> is a small physics simulation drawn entirely
          in text.
        </p>
        {row(1)}

        <p className="m-0">
          A lot of it started with Linux. In high school I ran a research project on toxicity in the{' '}
          <Chip href="https://archlinux.org/" icon={<Letter>A</Letter>}>Arch Linux</Chip> community, a place known both for excellent
          documentation and for being hard on newcomers. I wanted to see where that reputation comes from and how it plays out where
          beginners ask for help. It was the first time I treated a technical community as something to study rather than just use.
        </p>
        {row(2)}

        <p className="m-0">
          Since then I&apos;ve done technical work in very different places. As CTO for <Chip href="#" icon={<Letter>C</Letter>}>CSHS</Chip>,
          I owned the technical side: the systems we ran on, the decisions about how to build them, and explaining those decisions to
          people who weren&apos;t technical. I worked on <Chip href="#" icon={<Letter>G</Letter>}>GreenRush</Chip>, [one sentence on what it
          is and what you did]. And back home I volunteered with <Chip href="#photos-5" icon={<Letter>T</Letter>}>Thank You Jeju</Chip>,
          [what the work was and who it helped], which is the work I&apos;m proudest of, because it was for the place I&apos;m from. Each one
          came with a different stack and a different kind of team, and getting useful quickly in an unfamiliar setup is the thing I&apos;d
          point to before any single line on my resume.
        </p>
        {row(3)}
        {row(4)}

        <p className="m-0">
          Away from the screen, I draw and I play tennis. Drawing is the slow, patient counterpart to programming; tennis is the opposite,
          fast and impossible to overthink, and I like having one of each. Most days I&apos;m also out with{' '}
          <Chip href="#photos-7" icon={<Logo />}>my dog</Chip>, who, as you&apos;ve seen, runs the home page.
        </p>
        {row(5)}
        {row(6)}

        <p className="m-0">
          If any of this overlaps with what you&apos;re working on, I&apos;d like to hear about it. You can find my code on{' '}
          <Chip href="https://github.com/" icon={<Stroke><path d="M8 7l-5 5 5 5M16 7l5 5-5 5" /></Stroke>}>GitHub</Chip>, connect on{' '}
          <Chip
            href="https://www.linkedin.com/"
            icon={
              <Stroke>
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7" />
              </Stroke>
            }
          >
            LinkedIn
          </Chip>
          , or{' '}
          <Chip
            href="mailto:you@example.com"
            icon={
              <Stroke>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 7l9 6 9-6" />
              </Stroke>
            }
          >
            email me
          </Chip>
          .
        </p>
      </main>

      {/* ---------------- the large photo view ---------------- */}
      {shot && (
        <dialog ref={dialogRef} onCancel={(event) => { event.preventDefault(); close(); }} aria-label={shot.alt} className="fixed inset-0 z-50 m-0 box-border flex h-dvh max-h-none w-full max-w-none items-center justify-center border-0 bg-transparent p-[clamp(16px,4vw,48px)] text-[var(--ink)]">
          <button
            type="button"
            aria-label="Close photo backdrop"
            tabIndex={-1}
            onClick={close}
            className="absolute inset-0 h-full w-full cursor-zoom-out border-0 bg-[color-mix(in_srgb,var(--ground)_88%,transparent)] p-0 backdrop-blur-md"
          />
          <figure className="relative m-0 flex max-h-full w-[min(1000px,100%)] flex-col gap-3.5">
            <div className="relative aspect-[4/3] max-h-[calc(100vh-160px)] w-full overflow-hidden rounded-[10px] border border-[var(--image-border)] bg-[var(--surface)]">
              {shot.src ? (
                <Image fill sizes="(max-width: 1000px) 95vw, 1000px" src={shot.src} alt={shot.alt} className="block h-full w-full object-contain" />
              ) : (
                <span className={`${MONO} absolute inset-0 flex items-center justify-center text-sm text-[var(--muted)]`}>{shot.label}</span>
              )}
            </div>
            <figcaption className={`${MONO} flex items-center justify-between gap-3 text-[12px] font-medium tracking-[0.08em] text-[var(--ink)] uppercase`}>
              <span>
                {shot.caption} · {open + 1} / {n}
              </span>
              <span className="flex gap-2">
                <IconButton label="Previous photo" onClick={prev} d="M15 6l-6 6 6 6" />
                <IconButton label="Next photo" onClick={next} d="M9 6l6 6-6 6" />
                <IconButton label="Close photo" onClick={close} d="M6 6l12 12M18 6L6 18" btnRef={closeRef} />
              </span>
            </figcaption>
          </figure>
        </dialog>
      )}
    </SiteChrome>
  );
}
