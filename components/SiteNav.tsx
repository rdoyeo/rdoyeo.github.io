'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import ReadingPaws from './ReadingPaws';
import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
const LOGO_DARK = '/doyeon-icon-background-256.png';
const LOGO_LIGHT = '/doyeon-icon-transparent-256.png';
const LABEL = 'font-mono text-[12px] leading-4 font-medium tracking-[0.08em] uppercase';
const NAV = [
  { href: '/about', label: 'About' },
  { href: '/projects', label: 'Projects' },
  { href: '/writing', label: 'Writing' },
];

export default function SiteNav({ light, setLight, progress = false }: { light: boolean; setLight: Dispatch<SetStateAction<boolean>>; progress?: boolean }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const focusRing = 'focus-visible:outline-2 focus-visible:outline-[var(--green-text)] focus-visible:outline-offset-[-5px]';
  return (
      <header className="sticky top-0 z-20 flex-none border-b border-[var(--line)] bg-[var(--ground)]">
        <div className="flex min-h-14 flex-wrap items-stretch">
          <Link
            href="/"
            aria-label="Doyeon, home"
            className={`flex min-h-14 items-center border-r border-[var(--line)] px-[clamp(16px,2.4cqw,32px)] no-underline @max-[700px]:min-h-12 ${focusRing}`}
          >
            <Image width={256} height={256} src={light ? LOGO_LIGHT : LOGO_DARK} alt="Doyeon" className="block h-9 w-auto @max-[700px]:h-8" />
          </Link>

          <nav
            id="main-navigation"
            aria-label="Main"
            onClick={closeMenu}
            className={[
              LABEL,
              'flex flex-auto items-center gap-x-7 gap-y-2 px-[clamp(16px,2cqw,28px)]',
              menuOpen
                ? '@max-[700px]:order-3 @max-[700px]:w-full @max-[700px]:flex-col @max-[700px]:items-stretch @max-[700px]:gap-0 @max-[700px]:border-t @max-[700px]:border-[var(--line)] @max-[700px]:px-4 @max-[700px]:py-1'
                : '@max-[700px]:hidden',
            ].join(' ')}
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href || pathname?.startsWith(`${item.href}/`) ? 'page' : undefined}
                className={[
                  'inline-flex min-h-11 items-center text-[var(--muted)] no-underline transition-colors hover:text-[var(--ink)] aria-[current=page]:text-[var(--ink)]',
                  'focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--green-text)]',
                  '@max-[700px]:min-h-[52px] @max-[700px]:border-b @max-[700px]:border-[var(--line)] @max-[700px]:last:border-b-0',
                ].join(' ')}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            aria-label="Switch between dark and light mode"
            onClick={() => setLight((v) => !v)}
            className={`ml-auto flex min-h-14 cursor-pointer items-center justify-center border-l border-[var(--line)] bg-transparent px-[clamp(16px,2cqw,28px)] text-[var(--muted)] transition-colors hover:bg-[var(--raised)] hover:text-[var(--ink)] @max-[700px]:min-h-12 @max-[700px]:w-12 @max-[700px]:px-0 ${focusRing}`}
          >
            {light ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            )}
          </button>

          <button
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            onClick={() => setMenuOpen((v) => !v)}
            className={`hidden w-12 cursor-pointer items-center justify-center border-l border-[var(--line)] bg-transparent p-0 text-[var(--ink)] @max-[700px]:flex @max-[700px]:min-h-12 ${focusRing}`}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={menuOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} />
            </svg>
          </button>

          <Link
            href="/hello"
            onClick={closeMenu}
            className={[
              LABEL,
              'doyeon-cta relative z-[1] flex min-h-14 items-center bg-[var(--ink)] px-[clamp(20px,2.4cqw,36px)] text-[var(--ground)] no-underline',
              'focus-visible:outline-2 focus-visible:outline-offset-[-5px] focus-visible:outline-[var(--ground)]',
              menuOpen ? '@max-[700px]:order-4 @max-[700px]:min-h-12 @max-[700px]:w-full @max-[700px]:justify-center' : '@max-[700px]:hidden',
            ].join(' ')}
          >
            Say hello
          </Link>
        </div>
        {progress && <ReadingPaws />}
      </header>
  );
}
