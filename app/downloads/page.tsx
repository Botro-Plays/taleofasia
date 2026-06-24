'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/app/components/PageShell';
import { sanitizeHtml } from '@/lib/sanitize';

interface PublicPage { title: string; content: string }

export default function DownloadsPage() {
  const [data, setData] = useState<PublicPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/public/pages?slug=downloads', { cache: 'no-store' });
        const json = await res.json();
        if (res.ok) setData({ title: json.title, content: json.content });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PageShell label="Tale of Asia" title={data?.title || 'Downloads'} backHref="/" backLabel="Home">
      <div className="toa-content-card" style={{ padding: '2rem' }}>
        {loading ? (
          <div className="toa-loading">Loading…</div>
        ) : (
          <div className="toa-prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(data?.content || '') }} />
        )}
      </div>
    </PageShell>
  );
}
