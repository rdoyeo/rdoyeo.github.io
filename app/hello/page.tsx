import type { Metadata } from 'next';
import HelloPage from '@/components/HelloPage';

export const metadata: Metadata = { title: 'Say hello · Doyeon' };

export default function Page() {
  return <HelloPage />;
}
