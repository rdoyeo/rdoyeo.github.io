/** /writing/<slug>/<lang> — a post's translation, e.g. /writing/how-math-looks/ko */

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import PostView from '@/components/PostView';
import { DEFAULT_LANG, LANGS, getAllPosts, getPost, isLang } from '@/lib/posts';
import 'katex/dist/katex.min.css';
import '../../writing.css';

type Params = { params: Promise<{ slug: string; lang: string }> };

export function generateStaticParams() {
  return getAllPosts().flatMap((p) =>
    LANGS.filter((l) => l !== DEFAULT_LANG && p.versions[l]).map((lang) => ({ slug: p.slug, lang })),
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, lang } = await params;
  const v = isLang(lang) ? getPost(slug)?.versions[lang] : undefined;
  return v ? { title: `${v.title} · Doyeon` } : {};
}

export default async function TranslatedPostPage({ params }: Params) {
  const { slug, lang } = await params;
  if (!isLang(lang)) notFound();
  if (lang === DEFAULT_LANG) redirect(`/writing/${slug}`);
  const post = getPost(slug);
  const version = post?.versions[lang];
  if (!post || !version) notFound();
  return <PostView post={post} version={version} />;
}
