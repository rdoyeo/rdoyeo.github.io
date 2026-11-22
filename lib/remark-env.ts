/**
 * Turns fenced blocks like
 *
 *   :::theorem[Cantor]
 *   For any set $A$, there is no surjection $A \to \mathcal{P}(A)$.
 *   :::
 *
 * into a boxed "Theorem (Cantor)." block. `:::proof` gets an italic "Proof." and a ∎ at the end.
 * Needs remark-directive before it.
 */

import { visit } from 'unist-util-visit';
import type { Root, Paragraph, PhrasingContent, RootContent } from 'mdast';
import type { ContainerDirective } from 'mdast-util-directive';
import type { Lang } from './posts';

const NAMES: Record<string, Record<Lang, string>> = {
  theorem: { en: 'Theorem', ko: '정리' },
  definition: { en: 'Definition', ko: '정의' },
  lemma: { en: 'Lemma', ko: '보조정리' },
  proposition: { en: 'Proposition', ko: '명제' },
  corollary: { en: 'Corollary', ko: '따름정리' },
  example: { en: 'Example', ko: '예' },
  remark: { en: 'Remark', ko: '참고' },
  proof: { en: 'Proof', ko: '증명' },
};

type Data = { hName?: string; hProperties?: Record<string, string | string[]>; hChildren?: { type: 'text'; value: string }[] };

export default function remarkEnv(options: { lang: Lang }) {
  const lang = options.lang;
  return (tree: Root) => {
    visit(tree, 'containerDirective', (node: ContainerDirective) => {
      const kind = node.name;
      const names = NAMES[kind];
      if (!names) return;

      // the [label] after the name arrives as a first paragraph marked directiveLabel
      let label: PhrasingContent[] = [];
      const first = node.children[0] as (Paragraph & { data?: { directiveLabel?: boolean } }) | undefined;
      if (first && first.type === 'paragraph' && first.data?.directiveLabel) {
        label = first.children;
        node.children.shift();
      }

      const isProof = kind === 'proof';
      const head: PhrasingContent[] = [{ type: 'text', value: names[lang] }];
      if (label.length) head.push({ type: 'text', value: ' (' }, ...label, { type: 'text', value: ')' });
      head.push({ type: 'text', value: '.' });
      const lead: PhrasingContent = isProof
        ? { type: 'emphasis', children: head }
        : { type: 'strong', children: head, data: { hProperties: { className: ['env-name'] } } as Data };

      // put the name at the start of the first paragraph, or on its own line before a list or equation
      const body = node.children[0];
      if (body && body.type === 'paragraph') {
        body.children.unshift(lead, { type: 'text', value: ' ' });
      } else {
        node.children.unshift({ type: 'paragraph', children: [lead] } as RootContent as Paragraph);
      }

      if (isProof) {
        const last = node.children[node.children.length - 1];
        const qed: PhrasingContent = {
          type: 'text',
          value: '∎',
          data: { hName: 'span', hProperties: { className: ['proof-end'], 'aria-label': lang === 'ko' ? '증명 끝' : 'end of proof' }, hChildren: [{ type: 'text', value: '∎' }] } as Data,
        };
        if (last && last.type === 'paragraph') last.children.push(qed);
        else node.children.push({ type: 'paragraph', children: [qed] });
      }

      const data = (node.data ??= {}) as Data;
      data.hName = 'div';
      data.hProperties = { className: ['env', `env-${kind}`] };
    });

    // remark-directive also reads things like "note:this" as a directive; put those back as text
    visit(tree, (node, index, parent) => {
      if ((node.type !== 'textDirective' && node.type !== 'leafDirective') || !parent || index === undefined) return;
      const d = node as unknown as { name: string; children: PhrasingContent[] };
      const restored: PhrasingContent[] = [{ type: 'text', value: (node.type === 'leafDirective' ? '::' : ':') + d.name }, ...d.children];
      if (node.type === 'leafDirective') {
        (parent.children as RootContent[]).splice(index, 1, { type: 'paragraph', children: restored });
      } else {
        (parent.children as PhrasingContent[]).splice(index, 1, ...restored);
      }
      return index + restored.length;
    });
  };
}
