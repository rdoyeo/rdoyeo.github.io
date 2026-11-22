import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HomePage from '../components/HomePage';
import ProjectsPage from '../components/ProjectsPage';

for (const [name, Page] of [['Home', HomePage], ['Projects', ProjectsPage]] as const) {
  describe(name, () => {
    it('toggles theme and expands and closes the mobile menu', () => {
      vi.useFakeTimers();
      const { container } = render(<Page />);
      expect(container.firstElementChild?.getAttribute('data-theme')).toBe('dark');
      fireEvent.click(screen.getByRole('button', { name: 'Switch between dark and light mode' }));
      expect(container.firstElementChild?.getAttribute('data-theme')).toBe('light');
      const menu = screen.getByRole('button', { name: 'Menu' });
      fireEvent.click(menu);
      expect(menu.getAttribute('aria-expanded')).toBe('true');
      fireEvent.click(screen.getByRole('navigation', { name: 'Main' }));
      expect(menu.getAttribute('aria-expanded')).toBe('false');
    });

    it('animates and clears timers on unmount', () => {
      vi.useFakeTimers();
      const { container, unmount } = render(<Page />);
      act(() => vi.advanceTimersByTime(30));
      const initial = Array.from(container.querySelectorAll('pre'), node => node.textContent).join('');
      act(() => vi.advanceTimersByTime(210));
      expect(Array.from(container.querySelectorAll('pre'), node => node.textContent).join('')).not.toBe(initial);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('holds the scene still for reduced motion', () => {
      vi.useFakeTimers();
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
      const { container } = render(<Page />);
      act(() => vi.advanceTimersByTime(30));
      const initial = Array.from(container.querySelectorAll('pre'), node => node.textContent).join('');
      act(() => vi.advanceTimersByTime(300));
      expect(Array.from(container.querySelectorAll('pre'), node => node.textContent).join('')).toBe(initial);
    });
  });
}

it('fits the home scene to a narrow viewport and handles snowball input', () => {
  vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, width: 375, height: 500,
    right: 375, bottom: 500, toJSON: () => ({}),
  });
  const { container } = render(<HomePage />);
  act(() => vi.advanceTimersByTime(30));
  const scene = screen.getByRole('img', { name: /ASCII animation/ });
  fireEvent.pointerMove(scene, { clientX: 100, clientY: 200 });
  fireEvent.pointerDown(scene, { clientX: 100, clientY: 200 });
  fireEvent.pointerLeave(scene);
  act(() => vi.advanceTimersByTime(1200));
  const layer = container.querySelector('pre');
  expect(layer?.textContent?.length).toBeGreaterThan(0);
  expect(layer?.textContent).not.toContain('undefined');
});
