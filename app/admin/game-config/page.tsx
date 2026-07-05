'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { PageShell } from '@/app/components/PageShell';
import { Castle, Sword, Settings, RefreshCw } from 'lucide-react';

interface CrownHolder {
  ClanName: string;
  IconID: number;
  BellatraPoints?: number;
}

interface GameSettings {
  [key: string]: string;
}

const getClanIconUrl = (iconID: number) => {
  if (iconID === 0) return 'https://taleofasia.com/ClanImage/999999.bmp';
  if (iconID >= 1 && iconID <= 9) return `https://taleofasia.com/ClanImage/${100000 + iconID}.bmp`;
  if (iconID >= 10 && iconID <= 99) return `https://taleofasia.com/ClanImage/${10000 + iconID}.bmp`;
  if (iconID >= 100 && iconID <= 999) return `https://taleofasia.com/ClanImage/${1000 + iconID}.bmp`;
  return `https://taleofasia.com/ClanImage/${iconID}.bmp`;
};

const defaultSettings: GameSettings = {
  xp_rate: '1.0',
  drop_rate: '1.0',
  maintenance_mode: 'false',
  registration_enabled: 'true',
  server_message: '',
};

export default function GameConfigPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [crownHolders, setCrownHolders] = useState<{ blessCastle: CrownHolder | null; bellatra: CrownHolder | null }>({
    blessCastle: null,
    bellatra: null,
  });
  const [settings, setSettings] = useState<GameSettings>(defaultSettings);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/game-config');
      if (response.ok) {
        const data = await response.json();
        setCrownHolders(data.crownHolders || { blessCastle: null, bellatra: null });
        setSettings({ ...defaultSettings, ...(data.settings || {}) });
      }
    } catch (error) {
      console.error('Error fetching game config:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAdminAndFetch = useCallback(async () => {
    try {
      const adminCheck = await fetch('/api/admin/check');
      const adminData = await adminCheck.json();
      if (!adminData.isAdmin) {
        router.push('/dashboard');
        return;
      }
      await fetchConfig();
    } catch (error) {
      console.error('Error checking admin status:', error);
      router.push('/dashboard');
    }
  }, [fetchConfig, router]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const id = setTimeout(() => { void checkAdminAndFetch(); }, 0);
      return () => clearTimeout(id);
    }
  }, [status, router, checkAdminAndFetch]);

  const handleSettingChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/game-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (response.ok) {
        setMessage('Settings saved successfully!');
      } else {
        setMessage('Failed to save settings.');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <PageShell label="Admin" title="Game Configuration" backHref="/admin" backLabel="Admin">
        <div className="toa-loading">Loading…</div>
      </PageShell>
    );
  }

  return (
    <PageShell label="Admin" title="Game Configuration" backHref="/admin" backLabel="Admin">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          <div className="toa-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Castle size={18} style={{ color: 'var(--toa-gold)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--toa-muted)', marginBottom: '0.35rem' }}>Bless Castle</div>
              {crownHolders.blessCastle ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <img src={getClanIconUrl(crownHolders.blessCastle.IconID)} alt={crownHolders.blessCastle.ClanName} width={36} height={36} style={{ border: '1px solid rgba(184,155,94,0.3)' }} />
                  <span style={{ fontWeight: 700, color: 'var(--toa-bone)', fontSize: '0.875rem' }}>{crownHolders.blessCastle.ClanName}</span>
                </div>
              ) : <span style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>No current holder</span>}
            </div>
          </div>

          <div className="toa-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Sword size={18} style={{ color: 'var(--toa-gold)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--toa-muted)', marginBottom: '0.35rem' }}>Bellatra Champion</div>
              {crownHolders.bellatra ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <img src={getClanIconUrl(crownHolders.bellatra.IconID)} alt={crownHolders.bellatra.ClanName} width={36} height={36} style={{ border: '1px solid rgba(184,155,94,0.3)' }} />
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--toa-bone)', fontSize: '0.875rem' }}>{crownHolders.bellatra.ClanName}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--toa-muted)' }}>Points: <span style={{ color: 'var(--toa-gold)' }}>{crownHolders.bellatra.BellatraPoints?.toLocaleString() || 'N/A'}</span></div>
                  </div>
                </div>
              ) : <span style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>No current leader</span>}
            </div>
          </div>
        </div>

        <div className="toa-seal-card" style={{ padding: '2rem', position: 'relative' }}>
          <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-tr" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--toa-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.5rem' }}>
            <Settings size={14} /> Server Settings
          </div>

          {message && (
            <div className={`toa-msg ${message.includes('success') ? 'toa-msg-success' : 'toa-msg-error'}`} style={{ marginBottom: '1.25rem' }}>{message}</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label className="toa-label-field">XP Rate Multiplier</label>
              <input type="number" step="0.1" value={settings.xp_rate || '1.0'} onChange={(e) => handleSettingChange('xp_rate', e.target.value)} className="toa-input" />
              <div style={{ fontSize: '0.68rem', color: 'var(--toa-muted)', marginTop: '0.25rem' }}>1.0 = normal, 2.0 = double XP</div>
            </div>
            <div>
              <label className="toa-label-field">Drop Rate Multiplier</label>
              <input type="number" step="0.1" value={settings.drop_rate || '1.0'} onChange={(e) => handleSettingChange('drop_rate', e.target.value)} className="toa-input" />
              <div style={{ fontSize: '0.68rem', color: 'var(--toa-muted)', marginTop: '0.25rem' }}>1.0 = normal, 2.0 = double drops</div>
            </div>
            <div>
              <label className="toa-label-field">Maintenance Mode</label>
              <select value={settings.maintenance_mode || 'false'} onChange={(e) => handleSettingChange('maintenance_mode', e.target.value)} className="toa-select" style={{ width: '100%' }}>
                <option value="false">Disabled</option>
                <option value="true">Enabled</option>
              </select>
            </div>
            <div>
              <label className="toa-label-field">Registration</label>
              <select value={settings.registration_enabled || 'true'} onChange={(e) => handleSettingChange('registration_enabled', e.target.value)} className="toa-select" style={{ width: '100%' }}>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="toa-label-field">Server Message (In-Game Broadcast)</label>
            <textarea rows={3} value={settings.server_message || ''} onChange={(e) => handleSettingChange('server_message', e.target.value)} placeholder="Enter a message to broadcast to all online players..." className="toa-textarea" />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={handleSave} disabled={saving} className="toa-btn toa-btn-solid toa-btn-sm" style={{ opacity: saving ? 0.5 : 1 }}>Save Settings</button>
            <button onClick={fetchConfig} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><RefreshCw size={12} /> Refresh</button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
