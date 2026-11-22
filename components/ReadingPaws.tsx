'use client';

/**
 * Reading progress as paw prints walking along the bottom of the menu bar.
 * Prints appear left to right as you scroll, alternating left and right feet;
 * older prints fade so it looks like the dog just walked past.
 */

import { useEffect, useState } from 'react';

const GAP = 26; // px between prints

function Paw() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
      <ellipse cx="12" cy="15.5" rx="5.2" ry="4.4" />
      <circle cx="5.8" cy="9.6" r="2.2" />
      <circle cx="9.8" cy="6" r="2.2" />
      <circle cx="14.2" cy="6" r="2.2" />
      <circle cx="18.2" cy="9.6" r="2.2" />
    </svg>
  );
}

export default function ReadingPaws() {
  const [progress, setProgress] = useState(0);
  const [width, setWidth] = useState(1440);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = document.documentElement;
      const max = Math.max(1, el.scrollHeight - window.innerHeight);
      setProgress(Math.min(1, Math.max(0, window.scrollY / max)));
      setWidth(window.innerWidth);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const n = Math.max(4, Math.floor((width - 16) / GAP));
  const head = progress * n;
  const prints = [];
  for (let i = 0; i < n && i < head; i++) {
    const age = head - i; // steps since this print was made
    const opacity = age < 1.5 ? 1 : Math.max(0.14, 1 - (age - 1.5) * 0.11);
    prints.push(
      <span
        key={i}
        className="absolute rotate-90 text-[var(--ink)] transition-opacity duration-500 motion-reduce:transition-none"
        style={{ left: 8 + i * GAP, top: i % 2 ? -4 : -8, opacity }}
      >
        <Paw />
      </span>,
    );
  }

  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      className="pointer-events-none absolute inset-x-0 -bottom-px h-px overflow-visible"
    >
      {prints}
    </div>
  );
}
