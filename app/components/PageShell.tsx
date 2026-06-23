'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { GlobalTheme } from './GlobalTheme';
import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  label: string;
  title: string;
  backHref: string;
  backLabel?: string;
  actions?: ReactNode;
}

export function PageShell({ children, label, title, backHref, backLabel = 'Back', actions }: PageShellProps) {
  return (
    <GlobalTheme>
      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '3.5rem 1.5rem 10rem' }}>
        <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div className="toa-label">{label}</div>
            <h1 style={{
              fontFamily: 'var(--font-asian, "ZCOOL XiaoWei"), serif',
              fontWeight: 400,
              fontSize: 'clamp(2rem, 5vw, 3rem)', color: 'var(--toa-gold-bright)',
              letterSpacing: '0.12em', margin: 0,
              textShadow: '0 0 40px rgba(184,155,94,0.2)',
            }}>
              {title}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, marginTop: '0.375rem' }}>
            {actions}
            <Link
              href={backHref}
              className="toa-btn toa-btn-ghost toa-btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <ChevronLeft size={13} />
              {backLabel}
            </Link>
          </div>
        </div>
        {children}
      </div>
    </GlobalTheme>
  );
}
