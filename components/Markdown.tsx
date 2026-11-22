/* eslint-disable @next/next/no-img-element -- Markdown images have author-defined URLs and dimensions. */
/**
 * Renders a post's Markdown: GitHub-flavoured Markdown (tables, footnotes, task lists),
 * LaTeX with KaTeX ($inline$, $$display$$, \begin{CD} commutative diagrams, \begin{aligned} …),
 * theorem/definition/proof blocks (lib/remark-env.ts), and figures from images.
 * Runs on the server: no math or Markdown code is shipped to the browser.
 */

import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import rehypeKatex from 'rehype-katex';
import remarkEnv from '@/lib/remark-env';
import type { Lang } from '@/lib/posts';

// a paragraph holding only an image becomes a figure; the image's title (or alt) is the caption
const components: Components = {
  p({ node, children, ...rest }) {
    const kids = node?.children ?? [];
    const only = kids.length === 1 ? kids[0] : null;
    if (only && only.type === 'element' && only.tagName === 'img') {
      const { src, alt, title } = only.properties as { src?: string; alt?: string; title?: string };
      const caption = title || alt;
      return (
        <figure>
          <img src={src} alt={alt ?? ''} loading="lazy" />
          {caption ? <figcaption>{caption}</figcaption> : null}
        </figure>
      );
    }
    return <p {...rest}>{children}</p>;
  },
  a({ href, children, title }) {
    const external = href?.startsWith('http');
    return (
      <a href={href} title={title} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {children}
      </a>
    );
  },
};

export default function Markdown({ source, lang }: { source: string; lang: Lang }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath, remarkDirective, [remarkEnv, { lang }]]}
      rehypePlugins={[[rehypeKatex, { strict: 'ignore', throwOnError: false, trust: false }]]}
      components={components}
    >
      {source}
    </ReactMarkdown>
  );
}
