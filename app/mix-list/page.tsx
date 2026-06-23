'use client';

import { useEffect, useMemo, useState } from 'react';
import { GlobalTheme } from '@/app/components/GlobalTheme';
import { sanitizeHtml } from '@/lib/sanitize';

type MixRow = Record<string, any> & {
  ID: number;
  TypeMix: number;
  Description: string;
  TypeAtributte?: number; Atributte?: number;
  TypeAtributte2?: number; Atributte2?: number;
  TypeAtributte3?: number; Atributte3?: number;
  TypeAtributte4?: number; Atributte4?: number;
  TypeAtributte5?: number; Atributte5?: number;
  TypeAtributte6?: number; Atributte6?: number;
  TypeAtributte7?: number; Atributte7?: number;
  TypeAtributte8?: number; Atributte8?: number;
};

const TYPE_NAMES: Record<number, string> = {
  1: 'Weapons',
  2: 'Armors & Robes',
  3: 'Shields',
  4: 'Orbs',
  5: 'Bracelets',
  6: 'Gauntlets',
  7: 'Boots',
  8: 'Amulets',
  9: 'Rings',
};

const ATTR_NAMES: Record<number, string> = {
  1: 'Fire',
  2: 'Ice',
  4: 'Lightning',
  8: 'Poison',
  16: 'Organic',
  32: 'Critical',
  64: 'Attack Rating',
  128: 'Min Damage',
  256: 'Max Damage',
  512: 'Attack Speed',
  1024: 'Absorption',
  2048: 'Defense',
  4096: 'Block Rating',
  8192: 'Run Speed',
  16384: 'HP',
  32768: 'MP',
  65536: 'SP',
  131072: 'HP Regen',
  262144: 'MP Regen',
  524288: 'SP Regen',
  1048576: 'Potion Count',
};

const SHELTOMS = ['Lucidy','Sereneo','Fadeo','Sparky','Raident','Transparo','Murky','Devine','Celesto','Mirage','Inferna','Enigma','Bellum','NewSheltom13','NewSheltom14','NewSheltom15'];

export default function MixListPage() {
  const [cmsTitle, setCmsTitle] = useState('Mix List');
  const [cmsIntro, setCmsIntro] = useState<string>('');
  const [items, setItems] = useState<MixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [pageRes, mixRes] = await Promise.all([
          fetch('/api/public/pages?slug=mix-list', { cache: 'no-store' }),
          fetch('/api/public/mix-list', { cache: 'no-store' }),
        ]);
        try {
          const page = await pageRes.json();
          if (pageRes.ok) {
            setCmsTitle(page.title || 'Mix List');
            setCmsIntro(page.content || '');
          }
        } catch {}
        const mixJson = await mixRes.json();
        if (mixRes.ok && Array.isArray(mixJson.items)) {
          setItems(mixJson.items as MixRow[]);
        } else if (mixJson.error) {
          setError(String(mixJson.error));
        }
      } catch {
        setError('Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const g = new Map<number, MixRow[]>();
    for (const it of items) {
      const k = Number(it.TypeMix) || 0;
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(it);
    }
    return g;
  }, [items]);

  const renderAttrs = (row: MixRow) => {
    const parts: string[] = [];
    for (let i = 1; i <= 8; i++) {
      const t = (row as any)[i === 1 ? 'TypeAtributte' : `TypeAtributte${i}`];
      const v = (row as any)[i === 1 ? 'Atributte' : `Atributte${i}`];
      if (t && v && ATTR_NAMES[t]) parts.push(`${ATTR_NAMES[t]}: ${Number(v).toFixed(1)}`);
    }
    return parts.join(' · ');
  };

  const renderSheltoms = (row: MixRow) => {
    const chips: string[] = [];
    for (const s of SHELTOMS) {
      const val = Number(row[s] || 0);
      if (val > 0) chips.push(`${s} x${val}`);
    }
    return chips.join(', ');
  };

  const typeOptions = [{ value: '', label: 'All' as const }, ...Object.entries(TYPE_NAMES).map(([k, v]) => ({ value: Number(k), label: v }))];

  return (
    <GlobalTheme>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="toa-page-header">
          <h1 className="toa-page-title">{cmsTitle}</h1>
        </div>
        {cmsIntro && (
          <div className="toa-content-card" style={{ marginBottom: '1.5rem' }}>
            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(cmsIntro) }} />
          </div>
        )}

        <div className="toa-content-card">
          {loading ? (
            <div className="text-slate-300">Loading…</div>
          ) : error ? (
            <div className="text-red-400">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-slate-300">No mixes available</div>
          ) : (
            <>
              <div className="toa-filter-row" style={{ marginBottom: '1.5rem' }}>
                <span className="toa-filter-label">Item Type</span>
                <select
                  value={typeFilter as any}
                  onChange={(e) => setTypeFilter(e.target.value ? Number(e.target.value) : '')}
                  className="toa-select"
                >
                  {typeOptions.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </select>
              </div>

              {[...grouped.entries()]
                .filter(([type]) => (typeFilter === '' ? true : type === typeFilter))
                .sort((a, b) => a[0] - b[0])
                .map(([type, rows]) => (
                  <div key={type} className="mb-8">
                    <h2 style={{ fontSize: '1.1rem', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.1em', color: 'var(--toa-gold-bright)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>{TYPE_NAMES[type] || `Type ${type}`}</h2>
                    <div className="overflow-x-auto">
                      <table className="toa-table" style={{ marginBottom: '0.5rem' }}>
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th>Attributes</th>
                            <th>Required Sheltoms</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => {
                            const attrs = renderAttrs(row);
                            const shels = renderSheltoms(row);
                            if (!attrs && !shels) return null;
                            return (
                              <tr key={row.ID}>
                                <td>{String(row.Description || '').replace(' Successful', '')}</td>
                                <td>{attrs || '—'}</td>
                                <td>{shels || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </GlobalTheme>
  );
}
