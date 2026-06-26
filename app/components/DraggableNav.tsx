'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

type Orientation = 'horizontal' | 'vertical';
type EdgeZone = 'top' | 'bottom' | 'left' | 'right';

interface NavPosition {
  x: number;
  y: number;
  orientation: Orientation;
  edge: EdgeZone;
}

const DEFAULT_POSITION: NavPosition = {
  x: 0,
  y: 0,
  orientation: 'horizontal',
  edge: 'bottom',
};

const STORAGE_KEY = 'toc_nav_position';
const EDGE_THRESHOLD = 80;

function loadPosition(): NavPosition {
  if (typeof window === 'undefined') return DEFAULT_POSITION;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_POSITION;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return {
        x: parsed.x,
        y: parsed.y,
        orientation: parsed.orientation || 'horizontal',
        edge: parsed.edge || 'bottom',
      };
    }
  } catch { /* ignore */ }
  return DEFAULT_POSITION;
}

function savePosition(pos: NavPosition) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch { /* ignore */ }
}

function getEdgeFromPosition(x: number, y: number, win: Window): EdgeZone {
  const w = win.innerWidth;
  const h = win.innerHeight;
  const distTop = y;
  const distBottom = h - y;
  const distLeft = x;
  const distRight = w - x;
  const min = Math.min(distTop, distBottom, distLeft, distRight);
  if (min === distTop && distTop < EDGE_THRESHOLD) return 'top';
  if (min === distBottom && distBottom < EDGE_THRESHOLD) return 'bottom';
  if (min === distLeft && distLeft < EDGE_THRESHOLD) return 'left';
  if (min === distRight && distRight < EDGE_THRESHOLD) return 'right';
  // Default: nearest edge
  if (min === distTop) return 'top';
  if (min === distBottom) return 'bottom';
  if (min === distLeft) return 'left';
  return 'right';
}

function getOrientationForEdge(edge: EdgeZone): Orientation {
  return (edge === 'left' || edge === 'right') ? 'vertical' : 'horizontal';
}

export function DraggableNav({ customPages }: { customPages: Array<{ Slug: string; Title: string }> }) {
  const { data: session } = useSession();
  const navRef = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<NavPosition>(DEFAULT_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, navX: 0, navY: 0 });
  const dragMoved = useRef(false);
  const pathname = usePathname();

  const isActive = (href: string): boolean => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname.startsWith('/admin');
    }
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  // Load saved position on mount
  useEffect(() => {
    const saved = loadPosition();
    if (saved.x === 0 && saved.y === 0) {
      // First time: center bottom
      const w = window.innerWidth;
      const h = window.innerHeight;
      const navEl = navRef.current;
      const navW = navEl?.offsetWidth || 600;
      const navH = navEl?.offsetHeight || 50;
      const init = {
        x: (w - navW) / 2,
        y: h - navH - 72,
        orientation: 'horizontal' as Orientation,
        edge: 'bottom' as EdgeZone,
      };
      setPosition(init);
    } else {
      setPosition(saved);
    }
    setInitialized(true);
  }, []);

  // Clamp position on resize
  useEffect(() => {
    if (!initialized) return;
    const handleResize = () => {
      const navEl = navRef.current;
      if (!navEl) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const navW = navEl.offsetWidth;
      const navH = navEl.offsetHeight;
      setPosition((prev) => {
        const clamped = {
          x: Math.max(8, Math.min(prev.x, w - navW - 8)),
          y: Math.max(8, Math.min(prev.y, h - navH - 8)),
        };
        const edge = getEdgeFromPosition(clamped.x + navW / 2, clamped.y + navH / 2, window);
        const orientation = getOrientationForEdge(edge);
        const next = { x: clamped.x, y: clamped.y, orientation, edge };
        savePosition(next);
        return next;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initialized]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only start drag from the nav bar itself (not from links/buttons)
    const target = e.target as HTMLElement;
    if (target.closest('a, button')) return;

    const navEl = navRef.current;
    if (!navEl) return;

    setIsDragging(true);
    dragMoved.current = false;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      navX: position.x,
      navY: position.y,
    };
    navEl.setPointerCapture(e.pointerId);
  }, [position.x, position.y]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragMoved.current = true;
    }
    if (!dragMoved.current) return;

    const navEl = navRef.current;
    if (!navEl) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const navW = navEl.offsetWidth;
    const navH = navEl.offsetHeight;

    let newX = dragStart.current.navX + dx;
    let newY = dragStart.current.navY + dy;
    newX = Math.max(8, Math.min(newX, w - navW - 8));
    newY = Math.max(8, Math.min(newY, h - navH - 8));

    const centerX = newX + navW / 2;
    const centerY = newY + navH / 2;
    const edge = getEdgeFromPosition(centerX, centerY, window);
    const orientation = getOrientationForEdge(edge);

    setPosition((prev) => {
      if (prev.orientation !== orientation) {
        // Orientation changed — re-clamp based on new dimensions after render
        // Use requestAnimationFrame to measure after DOM updates
        requestAnimationFrame(() => {
          const el = navRef.current;
          if (!el) return;
          const newW = el.offsetWidth;
          const newH = el.offsetHeight;
          setPosition((p) => {
            const clampedX = Math.max(8, Math.min(p.x, w - newW - 8));
            const clampedY = Math.max(8, Math.min(p.y, h - newH - 8));
            const next = { x: clampedX, y: clampedY, orientation, edge };
            savePosition(next);
            return next;
          });
        });
      }
      const next = { x: newX, y: newY, orientation, edge };
      savePosition(next);
      return next;
    });
  }, [isDragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    const navEl = navRef.current;
    if (navEl) {
      try { navEl.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
  }, [isDragging]);

  const isVertical = position.orientation === 'vertical';

  const navStyle: React.CSSProperties = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    flexDirection: isVertical ? 'column' : 'row',
    borderRadius: isVertical ? '16px' : '999px',
    padding: isVertical ? '0.5rem' : '0.5rem 0.5rem 0.5rem 1rem',
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
    touchAction: 'none',
    transform: 'none',
    transition: isDragging ? 'none' : 'border-color 0.3s ease, box-shadow 0.3s ease',
  };

  return (
    <nav
      ref={navRef}
      className="toa-nav-pill toa-nav-draggable"
      style={navStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <Link href="/" className="toa-nav-brand" style={isVertical ? { padding: '0.5rem 0 0.75rem', justifyContent: 'center' } : undefined}>
        TOA
      </Link>
      <div
        className="toa-nav-links"
        style={isVertical ? { flexDirection: 'column', gap: '0.125rem' } : undefined}
      >
        <Link href="/downloads" className={isActive('/downloads') ? 'toa-nav-cta toa-nav-auth' : 'toa-nav-link'}>Download</Link>
        <Link href="/rankings" className={isActive('/rankings') ? 'toa-nav-cta toa-nav-auth' : 'toa-nav-link'}>Rankings</Link>
        <div className="relative group" style={isVertical ? { position: 'relative' } : undefined}>
          <span className={isActive('/items') || isActive('/info/getting-started') || isActive('/mix-list') ? 'toa-nav-cta toa-nav-auth' : 'toa-nav-link'} style={{ cursor: 'pointer' }}>Guides</span>
          <div
            className={`invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute ${isVertical ? 'left-full top-0 ml-2' : 'mt-2 left-0'} w-48 bg-[var(--toa-smoke)] border border-[rgba(184,155,94,0.15)] rounded-lg shadow-lg transition-opacity py-1`}
          >
            <Link href="/info/getting-started" className="block px-4 py-2 text-sm text-[var(--toa-muted)] hover:text-[var(--toa-gold-bright)] hover:bg-[rgba(184,155,94,0.06)] transition-colors">Getting Started</Link>
            <Link href="/items" className="block px-4 py-2 text-sm text-[var(--toa-muted)] hover:text-[var(--toa-gold-bright)] hover:bg-[rgba(184,155,94,0.06)] transition-colors">Item List</Link>
            <Link href="/mix-list" className="block px-4 py-2 text-sm text-[var(--toa-muted)] hover:text-[var(--toa-gold-bright)] hover:bg-[rgba(184,155,94,0.06)] transition-colors">Mix List</Link>
          </div>
        </div>
        <Link href="/info/server-rules" className={isActive('/info/server-rules') ? 'toa-nav-cta toa-nav-auth' : 'toa-nav-link'}>Rules</Link>
        {customPages.length > 0 && (
          <div className="relative group" style={isVertical ? { position: 'relative' } : undefined}>
            <span className="toa-nav-link" style={{ cursor: 'pointer' }}>More</span>
            <div
              className={`invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute ${isVertical ? 'left-full top-0 ml-2' : 'mt-2 left-0'} w-48 bg-[var(--toa-smoke)] border border-[rgba(184,155,94,0.15)] rounded-lg shadow-lg transition-opacity py-1`}
            >
              {customPages.map((p) => (
                <Link
                  key={p.Slug}
                  href={`/p/${encodeURIComponent(p.Slug)}`}
                  className="block px-4 py-2 text-sm text-[var(--toa-muted)] hover:text-[var(--toa-gold-bright)] hover:bg-[rgba(184,155,94,0.06)] transition-colors"
                >
                  {p.Title}
                </Link>
              ))}
              <Link href="/info/about" className="block px-4 py-2 text-sm text-[var(--toa-muted)] hover:text-[var(--toa-gold-bright)] hover:bg-[rgba(184,155,94,0.06)] transition-colors">About</Link>
            </div>
          </div>
        )}
        {session ? (
          <>
            <Link href="/dashboard" className={isActive('/dashboard') ? 'toa-nav-cta toa-nav-auth' : 'toa-nav-link toa-nav-auth'}>Dashboard</Link>
            <button
              onClick={() => signOut()}
              className="toa-nav-link toa-nav-auth"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Logout
            </button>
          </>
        ) : (
          <Link href="/login" className="toa-nav-cta toa-nav-auth">Login</Link>
        )}
      </div>
    </nav>
  );
}
