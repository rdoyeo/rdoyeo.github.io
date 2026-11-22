# Doyeon portfolio

Next.js App Router project with TypeScript, Tailwind CSS, ESLint, and npm, scaffolded with `create-next-app` defaults. Implements the supplied home and projects designs with animated ASCII snow, responsive navigation, and dark/light themes.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000.

## Validate and build

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm start
```

## Content

- `components/HomePage.tsx`: interactive poodle and snowfall scene.
- `components/ProjectsPage.tsx`: project cards and snowfall background. Edit the `PROJECTS` array to replace the supplied sample project content and `#` links.
- `components/AboutPage.tsx`: supplied long-form biography, inline link chips, and `PHOTO_ROWS` gallery. Add photos to `public/about/` and fill in the optional `src` entries. The supplied ASCII dog image is already included.
- `components/SiteNav.tsx`: shared sticky navigation for Home, Projects, and About.
- `app/writing/page.tsx`: bilingual archive; articles live in `content/posts/<slug>/en.md` and optionally `ko.md`.
- `components/SiteChrome.tsx`: shared shell for About and Writing; preserves `SiteFooter` and adds paw-print progress on articles.
- Both supplied page components still contain sample email/social/RSS destinations. Replace these before publishing.
- `public/`: supplied logo assets. Fonts are self-hosted through `next/font` (first build requires access to Google Fonts).

No deployment is configured. `npm start` runs the production Next.js server; GitHub Pages would require a separate static-export configuration.



## Writing a post

Make a folder in `content/posts/` named after the post's URL (lowercase letters, digits, dashes),
with one Markdown file per language:

```
content/posts/lawvere/en.md     →  /writing/lawvere
content/posts/lawvere/ko.md     →  /writing/lawvere/ko
```

Either file can be left out. A post with only `ko.md` opens at `/writing/lawvere` in Korean and is
marked 한국어 in the English archive (and the other way round). The EN / 한 switch on a post
links to its other language when there is one. Translations are separate files you write; nothing
is machine-translated.

Each file starts with front matter:

```markdown
---
title: Lawvere's fixed-point theorem
date: 2026-11-20
tags: [mathematics, category theory]
draft: true        # optional: hidden from production builds
---
```

The archive at `/writing` groups posts by month, newest first; `/writing?lang=ko` shows it in Korean.

## Math

LaTeX is rendered by KaTeX on the server, so pages load with the math already typeset.

| You type | You get |
|---|---|
| `$f : A \to B$` | inline math |
| `$$ … $$` on their own lines | a centred display equation |
| `\begin{aligned} … \end{aligned}` inside `$$` | multi-line derivations |
| `\begin{CD} … \end{CD}` inside `$$` | a commutative diagram |

Commutative diagram arrows: `@>f>>` right, `@<<<` left, `@VVV` down, `@AAA` up, `@=` equals,
`@.` empty. Labels go between the symbols: `@>f>>`, `@V{\alpha}VV`, `@A{\Delta}AA`.

```latex
$$
\begin{CD}
A \times A @>f>> Y \\
@A{\Delta}AA @VV{\alpha}V \\
A @>g>> Y
\end{CD}
$$
```

To write a literal dollar sign, escape it: `\$5`.

## Theorems, definitions and proofs

```markdown
:::theorem[Cantor]
For any set $A$, there is no surjection $A \to \mathcal{P}(A)$.
:::

:::proof
Suppose … a contradiction.
:::
```

Available: `theorem`, `definition`, `lemma`, `proposition`, `corollary`, `example`, `remark`
(each in a box, with an optional `[name]`), and `proof` (no box, italic "Proof.", ∎ at the end).
In `ko.md` the labels become 정리, 정의, 보조정리, 명제, 따름정리, 예, 참고, 증명.
Add more in `lib/remark-env.ts`.

## Diagrams KaTeX can't draw

For diagonal or curved arrows, TikZ pictures or plots, export an SVG (for TikZ: compile with
`pdflatex` then `dvisvgm --pdf file.pdf`, or draw it in https://q.uiver.app and export), put it in
`public/writing/`, and use an image on its own line. The quoted title becomes the caption:

```markdown
![Lawvere's diagram](/writing/lawvere-diagram.svg "Figure 1. The diagonal argument.")
```

Black-on-transparent SVGs are inverted automatically in dark mode. Every image in a post can be clicked to open a
large view (previous / next between the post's images, Esc or click outside to close), and a trail of paw prints
under the menu bar shows how far you've read.

## Everything else

Standard Markdown plus GitHub extras: headings, lists, links, `code`, fenced code blocks,
tables, footnotes (`[^1]`), ~~strikethrough~~, task lists.


## Integration notes

The included `how-math-looks` post is the supplied English/Korean formatting demo. Replace it or mark both versions `draft: true` before publishing if you do not want it listed.

About uses the supplied `doyeon-about-tsx` page, with previous/next photo viewing. Its remaining photo and biography placeholders are preserved for you to fill in. The shared footer retains white glow links and an inactive CV until `content/socials.ts` has a real URL.

The KaTeX override in `package.json` makes the Markdown plugins use the same patched KaTeX version as the stylesheet dependency.

## Say Hello

`/hello` uses the supplied terminal-style contact page. Edit `content/contact.ts` to set a real email address (opens the visitor’s mail app) or a public form-service endpoint accepting JSON `{ name, email, message }`. With neither configured, the page explicitly says messages have not been sent. The remaining social/contact placeholders are in `components/HelloPage.tsx`.
