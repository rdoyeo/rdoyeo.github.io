import type { Metadata } from 'next';
import AboutPage from '@/components/AboutPage';

export const metadata: Metadata = { title: 'About · Doyeon' };

export default function Page() {
  return <AboutPage />;
}
