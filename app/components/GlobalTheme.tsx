 'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import CookieConsent from '@/app/components/CookieConsent';
import { DraggableNav } from '@/app/components/DraggableNav';
import { DraggableCommandBar } from '@/app/components/DraggableCommandBar';

interface GlobalThemeProps {
  children: React.ReactNode;
  showNav?: boolean;
  showFooter?: boolean;
  showTicker?: boolean;
  tickerItems?: { label: string; value: string; icon?: number; statusColor?: string }[];
}

export function GlobalTheme({ children, showNav = true, showFooter = true, showTicker = false, tickerItems = [] }: GlobalThemeProps) {
  useSession();
  const [customPages, setCustomPages] = useState<Array<{ Slug: string; Title: string }>>([]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const r = await fetch('/api/public/pages/list', { cache: 'no-store' });
        const j = await r.json();
        if (isMounted && Array.isArray(j.items)) {
          const builtins = new Set(['downloads','getting-started','server-rules','about','mix-list','downloads-links']);
          const items = j.items
            .filter((x: any) => x && x.Slug && !builtins.has(String(x.Slug).toLowerCase()))
            .slice(0, 5)
            .map((x: any) => ({ Slug: String(x.Slug), Title: String(x.Title || x.Slug) }));
          setCustomPages(items);
        }
      } catch {}
    })();
    return () => { isMounted = false; };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--toa-void)', color: 'var(--toa-bone)', display: 'flex', flexDirection: 'column' }}>
      <CookieConsent />

      {/* === TICKER: Scrolling marquee === */}
      {showTicker && tickerItems.length > 0 && (
        <div className="toa-ticker">
          <div className="toa-ticker-track">
            {[...tickerItems, ...tickerItems].map((item, idx) => (
              <div key={idx} className="toa-ticker-item">
                {item.statusColor ? (
                  <span style={{
                    width: '0.5rem',
                    height: '0.5rem',
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: item.statusColor === 'online' ? '#22c55e' :
                               item.statusColor === 'maintenance' ? '#fb923c' : '#ef4444',
                    boxShadow: `0 0 6px ${
                      item.statusColor === 'online' ? '#22c55e' :
                      item.statusColor === 'maintenance' ? '#fb923c' : '#ef4444'
                    }`,
                  }} />
                ) : (
                  <span className="toa-ticker-dot" />
                )}
                {item.icon !== undefined && item.icon !== 0 && (
                  <Image
                    src={`https://taleofasia.com/ClanImage/${
                      item.icon >= 1 && item.icon <= 9 ? 100000 + item.icon :
                      item.icon >= 10 && item.icon <= 99 ? 10000 + item.icon :
                      item.icon >= 100 && item.icon <= 999 ? 1000 + item.icon :
                      item.icon
                    }.bmp`}
                    alt="Clan"
                    width={16}
                    height={16}
                    style={{ borderRadius: '2px', flexShrink: 0 }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === NAV: Draggable glass pill (desktop) / button bar (mobile) === */}
      {showNav && (
        <>
          <DraggableNav customPages={customPages} />
          <DraggableCommandBar />
        </>
      )}

      {/* Main content — no padding top, hero handles its own spacing */}
      <main className="flex-1">
        {children}
      </main>

      {/* === FOOTER: Minimal single row === */}
      {showFooter && (
        <footer className="toa-footer">
          <div className="toa-footer-brand">TALE OF ASIA</div>
          <div className="toa-footer-links">
            <Link href="/downloads">Download</Link>
            <Link href="/rankings">Rankings</Link>
            <Link href="/info/getting-started">Guide</Link>
            <Link href="/info/server-rules">Rules</Link>
            <Link href="/privacy-policy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
          <div className="toa-footer-copy">
            &copy; {new Date().getFullYear()} Tale of Asia
          </div>
        </footer>
      )}
    </div>
  );
}
