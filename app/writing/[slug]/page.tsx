/** /writing/<slug> — a post in its default language (or the only language it has). */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PostView from '@/components/PostView';
import { DEFAULT_LANG, getAllPosts, getPost, pick } from '@/lib/posts';
import 'katex/dist/katex.min.css';
import '../writing.css';

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = getPost((await params).slug);
  return post ? { title: `${pick(post, DEFAULT_LANG).title} · Doyeon` } : {};
}

export default async function PostPage({ params }: Params) {
  const post = getPost((await params).slug);
  if (!post) notFound();
  return <PostView post={post} version={pick(post, DEFAULT_LANG)} />;
}
