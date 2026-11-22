'use client';

/**
 * Doyeon — say hello page.
 *
 * Writing to me is like using a terminal: `cat contacts.txt` prints my dog's face (the logo art)
 * and my contacts, then `./say-hello` asks for a name, an email and a message, one prompt at a
 * time, with a block cursor. Errors print in red; sending prints a delivery line.
 *
 * Sending: set contact.formEndpoint to a form service that accepts JSON POSTs (Formspree, Basin,
 * Getform, or your own /api route). Left empty, "send" opens the visitor's mail app with the
 * message filled in, addressed to contact.email.
 *
 * Needs: components/SiteChrome.tsx (+ ReadingPaws.tsx), Tailwind CSS v4, IBM Plex Mono.
 */

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import SiteChrome from '@/components/SiteChrome';
import { contact } from '@/content/contact';

// ---------------------------------------------------------------------------
// Fill these in
// ---------------------------------------------------------------------------

const CONTACTS: { key: string; value: string; href?: string }[] = [
  { key: 'email', value: contact.email || '[email not configured]', href: contact.email ? `mailto:${contact.email}` : undefined },
  { key: 'linkedin', value: '[linkedin.com/in/you]', href: 'https://www.linkedin.com/' },
  { key: 'github', value: '[github.com/you]', href: 'https://github.com/' },
  { key: 'location', value: '[City] · Jeju' },
];
const HOST = 'rdoyeo@grinnell';

// the dog's face from the logo: one version for dark backgrounds, one for light
const FACE_DARK = "           ++++*###oo+\n      +++++o@@@@@@@@@@###+\n     +o@@@@@@@@@@@@@@@@@@@*\n   +*@@@@@@@@@@@@@%%@@@@@@@#+\n *#@@@@@@@@%%@@@@%@%%@@@@@@@@#\n #@@@@%%%%@##%%##%%##%@@#%@@@@#+\n#@@%#%%%##%oo     o#    *##o%@@#\n #@@#oo#%##o%%o#@@@@@@@@%%ooo%@#\n ##@@@##%%%#@#@@@@@@%%@@@@%##*o\n   ##@%##%%o@@@@%%#    @@@##*\n     o*++++++#%%%%%# %%o##\n             +++o%%@@o#\n                **+**";
const FACE_LIGHT = "           *****+++***\n      *****=:.........+++*\n     *=...................*\n   **..........:..:::......+*\n *+........::....:::::.......+\n +...::::::--::--::--:.:-::...+*\n+.::-:::--:=-#@@@@=-#@@@=--=:..+\n +..-==-:--=::=-:.......::==-:.+\n ++...--:::-.-:....:::....:--++\n   ++.:--::=:...::-@@@#...+++\n     +*******-:::::-#::+++\n             ***-:::.++\n                ****+";

// ---------------------------------------------------------------------------

type Step = 0 | 1 | 2 | 3; // name, email, message, sent
type Status = 'idle' | 'sending' | 'done' | 'failed' | 'mailto' | 'unconfigured';

const ADDRESS_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BTN =
  'min-h-9 cursor-pointer border-0 bg-transparent px-1.5 font-[inherit] text-[13px] text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--ground)] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--terminal-accent)]';
const INPUT =
  'min-h-8 min-w-0 flex-[1_1_220px] border-0 bg-transparent p-0 font-[inherit] text-[var(--ink)] caret-[var(--terminal-accent)] [caret-shape:block] focus:outline-none focus-visible:shadow-[inset_0_-1px_0_var(--terminal-accent)]';

function Prompt() {
  return <span className="font-medium text-[var(--terminal-accent)]">~/hello $</span>;
}

function Q() {
  return <span className="font-medium text-[var(--terminal-accent)]">?</span>;
}

export default function HelloPage() {
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const first = useRef(true);

  // move the cursor to each new prompt (not on first load, so the page doesn't jump)
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    inputRef.current?.focus();
  }, [step]);

  async function send(n: string, e: string, m: string) {
    if (!contact.formEndpoint && !contact.email) {
      setStatus('unconfigured');
      return;
    }
    if (!contact.formEndpoint) {
      const body = `${m}\n\n— ${n} (${e})`;
      window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(`Hello from ${n}`)}&body=${encodeURIComponent(body)}`;
      setStatus('mailto');
      return;
    }
    setStatus('sending');
    try {
      const res = await fetch(contact.formEndpoint, {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: n, email: e, message: m }),
      });
      setStatus(res.ok ? 'done' : 'failed');
    } catch {
      setStatus('failed');
    }
  }

  function answer() {
    if (step === 3) return;
    const v = draft.trim();
    if (step === 0) {
      if (!v) return setErr("name can't be empty");
      setName(v);
    } else if (step === 1) {
      if (!ADDRESS_RE.test(v)) return setErr("that doesn't look like an email address");
      setEmail(v);
    } else if (step === 2) {
      if (!v) return setErr('write a few words first');
      const m = draft.replace(/\s+$/, '');
      setMessage(m);
      void send(name, email, m);
    }
    setErr('');
    setDraft('');
    setStep((s) => (s + 1) as Step);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    if (step === 2 && !(e.ctrlKey || e.metaKey)) return; // plain Enter is a new line in the message
    e.preventDefault();
    answer();
  }

  function reset() {
    setStep(0);
    setName('');
    setEmail('');
    setMessage('');
    setDraft('');
    setErr('');
    setStatus('idle');
  }

  const hint = ['enter ↵ to continue', 'enter ↵ to continue', 'ctrl+enter to send · enter for a new line'][step] ?? '';
  const firstName = name.split(/\s+/)[0] || 'friend';
  const ask = (label: string, type: string, auto: string) => (
    <div className="flex flex-wrap items-baseline gap-[1ch]">
      <label htmlFor="term-input" className="whitespace-nowrap">
        <Q /> {label} <span className="text-[var(--muted)]">›</span>
      </label>
      <input
        ref={inputRef}
        id="term-input"
        type={type}
        autoComplete={auto}
        spellCheck={false}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setErr('');
        }}
        onKeyDown={onKeyDown}
        aria-describedby={err ? "term-hint term-error" : "term-hint"}
        aria-invalid={Boolean(err)}
        className={INPUT}
      />
    </div>
  );

  return (
    <SiteChrome>
      <main className="mx-auto box-border flex w-full max-w-[920px] flex-auto flex-col gap-5 px-[clamp(16px,4cqw,32px)] pt-[clamp(32px,6cqw,72px)] pb-24">
        <h1 className="m-0 font-mono text-[12px] leading-4 font-medium tracking-[0.08em] text-[var(--muted)] uppercase">
          Say hello
        </h1>

        <section
          aria-label="Terminal: send me a message"
          className="overflow-hidden rounded-lg border border-[var(--line-strong)] bg-[var(--terminal-background)] font-mono text-[15px] leading-[1.7] text-[var(--ink)]"
        >
          <div className="flex flex-wrap justify-between gap-3 border-b border-[var(--line-strong)] px-4 py-2.5 text-[12px] tracking-[0.06em] text-[var(--muted)]">
            <span>{HOST}: ~/hello</span>
            <span aria-hidden="true">[ zsh · 80×24 ]</span>
          </div>

          <div className="flex min-h-[420px] flex-col gap-1.5 px-[clamp(14px,3cqw,24px)] pt-5 pb-[26px] [overflow-wrap:anywhere] [&_p]:m-0">
            <p className="text-[var(--muted)]">Last login: Fri Nov 20 on ttys001</p>

            <p>
              <Prompt /> cat contacts.txt
            </p>
            <pre role="img" aria-label="ASCII art of my dog's face" className="m-0 mt-2 mb-3.5 overflow-x-auto pl-[2ch] font-[inherit] text-[14px] leading-none tracking-normal whitespace-pre [[data-theme=light]_&]:hidden">
              {FACE_DARK}
            </pre>
            <pre role="img" aria-label="ASCII art of my dog's face" className="m-0 mt-2 mb-3.5 hidden overflow-x-auto pl-[2ch] font-[inherit] text-[14px] leading-none tracking-normal whitespace-pre [[data-theme=light]_&]:block">
              {FACE_LIGHT}
            </pre>
            <div className="mb-2 flex flex-col pl-[2ch]">
              {CONTACTS.map((c) => {
                const inner = (
                  <>
                    <span className="flex-[0_0_10ch] text-[var(--muted)]">{c.key}</span>
                    <span className={c.href ? 'decoration-[var(--line-strong)] underline-offset-4 group-hover:underline' : ''}>{c.value}</span>
                  </>
                );
                return c.href ? (
                  <a
                    key={c.key}
                    href={c.href}
                    {...(c.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                    className="group flex min-h-8 items-center gap-[2ch] text-[var(--ink)] no-underline focus-visible:outline-2 focus-visible:outline-[var(--terminal-accent)]"
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={c.key} className="flex min-h-8 items-center gap-[2ch]">
                    {inner}
                  </div>
                );
              })}
            </div>

            <p>
              <Prompt /> ./say-hello
            </p>

            {step > 0 && (
              <p>
                <Q /> your name <span className="text-[var(--muted)]">›</span> {name}
              </p>
            )}
            {step > 1 && (
              <p>
                <Q /> your email <span className="text-[var(--muted)]">›</span> {email}
              </p>
            )}
            {step > 2 && (
              <>
                <p>
                  <Q /> message <span className="text-[var(--muted)]">›</span>
                </p>
                <pre className="m-0 pl-[2ch] font-[inherit] whitespace-pre-wrap">{message}</pre>
              </>
            )}

            {step === 0 && ask('your name', 'text', 'name')}
            {step === 1 && ask('your email', 'email', 'email')}
            {step === 2 && (
              <>
                <label htmlFor="term-input" className="block">
                  <Q /> message <span className="text-[var(--muted)]">(ctrl+enter to send)</span>
                </label>
                <textarea
                  ref={inputRef}
                  id="term-input"
                  rows={6}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setErr('');
                  }}
                  onKeyDown={onKeyDown}
                  aria-describedby={err ? "term-hint term-error" : "term-hint"}
        aria-invalid={Boolean(err)}
                  className={`${INPUT} box-border block min-h-[140px] w-full resize-y border-l border-[var(--line-strong)] py-1.5 pl-[2ch] focus-visible:border-[var(--terminal-accent)] focus-visible:shadow-none`}
                />
              </>
            )}

            {err && (
              <p id="term-error" role="alert" className="text-[var(--fire,#ff3b2f)]">
                error: {err}
              </p>
            )}

            {step < 3 && (
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-dashed border-[var(--line-strong)] pt-3 text-[13px]">
                <span id="term-hint" className="text-[var(--muted)]">
                  {hint}
                </span>
                <span className="flex flex-wrap gap-2">
                  <button type="button" className={BTN} onClick={answer}>
                    {step === 2 ? '[ send ]' : '[ enter ↵ ]'}
                  </button>
                  {step > 0 && (
                    <button type="button" className={BTN} onClick={reset}>
                      [ start over ]
                    </button>
                  )}
                </span>
              </div>
            )}

            {step === 3 && (
              <div role="status" className="flex flex-col gap-1.5">
                {status === 'unconfigured' && <p>Message delivery isn&apos;t configured yet. Your message has not been sent.</p>}
                {status === 'sending' && <p className="text-[var(--muted)]">sending message ........................</p>}
                {status === 'done' && (
                  <>
                    <p className="text-[var(--muted)]">sending message ........................ done</p>
                    <p>
                      <span className="text-[var(--terminal-accent)]">✓</span> message submitted. thanks, {firstName}. I&apos;ll reply to {email} soon.
                    </p>
                    <p className="text-[var(--muted)]">woof.</p>
                  </>
                )}
                {status === 'mailto' && (
                  <p>
                    <span className="text-[var(--terminal-accent)]">✓</span> requested your mail app. If it opened, press send there, {firstName}. Your message has not been sent by this site.
                  </p>
                )}
                {status === 'failed' && (
                  <p className="text-[var(--fire,#ff3b2f)]">
                    error: couldn&apos;t send right now. Please try again later.{' '}
                    {contact.email && <a href={`mailto:${contact.email}`} className="text-[var(--ink)] underline">Email {contact.email}</a>}
                  </p>
                )}
              </div>
            )}
            {step === 3 && status !== 'sending' && (
              <p className="flex flex-wrap items-center gap-3">
                <Prompt />
                <span aria-hidden="true" className="inline-block h-[1.1em] w-[0.6em] animate-[blink_1.1s_steps(1)_infinite] bg-[var(--terminal-accent)] align-[-2px] motion-reduce:animate-none" />
                <button type="button" className={BTN} onClick={reset}>
                  [ write another ]
                </button>
              </p>
            )}
          </div>
        </section>
        <style>{'@keyframes blink{50%{opacity:0}}'}</style>
      </main>
    </SiteChrome>
  );
}
