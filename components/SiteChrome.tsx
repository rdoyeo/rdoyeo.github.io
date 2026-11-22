 'use client';
import type { ReactNode } from 'react';
import SiteNav from './SiteNav';
import { useSiteTheme } from '../hooks/useSiteTheme';
import SiteFooter from './SiteFooter';
import { siteTheme } from './site-theme';

export default function SiteChrome({ children, progress = false }: { children: ReactNode; progress?: boolean }) {
  const [light, setLight] = useSiteTheme();
  return <div id="top" data-theme={light ? 'light' : 'dark'} className={`@container flex min-h-dvh flex-col font-serif text-base leading-[1.55] ${siteTheme}`}>
    <SiteNav light={light} setLight={setLight} progress={progress} />
    {children}
    <SiteFooter />
  </div>;
}
