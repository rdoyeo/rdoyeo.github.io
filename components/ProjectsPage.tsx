'use client';

/**
 * Doyeon — projects page.
 *
 * Project panels (name + status bar, screenshot or "on request" box, tagline, description
 * with one inline link, stack, and buttons) over a quiet full-page ASCII snowfall in four
 * shades of cyan. Same menu bar and footer as the home page, with dark/light theme and a
 * phone menu built in.
 *
 * Styling: Tailwind CSS v4 (uses container queries: `@container`, `@max-[700px]:`).
 * Fonts: load Bricolage Grotesque (400–800) and IBM Plex Mono (400, 500), e.g. with
 *   <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=IBM+Plex+Mono:wght@400;500&display=swap">
 *   or next/font/google.
 * Logos: put doyeon-icon-background-256.png and doyeon-icon-transparent-256.png in /public.
 * Links point to /about, /projects and /writing — change them to match your routes.
 * Edit the PROJECTS array below to fill in your work.
 */

import Link from 'next/link';
import SiteNav from './SiteNav';
import { useSiteTheme } from '../hooks/useSiteTheme';
import SiteFooter from './SiteFooter';
import { siteTheme } from './site-theme';

import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Your projects — one record each
// ---------------------------------------------------------------------------

type Project = {
	name: string;
	status: string;                       // e.g. 'Open source', 'Closed source'
	date: string;
	site: string;                         // where the screenshot links
	tagline: string;
	/** the description can hold one inline link: [before, link text, after] */
	desc: [string, string, string];
	descLink?: string;
	stack: string;
	/** true: show the screenshot box; false: show "available on request" */
	media: boolean;
	/** first link is the solid button, the rest are outlined */
	link: string | null;
	github: string | null;
};

const DESC: [string, string, string] = [
	'[A short paragraph about the problem and what you built. Part of ',
	'[a related link]',
	', and what came of it.]',
];

const PROJECTS: Project[] = [

	{
		name: 'Koala', status: 'Open source', date: "Nov 2026", site: '#', tagline: '[One-line summary of what it is.]', desc: DESC,
		stack: '[typescript, react, postgres]', media: true, link: "gbksiphonic.com", github: null
	},
	{
		name: 'CAD 3D Reconstruction', status: 'Open source', date: "Nov 2026", site: '#', tagline: '[One-line summary of what it is.]', desc: DESC,
		stack: '[typescript, react, postgres]', media: true, link: "gbksiphonic.com", github: null
	},
	{
		name: 'AquaPilot', status: 'Closed source', date: "June 2025", site: '#', tagline: '[One-line summary of what it is.]', desc: DESC,
		stack: '[typescript, react, postgres]', media: true, link: "gbksiphonic.com", github: null
	},
	{
		name: 'Toxicity Detector', status: 'Open source', date: "Dec 2025", site: '#', tagline: '[One-line summary of what it is.]', desc: DESC,
		stack: '[typescript, react, postgres]', media: true, link: "gbksiphonic.com", github: null
	},
	{
		name: 'GreenRush', status: 'Open source', date: "Dec 2023", site: '#', tagline: '[One-line summary of what it is.]', desc: DESC,
		stack: '[typescript, react, postgres]', media: true, link: "gbksiphonic.com", github: null
	},
];

// ---------------------------------------------------------------------------
// Background snowfall: four depths of flakes drifting on a slow wind
// ---------------------------------------------------------------------------

type Flake = { x: number; y: number; z: number; ph: number; shade: 0 | 1 | 2 | 3 };
type Snow = { C: number; R: number; flakes: Flake[]; t: number; rnd: () => number };

const CELL_W = 7.2;   // 12px IBM Plex Mono: 0.6em wide
const CELL_H = 14.4;  // line-height 1.2

function makeRng(seed: number): () => number {
	let s = seed;
	return () => {
		s = (s * 1103515245 + 12345) & 0x7fffffff;
		return s / 0x7fffffff;
	};
}

function newFlake(rnd: () => number, C: number, R: number, anywhere: boolean): Flake {
	const z = Math.pow(rnd(), 0.85);
	return {
		x: rnd() * C,
		y: anywhere ? rnd() * R : -rnd() * 4,
		z,
		ph: rnd() * 6.28,
		shade: z < 0.4 ? 0 : z < 0.65 ? 1 : z < 0.85 ? 2 : 3,
	};
}

function makeSnow(width: number, height: number): Snow {
	const C = Math.ceil(width / CELL_W) + 1;
	const R = Math.ceil(height / CELL_H) + 1;
	const rnd = makeRng(7);
	const n = Math.round(C * R * 0.03);
	const flakes: Flake[] = [];
	for (let i = 0; i < n; i++) flakes.push(newFlake(rnd, C, R, true));
	return { C, R, flakes, t: 0, rnd };
}

function stepSnow(S: Snow, dt: number): void {
	S.t += dt;
	const wind = 1.4 * Math.sin(S.t * 0.09) + 0.8 * Math.sin(S.t * 0.27 + 1.3);
	for (let i = 0; i < S.flakes.length; i++) {
		const f = S.flakes[i];
		const p = 0.35 + 0.95 * f.z;
		f.x += ((wind * p + Math.sin(S.t * 1.1 + f.ph) * (0.6 + f.z)) * dt) / 0.6;
		f.y += ((1.3 + f.z * 4.2) * dt) / 1.2;
		if (f.y > S.R + 1) S.flakes[i] = newFlake(S.rnd, S.C, S.R, false);
		else if (f.x < -2) f.x += S.C + 4;
		else if (f.x > S.C + 2) f.x -= S.C + 4;
	}
}

function renderSnow(S: Snow): string[] {
	const { C, R } = S;
	const grids: string[][][] = [];
	for (let l = 0; l < 4; l++) {
		const g: string[][] = [];
		for (let y = 0; y < R; y++) g.push(new Array<string>(C).fill(' '));
		grids.push(g);
	}
	for (const f of S.flakes) {
		const x = Math.floor(f.x);
		const y = Math.floor(f.y);
		if (x < 0 || x >= C || y < 0 || y >= R) continue;
		const ch =
			f.z < 0.4 ? '.' : f.z < 0.65 ? (f.z < 0.5 ? "'" : '+') : ['*', '+', 'x'][Math.floor(S.t * (1 + f.z * 2) + f.ph) % 3];
		grids[f.shade][y][x] = ch;
	}
	return grids.map((g) => g.map((r) => r.join('')).join('\n'));
}

const SNOW_PALETTE = {
	dark: ['#1f5a63', '#2fa3b3', '#5fe3f0', '#c8f7fc'],   // far to near
	light: ['#a9dfe7', '#5cc4d3', '#1597aa', '#0b6b7a'],
} as const;

// ---------------------------------------------------------------------------
// Shared bits (same as the home page)
// ---------------------------------------------------------------------------


const GLOW_CSS = `
@keyframes doyeon-glow-box{0%,100%{box-shadow:0 0 10px 1px color-mix(in srgb,var(--ink) 40%,transparent),0 0 28px 4px color-mix(in srgb,var(--ink) 20%,transparent)}50%{box-shadow:0 0 16px 3px color-mix(in srgb,var(--ink) 60%,transparent),0 0 44px 10px color-mix(in srgb,var(--ink) 30%,transparent)}}
.doyeon-cta:hover{animation:doyeon-glow-box 1.8s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.doyeon-cta:hover{animation:none}}
`;


const MONO = "font-mono";
const LABEL = `${MONO} text-[12px] leading-4 font-medium tracking-[0.08em] uppercase`;
const BTN =
	"inline-flex min-h-11 items-center gap-2.5 rounded-md px-5 font-['Bricolage_Grotesque',sans-serif] text-base font-bold no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--green-text)]";
const BTN_PRIMARY = `${BTN} border border-[var(--ink)] bg-[var(--ink)] text-[var(--ground)] hover:border-[var(--muted)] hover:bg-[var(--muted)]`;
const BTN_SECONDARY = `${BTN} border border-[var(--line-strong)] bg-transparent text-[var(--ink)] hover:border-[var(--ink)]`;

function ArrowIcon() {
	return (
		<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M7 17 17 7M8 7h9v9" />
		</svg>
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProjectsPage() {
	const [light, setLight] = useSiteTheme();
	const [snow, setSnow] = useState(() => renderSnow(makeSnow(1440, 900)));

	useEffect(() => {
		let simulation = makeSnow(window.innerWidth, window.innerHeight);
		const publish = () => setSnow(renderSnow(simulation));
		const fit = () => {
			simulation = makeSnow(window.innerWidth, window.innerHeight);
			publish();
		};
		const initial = requestAnimationFrame(publish);
		window.addEventListener('resize', fit);
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const id = window.setInterval(() => {
			if (!motion.matches && !document.hidden) {
				stepSnow(simulation, 0.07);
				publish();
			}
		}, 70);
		return () => {
			cancelAnimationFrame(initial);
			window.removeEventListener('resize', fit);
			window.clearInterval(id);
		};
	}, []);

	const snowPal = light ? SNOW_PALETTE.light : SNOW_PALETTE.dark;
	const count = String(PROJECTS.length).padStart(2, '0');


	return (
		<div
			data-theme={light ? 'light' : 'dark'}
			className={[
				'@container relative isolate flex min-h-dvh flex-col',
				"font-sans text-base leading-[1.55]",
				siteTheme,
			].join(' ')}
		>
			<style>{GLOW_CSS}</style>

			{/* ---------------- background snowfall ---------------- */}
			<div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
				{snow.map((text, i) => (
					<pre
						key={i}
						className={`${MONO} absolute top-0 left-0 m-0 text-[12px] leading-[1.2] tracking-normal whitespace-pre select-none`}
						style={{ color: snowPal[i] }}
					>
						{text}
					</pre>
				))}
			</div>

			{/* ---------------- menu bar ---------------- */}
			<SiteNav light={light} setLight={setLight} />

			{/* ---------------- projects ---------------- */}
			<main className="relative z-10 mx-auto box-border flex w-full max-w-[1120px] flex-1 flex-col gap-10 px-[clamp(16px,3cqw,32px)] pt-[clamp(40px,7cqw,88px)] pb-24">
				<h1 className="sr-only">Projects</h1>
				<span className={`${LABEL} text-[var(--muted)]`}>Projects · {count}</span>

				<div className="flex flex-col gap-6">
					{PROJECTS.map((p, i) => (
						<article key={i} className="project-card relative isolate overflow-hidden rounded-xl border border-[var(--line)]">
							<header className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-6 py-[18px]">
								<h2 className="m-0 text-[22px] leading-[1.2] font-extrabold tracking-[-0.01em]">{p.name}</h2>
								<span className={`${MONO} text-[12px] font-medium tracking-[0.1em] whitespace-nowrap text-[var(--muted)] uppercase`}>
									{p.status}
								</span>
							</header>

							<div className="flex flex-wrap gap-x-7 gap-y-6 p-6">
								<div className="min-w-0 flex-[1_1_380px]">
									{p.media ? (
										<Link
											href={p.site}
											aria-label={`Open ${p.name}`}
											className={`${MONO} flex aspect-video items-center justify-center overflow-hidden rounded-md border border-[var(--image-border)] bg-[var(--ground)] text-[13px] text-[var(--muted)] no-underline transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--green-text)]`}
										>
											{/* swap for <img src="…" alt="" className="h-full w-full object-cover" /> */}
											[ screenshot or demo ]
										</Link>
									) : (
										<div
											className={`${MONO} box-border flex aspect-video items-center justify-center rounded-md border border-dashed border-[var(--image-border)] bg-[var(--ground)] p-4 text-center text-[13px] text-[var(--muted)]`}
										>
											Media and demos available on request.
										</div>
									)}
								</div>

								<div className="flex min-w-0 flex-[1.15_1_380px] flex-col gap-3.5">
									<h3 className="m-0 text-xl leading-[1.35] font-extrabold">{p.tagline}</h3>
									<p className="m-0 text-[17px] leading-[1.7] text-[var(--muted)]">
										{p.desc[0]}
										<Link
											href={p.descLink ?? '#'}
											className="text-[var(--ink)] underline decoration-[var(--line-strong)] underline-offset-4 hover:decoration-[var(--ink)]"
										>
											{p.desc[1]}
										</Link>
										{p.desc[2]}
									</p>
									<div className="flex flex-wrap items-baseline gap-x-7 gap-y-1.5 border-t border-[var(--line)] pt-3.5">
										<span className="text-[15px] text-[var(--muted)]">Stack</span>
										<span className={`${MONO} text-sm text-[var(--ink)]`}>{p.stack}</span>
									</div>
									<div className="flex flex-wrap gap-3 pt-1">
										{p.link && (
											<Link href={p.link} className={BTN_PRIMARY}>
												Visit Site
												<ArrowIcon />
											</Link>
										)}

										{p.github && (
											<Link href={p.github} className={BTN_SECONDARY}>
												Github
												<ArrowIcon />
											</Link>
										)}
									</div>
								</div>
							</div>
						</article>
					))}
				</div>
			</main>

			{/* ---------------- footer ---------------- */}
			<SiteFooter />
		</div>
	);
}
