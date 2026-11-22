'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export const THEME_KEY = 'doyeon-theme';
const THEME_EVENT = 'doyeon-theme-change';

function getSnapshot() {
  return document.documentElement.dataset.theme === 'light';
}
function getServerSnapshot() { return false; }
function applyTheme(light: boolean) {
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.documentElement.style.colorScheme = light ? 'light' : 'dark';
}
function subscribe(onChange: () => void) {
  // Also initialize when rendered without the document bootstrap (e.g. tests).
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') applyTheme(stored === 'light');
  } catch { /* Browser storage may be disabled; retain the current session theme. */ }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_KEY && event.key !== null) return;
    applyTheme(event.newValue === 'light');
    onChange();
  };
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function useSiteTheme(): [boolean, Dispatch<SetStateAction<boolean>>] {
  const light = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setLight = useCallback<Dispatch<SetStateAction<boolean>>>((value) => {
    const next = typeof value === 'function' ? value(getSnapshot()) : value;
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next ? 'light' : 'dark'); } catch { /* Keep toggling usable. */ }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);
  return [light, setLight];
}
