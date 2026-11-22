import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { THEME_KEY, useSiteTheme } from '../hooks/useSiteTheme';

it('restores the saved theme and preserves it across page mounts', () => {
  localStorage.setItem(THEME_KEY, 'light');
  const first = renderHook(useSiteTheme);
  expect(first.result.current[0]).toBe(true);
  act(() => first.result.current[1](false));
  expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  first.unmount();
  const second = renderHook(useSiteTheme);
  expect(second.result.current[0]).toBe(false);
  act(() => second.result.current[1](true));
  second.unmount();
  expect(renderHook(useSiteTheme).result.current[0]).toBe(true);
});

it('synchronizes consumers and updates from other browser tabs', () => {
  const first = renderHook(useSiteTheme);
  const second = renderHook(useSiteTheme);
  act(() => first.result.current[1](value => !value));
  expect(second.result.current[0]).toBe(true);
  expect(document.documentElement.style.colorScheme).toBe('light');
  act(() => {
    localStorage.setItem(THEME_KEY, 'dark');
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: 'dark' }));
  });
  expect(first.result.current[0]).toBe(false);
  expect(second.result.current[0]).toBe(false);
});

it('still switches themes when browser storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  const first = renderHook(useSiteTheme);
  act(() => first.result.current[1](true));
  expect(first.result.current[0]).toBe(true);
  first.unmount();
  expect(renderHook(useSiteTheme).result.current[0]).toBe(true);
});
