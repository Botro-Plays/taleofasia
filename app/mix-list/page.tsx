'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageShell } from '@/app/components/PageShell';

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

const SHELTOMS: Array<{ name: string; col: string; img: string }> = [
  { name: 'Lucidy',     col: 'Lucidy',       img: 'itos101.png' },
  { name: 'Sereneo',    col: 'Sereneo',      img: 'itos102.png' },
  { name: 'Fadeo',      col: 'Fadeo',        img: 'itos103.png' },
  { name: 'Sparky',     col: 'Sparky',       img: 'itos104.png' },
  { name: 'Raident',    col: 'Raident',      img: 'itos105.png' },
  { name: 'Transparo',  col: 'Transparo',    img: 'itos106.png' },
  { name: 'Murky',      col: 'Murky',        img: 'itos107.png' },
  { name: 'Devine',     col: 'Devine',       img: 'itos108.png' },
  { name: 'Celesto',    col: 'Celesto',      img: 'itos109.png' },
  { name: 'Mirage',     col: 'Mirage',       img: 'itos110.png' },
  { name: 'Inferna',    col: 'Inferna',      img: 'itos111.png' },
  { name: 'Enigma',     col: 'Enigma',       img: 'itos112.png' },
  { name: 'Bellum',     col: 'Bellum',       img: 'itos113.png' },
  { name: 'Oredo',      col: 'NewSheltom13', img: 'itos114.png' },
];

export default function MixListPage() {
  const [items, setItems] = useState<MixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const mixRes = await fetch('/api/public/mix-list', { cache: 'no-store' });
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
    const chips: Array<{ name: string; count: number; img: string }> = [];
    for (const s of SHELTOMS) {
      const val = Number(row[s.col] || 0);
      if (val > 0) chips.push({ name: s.name, count: val, img: s.img });
    }
    return chips;
  };

  const typeOptions = [{ value: '', label: 'All' as const }, ...Object.entries(TYPE_NAMES).map(([k, v]) => ({ value: Number(k), label: v }))];

  return (
    <PageShell label="Guide" title="Mix List" backHref="/" backLabel="Home">
      <div className="toa-content-card">
          {loading ? (
            <div className="toa-loading">Loading…</div>
          ) : error ? (
            <div style={{ color: 'var(--toa-danger)' }}>{error}</div>
          ) : items.length === 0 ? (
            <div style={{ color: 'var(--toa-muted)' }}>No mixes available</div>
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
                            if (!attrs && shels.length === 0) return null;
                            return (
                              <tr key={row.ID}>
                                <td>{String(row.Description || '').replace(' Successful', '')}</td>
                                <td>{attrs || '—'}</td>
                                <td>
                                  {shels.length === 0 ? (
                                    <span style={{ color: 'var(--toa-muted)' }}>—</span>
                                  ) : (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                      {shels.map((s) => (
                                        <span key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }} title={s.name}>
                                          <img src={`/items/${s.img}`} alt={s.name} width={24} height={24} style={{ imageRendering: 'pixelated' }} />
                                          <span style={{ fontSize: '0.8rem', color: 'var(--toa-text)' }}>{s.name} x{s.count}</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
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
    </PageShell>
  );
}
