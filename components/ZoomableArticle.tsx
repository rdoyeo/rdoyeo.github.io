/* eslint-disable @next/next/no-img-element -- Markdown images have author-defined URLs and dimensions. */
'use client';

/**
 * Wraps a post body so every image in it can be clicked to open a large view,
 * with previous / next between the post's images (same behaviour as the About page photos).
 * Works on the server-rendered Markdown: it finds the images after the page loads.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';

type Shot = { src: string; alt: string; caption: string };

const MONO = "font-mono";
const BTN =
  'inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-[var(--line-strong)] bg-[var(--surface)] p-0 text-[var(--ink)] transition-colors hover:border-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--green-text)]';

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function ZoomableArticle({ className, ko, children }: { className?: string; ko?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [open, setOpen] = useState(-1);

  // find the images and make each one a keyboard-reachable zoom target
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
    imgs.forEach((img, i) => {
      img.dataset.zoom = String(i);
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', `${ko ? '크게 보기' : 'Enlarge'}: ${img.alt || (ko ? '이미지' : 'image')}`);
    });
  }, [children, ko]);

  const show = useCallback((i: number) => {
    const imgs = Array.from(ref.current?.querySelectorAll<HTMLImageElement>('img') ?? []);
    setShots(imgs.map((img) => ({ src: img.currentSrc || img.src, alt: img.alt,
      caption: img.closest('figure')?.querySelector('figcaption')?.textContent ?? img.alt })));
    lastFocus.current = document.activeElement as HTMLElement | null;
    setOpen(i);
  }, []);
  const close = useCallback(() => {
    setOpen(-1);
    lastFocus.current?.focus();
  }, []);

  const onClick = (e: ReactMouseEvent) => {
    const t = (e.target as HTMLElement).closest<HTMLImageElement>('img[data-zoom]');
    if (t) show(Number(t.dataset.zoom));
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const t = (e.target as HTMLElement).closest<HTMLImageElement>('img[data-zoom]');
    if (t && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      show(Number(t.dataset.zoom));
    }
  };

  // keys while the large view is open
  useEffect(() => {
    if (open < 0) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    closeRef.current?.focus();
    const n = shots.length;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' && n > 1) setOpen((i) => (i + 1) % n);
      else if (e.key === 'ArrowLeft' && n > 1) setOpen((i) => (i - 1 + n) % n);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, shots.length, close]);

  const shot = open >= 0 ? shots[open] : null;

  return (
    <>
      <article ref={ref} className={className} onClick={onClick} onKeyDown={onKeyDown}>
        {children}
      </article>

      {shot && (
        <dialog ref={dialogRef} onCancel={(event) => { event.preventDefault(); close(); }} aria-label={shot.alt || shot.caption} className="fixed inset-0 z-50 m-0 box-border flex h-dvh max-h-none w-full max-w-none items-center justify-center border-0 bg-transparent p-[clamp(16px,4vw,48px)] text-[var(--ink)]">
          <button
            type="button"
            aria-label={ko ? '닫기' : 'Close image'}
            onClick={close}
            className="absolute inset-0 h-full w-full cursor-zoom-out border-0 bg-[color-mix(in_srgb,var(--ground)_88%,transparent)] p-0 backdrop-blur-md"
          />
          <figure className="relative m-0 flex max-h-full w-[min(1000px,100%)] flex-col gap-3.5">
            <div className="zoom-frame relative box-border flex aspect-[4/3] max-h-[calc(100vh-160px)] w-full items-center justify-center overflow-hidden rounded-[10px] border border-[var(--image-border)] bg-[var(--surface)] p-6">
              <img src={shot.src} alt={shot.alt} className="h-full w-full object-contain" />
            </div>
            <figcaption className={`${MONO} flex items-center justify-between gap-3 text-[12px] font-medium tracking-[0.08em] text-[var(--ink)] uppercase`}>
              <span>
                {shot.caption}
                {shots.length > 1 ? ` · ${open + 1} / ${shots.length}` : ''}
              </span>
              <span className="flex gap-2">
                {shots.length > 1 && (
                  <>
                    <button type="button" className={BTN} aria-label={ko ? '이전' : 'Previous image'} onClick={() => setOpen((i) => (i - 1 + shots.length) % shots.length)}>
                      <Icon d="M15 6l-6 6 6 6" />
                    </button>
                    <button type="button" className={BTN} aria-label={ko ? '다음' : 'Next image'} onClick={() => setOpen((i) => (i + 1) % shots.length)}>
                      <Icon d="M9 6l6 6-6 6" />
                    </button>
                  </>
                )}
                <button ref={closeRef} type="button" className={BTN} aria-label={ko ? '닫기' : 'Close image'} onClick={close}>
                  <Icon d="M6 6l12 12M18 6L6 18" />
                </button>
              </span>
            </figcaption>
          </figure>
        </dialog>
      )}
    </>
  );
}
