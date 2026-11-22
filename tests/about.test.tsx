import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import AboutPage from '../components/AboutPage';

it('uses the shared navigation and switches About to the light theme', () => {
  const { container } = render(<AboutPage />);
  expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Projects' }).getAttribute('href')).toBe('/projects');
  fireEvent.click(screen.getByRole('button', { name: 'Switch between dark and light mode' }));
  expect(container.firstElementChild?.getAttribute('data-theme')).toBe('light');
});

it('opens, magnifies and closes an image, restoring focus and page scrolling', () => {
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false; });
  document.body.style.overflow = 'auto';
  render(<AboutPage />);
  const trigger = screen.getAllByRole('button', { name: /Enlarge photo/ })[0];
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(document.body.style.overflow).toBe('hidden');
  expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Jeju');
  fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
  expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('My desk and setup');
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Jeju');
  fireEvent.click(screen.getByRole('button', { name: 'Close photo' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.body.style.overflow).toBe('auto');
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('renders the supplied biography, photo rows and dog artwork', () => {
  render(<AboutPage />);
  expect(screen.getByText(/I grew up on/)).toBeTruthy();
  expect(screen.getByRole('link', { name: /Arch Linux/ })).toBeTruthy();
  expect(screen.getAllByRole('list', { name: 'Photos' })).toHaveLength(7);
  expect(screen.getByAltText('My dog, drawn in ASCII')).toBeTruthy();
  expect(screen.getByRole('progressbar', { name: 'Reading progress' })).toBeTruthy();
  expect(screen.getByRole('navigation', { name: 'Social links and CV' })).toBeTruthy();
});
