import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

beforeEach(() => Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn(() => ({ matches: false })),
}));
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);
vi.stubGlobal('PointerEvent', MouseEvent);
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

// jsdom does not implement the browser's native dialog methods.
Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: { configurable: true, writable: true, value: function (this: HTMLDialogElement) { this.open = true; } },
  close: { configurable: true, writable: true, value: function (this: HTMLDialogElement) { this.open = false; } },
});

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.theme = 'dark';
  document.documentElement.style.colorScheme = 'dark';
});
