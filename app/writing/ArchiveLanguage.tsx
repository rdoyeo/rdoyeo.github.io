'use client';

import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

export default function ArchiveLanguage({ english, korean }: { english: ReactNode; korean: ReactNode }) {
  return useSearchParams().get('lang') === 'ko' ? korean : english;
}
