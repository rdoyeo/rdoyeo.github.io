import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import HelloPage from '../components/HelloPage';
import { contact } from '../content/contact';

const initial = { ...contact };
afterEach(() => { Object.assign(contact, initial); vi.unstubAllGlobals(); });

function answer(value: string) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: /\[ enter/ }));
}
function compose() {
  answer('Test Visitor');
  answer('visitor@example.org');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello from the test.' } });
}

it('validates prompts and does not claim delivery when unconfigured', () => {
  render(<HelloPage />);
  expect(screen.getByRole('link', { name: 'Say hello' }).getAttribute('href')).toBe('/hello');
  fireEvent.click(screen.getByRole('button', { name: /\[ enter/ }));
  expect(screen.getByRole('alert').textContent).toContain("name can't be empty");
  answer('Test Visitor');
  answer('not-an-email');
  expect(screen.getByRole('alert').textContent).toContain("doesn't look like an email");
  answer('visitor@example.org');
  fireEvent.click(screen.getByRole('button', { name: '[ send ]' }));
  expect(screen.getByRole('alert').textContent).toContain('write a few words');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello!' } });
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
  expect(screen.queryByRole('status')).toBeNull();
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', ctrlKey: true });
  expect(screen.getByRole('status').textContent).toContain('has not been sent');
  fireEvent.click(screen.getByRole('button', { name: '[ write another ]' }));
  expect(screen.getByRole('textbox').getAttribute('autocomplete')).toBe('name');
});

it('submits JSON to a configured endpoint and reports success', async () => {
  contact.formEndpoint = 'https://forms.example.test/contact';
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
  render(<HelloPage />);
  compose();
  fireEvent.click(screen.getByRole('button', { name: '[ send ]' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('message submitted'));
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: 'Test Visitor', email: 'visitor@example.org', message: 'Hello from the test.' });
});

it('reports a failed request without showing success', async () => {
  contact.formEndpoint = 'https://forms.example.test/contact';
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  render(<HelloPage />);
  compose();
  fireEvent.click(screen.getByRole('button', { name: '[ send ]' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain("couldn't send"));
  expect(screen.getByRole('status').textContent).not.toContain('message submitted');
});
