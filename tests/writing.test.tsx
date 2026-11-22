import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { getAllPosts, getPost, pick, postHref } from '../lib/posts';
import Markdown from '../components/Markdown';
import ZoomableArticle from '../components/ZoomableArticle';

it('loads both languages from Markdown and rejects missing or unsafe slugs', () => {
  const post = getPost('how-math-looks')!;
  expect(getAllPosts().some(p => p.slug === post.slug)).toBe(true);
  expect(pick(post, 'en').title).toBe('How math looks on this blog');
  expect(pick(post, 'ko').lang).toBe('ko');
  expect(postHref(post.slug, 'ko')).toBe('/writing/how-math-looks/ko');
  expect(getPost('../about')).toBeNull();
  expect(getPost('missing-post')).toBeNull();
});

it('renders math, theorem blocks, diagrams and lists without executing raw HTML', () => {
  const source = getPost('how-math-looks')!.versions.en!.body;
  const html = renderToStaticMarkup(<Markdown source={source} lang="en" />);
  expect(html).toContain('katex');
  expect(html).toContain('env-theorem');
  expect(html).toContain('Theorem (Cantor).');
  expect(html).toContain('example-diagram.svg');
  expect(html).not.toContain('katex-error');
  expect(renderToStaticMarkup(<Markdown source={'<script>alert(1)</script>\n\n[bad](javascript:alert(1))'} lang="en" />)).not.toContain('<script>');
});

it('opens article images by keyboard, navigates images and restores focus', () => {
  render(<ZoomableArticle>{createElement('img', { src: '/one.svg', alt: 'First diagram' })}{createElement('img', { src: '/two.svg', alt: 'Second diagram' })}</ZoomableArticle>);
  const first = screen.getByRole('button', { name: 'Enlarge: First diagram' });
  first.focus();
  fireEvent.keyDown(first, { key: 'Enter' });
  expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('First diagram');
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
  expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Second diagram');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(first);
});
