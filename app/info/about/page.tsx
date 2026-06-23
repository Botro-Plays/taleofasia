'use client';

import { useEffect, useState } from 'react';
import { GlobalTheme } from '@/app/components/GlobalTheme';
import { sanitizeHtml } from '@/lib/sanitize';

interface PublicPage { title: string; content: string }

export default function AboutPage() {
  const [data, setData] = useState<PublicPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/public/pages?slug=about', { cache: 'no-store' });
        const json = await res.json();
        if (res.ok) setData({ title: json.title, content: json.content });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <GlobalTheme>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="toa-page-header">
          <h1 className="toa-page-title">{data?.title || 'About'}</h1>
        </div>
        <div className="toa-content-card">
          {loading ? (
            <div className="text-slate-300">Loading...</div>
          ) : (
            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(data?.content || '') }} />
          )}
        </div>
      </div>
    </GlobalTheme>
  );
}
