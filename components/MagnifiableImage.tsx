'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

export type StoryImage = { src: string; alt: string; width: number; height: number; caption: string };

function ImageViewer({ image, onClose }: { image: StoryImage; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog ref={dialog} aria-label={`Image viewer: ${image.alt}`} onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-0 m-auto max-h-[94dvh] w-[min(96vw,1200px)] max-w-none overflow-hidden rounded-xl border border-[var(--image-border)] bg-[var(--ground)] p-0 text-[var(--ink)] backdrop:bg-black/85">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] p-4">
        <button type="button" onClick={() => setZoomed(!zoomed)} aria-pressed={zoomed}
          className="min-h-11 cursor-pointer rounded-md border border-[var(--line-strong)] px-4 focus-visible:outline-2 focus-visible:outline-[var(--green-text)]">
          {zoomed ? 'Fit image' : 'Zoom in'}
        </button>
        <button type="button" autoFocus onClick={onClose} aria-label="Close image viewer"
          className="min-h-11 cursor-pointer rounded-md px-4 text-[var(--green-text)] focus-visible:outline-2 focus-visible:outline-[var(--green-text)]">Close</button>
      </div>
      <div className="max-h-[65dvh] overflow-auto overscroll-contain bg-[var(--raised)]" tabIndex={0} aria-label="Image; scroll to explore when zoomed">
        <div className={zoomed ? 'w-[200%] max-w-none' : 'w-full'}>
          <Image src={image.src} alt={image.alt} width={image.width} height={image.height} unoptimized
            className={zoomed ? 'block h-auto w-full' : 'mx-auto block h-auto max-h-[65dvh] w-full object-contain'} />
        </div>
      </div>
      <p className="px-5 py-4 text-sm text-[var(--muted)]">{image.caption}</p>
    </dialog>
  );
}

export default function MagnifiableImage({ image }: { image: StoryImage }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return (
    <figure className="min-w-0">
      <button ref={trigger} type="button" aria-label={`Enlarge image: ${image.alt}`} onClick={() => setOpen(true)}
        className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl border border-[var(--image-border)] bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--green-text)]">
        <Image src={image.src} alt={image.alt} width={image.width} height={image.height} sizes="(max-width: 700px) 90vw, 440px"
          className="aspect-[4/3] w-full object-contain p-8 transition-transform group-hover:scale-105 motion-reduce:transition-none" />
        <span className="absolute right-3 bottom-3 rounded-md border border-[var(--line)] bg-[var(--ground)] px-3 py-2 font-mono text-sm text-[var(--green-text)]">Enlarge +</span>
      </button>
      <figcaption className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{image.caption}</figcaption>
      {open && <ImageViewer image={image} onClose={close} />}
    </figure>
  );
}
