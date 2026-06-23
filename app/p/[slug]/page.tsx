'use client';

import { useEffect, useState } from 'react';
import { GlobalTheme } from '@/app/components/GlobalTheme';
import { sanitizeHtml } from '@/lib/sanitize';

interface PublicPage { title: string; content: string }

export default function PublicCmsPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const [data, setData] = useState<PublicPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const res = await fetch(`/api/public/pages?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || json?.error) {
          setError(json?.error || 'Not found');
          setData(null);
        } else {
          setData({ title: json.title, content: json.content });
        }
      } catch {
        setError('Failed to load');
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  return (
    <GlobalTheme>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="toa-page-header">
          <h1 className="toa-page-title">{data?.title || slug}</h1>
        </div>
        <div className="toa-content-card">
          {loading ? (
            <div className="text-slate-300">Loading...</div>
          ) : error ? (
            <div className="text-red-400">{error}</div>
          ) : (
            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(data?.content || '') }} />
          )}
        </div>
      </div>
    </GlobalTheme>
  );
}
