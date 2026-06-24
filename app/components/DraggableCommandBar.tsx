'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useDraggable } from '@/app/components/useDraggable';

interface ServerStatus {
  status: 'online' | 'offline' | 'maintenance';
  onlineUsers: number;
}

interface CrownHolders {
  blessCastle: { clanName: string; iconID: number } | null;
  surviveOrDie: { clanName: string; iconID: number } | null;
}

export function DraggableCommandBar() {
  const { elementRef, orientation, isDragging, initialized, dragHandlers, style } = useDraggable({
    storageKey: 'command_bar',
    autoOrient: true,
  });

  const [serverStatus, setServerStatus] = useState<ServerStatus>({ status: 'online', onlineUsers: 0 });
  const [statusLoading, setStatusLoading] = useState(true);
  const [crownHolders, setCrownHolders] = useState<CrownHolders>({ blessCastle: null, surviveOrDie: null });

  const fetchStatus = useRef(async () => {
    try {
      const r = await fetch('/api/server-status', { cache: 'no-store' });
      const d = await r.json();
      setServerStatus(d);
      setStatusLoading(false);
    } catch {
      setStatusLoading(false);
    }
  });

  const fetchCrownHolders = useRef(async () => {
    try {
      const r = await fetch('/api/crown-holders', { cache: 'no-store' });
      const d = await r.json();
      setCrownHolders(d);
    } catch { /* ignore */ }
  });

  // Poll server status every 5s
  useEffect(() => {
    void fetchStatus.current();
    const id = setInterval(() => void fetchStatus.current(), 5_000);
    return () => clearInterval(id);
  }, []);

  // Poll crown holders every 30s (changes less frequently)
  useEffect(() => {
    void fetchCrownHolders.current();
    const id = setInterval(() => void fetchCrownHolders.current(), 30_000);
    return () => clearInterval(id);
  }, []);

  // Refetch immediately when tab becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchStatus.current();
        void fetchCrownHolders.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const isVertical = orientation === 'vertical';

  const combinedStyle: React.CSSProperties = {
    ...style,
    flexDirection: isVertical ? 'column' : 'row',
    transform: 'none',
    transition: isDragging ? 'none' : 'border-color 0.3s ease, box-shadow 0.3s ease',
    opacity: initialized ? 1 : 0,
  };

  return (
    <div
      ref={elementRef as React.RefObject<HTMLDivElement>}
      className="toa-command-bar toa-command-bar-draggable"
      style={combinedStyle}
      {...dragHandlers}
    >
      <div className="toa-command-cell" style={isVertical ? { padding: '0.4rem 0' } : undefined}>
        <div className="toa-command-label">Server</div>
        <div className="toa-command-value">
          {statusLoading ? (
            <span>Loading...</span>
          ) : (
            <>
              <div className={`toa-status-dot ${serverStatus.status}`} />
              <span>{serverStatus.status.toUpperCase()}</span>
              <span className="toa-command-sep">|</span>
              <span>{serverStatus.onlineUsers.toLocaleString()} {serverStatus.onlineUsers <= 1 ? 'user' : 'users'}</span>
            </>
          )}
        </div>
      </div>
      <div className="toa-command-divider" style={isVertical ? { width: '80%', height: '1px', margin: '0.25rem 0' } : undefined} />
      <div className="toa-command-cell" style={isVertical ? { padding: '0.4rem 0' } : undefined}>
        <div className="toa-command-label">Bless Castle</div>
        <div className={`toa-command-value ${!crownHolders.blessCastle?.clanName ? 'vacant' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {crownHolders.blessCastle?.iconID && crownHolders.blessCastle.iconID > 0 && (
            <Image
              src={`https://taleofasia.com/ClanImage/${crownHolders.blessCastle.iconID}.bmp`}
              alt="Clan"
              width={24}
              height={24}
              style={{ borderRadius: '3px', flexShrink: 0, border: '1px solid rgba(184,155,94,0.3)' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          {crownHolders.blessCastle?.clanName || 'Vacant'}
        </div>
      </div>
      <div className="toa-command-divider" style={isVertical ? { width: '80%', height: '1px', margin: '0.25rem 0' } : undefined} />
      <div className="toa-command-cell" style={isVertical ? { padding: '0.4rem 0' } : undefined}>
        <div className="toa-command-label">Bellatra</div>
        <div className={`toa-command-value ${!crownHolders.surviveOrDie?.clanName ? 'vacant' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {crownHolders.surviveOrDie?.iconID && crownHolders.surviveOrDie.iconID > 0 && (
            <Image
              src={`https://taleofasia.com/ClanImage/${crownHolders.surviveOrDie.iconID}.bmp`}
              alt="Clan"
              width={24}
              height={24}
              style={{ borderRadius: '3px', flexShrink: 0, border: '1px solid rgba(184,155,94,0.3)' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          {crownHolders.surviveOrDie?.clanName || 'Vacant'}
        </div>
      </div>
    </div>
  );
}
