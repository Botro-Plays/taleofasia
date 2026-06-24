'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { PageShell } from '@/app/components/PageShell';
import { Wifi, WifiOff, Star, X } from 'lucide-react';

interface Character {
  Name: string;
  Level: number;
  Experience: number;
  JobCode: number;
  ClanID: number;
  ClanName: string;
  IsClanLeader: boolean;
  ClanNote?: string;
  ClanLoginMessage?: string;
  RebornStage?: number;
  RebornCount?: number;
  Gold?: number;
  IsOnline?: boolean;
  ExpTotalAtLevel?: number;
  ExpRequiredAtLevel?: number;
}

const classDetails: Record<number, { name: string; image: string }> = {
  1: { name: 'Fighter', image: '/images/CharClass/1.png' },
  2: { name: 'Mechanician', image: '/images/CharClass/2.png' },
  3: { name: 'Archer', image: '/images/CharClass/3.png' },
  4: { name: 'Pikeman', image: '/images/CharClass/4.png' },
  5: { name: 'Atalanta', image: '/images/CharClass/5.png' },
  6: { name: 'Knight', image: '/images/CharClass/6.png' },
  7: { name: 'Magician', image: '/images/CharClass/7.png' },
  8: { name: 'Priestess', image: '/images/CharClass/8.png' },
  9: { name: 'Assassin', image: '/images/CharClass/9.png' },
  10: { name: 'Shaman', image: '/images/CharClass/10.png' },
};

const getClanIconUrl = (clanID: number, bust?: number) => {
  if (clanID === 0) return 'https://taleofasia.com/ClanImage/999999.bmp';
  const base = `https://taleofasia.com/ClanImage/${1000000 + clanID}.bmp`;
  return bust ? `${base}?t=${bust}` : base;
};

export default function CharactersPage() {
  const { status } = useSession();
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [charError, setCharError] = useState<string | null>(null);
  const [showClanModal, setShowClanModal] = useState(false);
  const [selectedClan, setSelectedClan] = useState<{ clanID: number; clanName: string; characterName: string } | null>(null);
  const [loginMessage, setLoginMessage] = useState('');
  const [clanNote, setClanNote] = useState('');
  const [currentLoginMessage, setCurrentLoginMessage] = useState('');
  const [currentNote, setCurrentNote] = useState('');
  const [clanImage, setClanImage] = useState<File | null>(null);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [iconBust, setIconBust] = useState(0);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchCharacters = useCallback(async () => {
    setLoading(true);
    try {
      setCharError(null);
      const response = await fetch('/api/user/characters');
      const data = await response.json();
      if (!response.ok) {
        setCharError(data?.error || 'Failed to load characters');
        return;
      }
      setCharacters(Array.isArray(data.characters) ? data.characters : []);
    } catch (error) {
      console.error('Error fetching characters:', error);
      setCharError('Failed to load characters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const id = setTimeout(() => { void fetchCharacters(); }, 0);
      return () => clearTimeout(id);
    }
  }, [status, router, fetchCharacters]);

  const handleOpenClanModal = (clanID: number, clanName: string, characterName: string, currentNote: string, currentLoginMessage: string) => {
    setSelectedClan({ clanID, clanName, characterName });
    setLoginMessage('');
    setClanNote(currentNote);
    setCurrentLoginMessage(currentLoginMessage);
    setCurrentNote(currentNote);
    setClanImage(null);
    setShowClanModal(true);
  };

  const handleCloseClanModal = () => {
    setShowClanModal(false);
    setSelectedClan(null);
    setLoginMessage('');
    setClanNote('');
    setClanImage(null);
  };

  const handleUpdateClan = async () => {
    if (!selectedClan) return;

    setUpdating(true);
    try {
      if (loginMessage) {
        const response = await fetch('/api/clan/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clanID: selectedClan.clanID,
            characterName: selectedClan.characterName,
            loginMessage,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update login message');
        }
      }

      if (clanNote !== undefined) {
        const response = await fetch('/api/clan/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clanID: selectedClan.clanID,
            characterName: selectedClan.characterName,
            note: clanNote,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update clan note');
        }
      }

      if (clanImage) {
        const formData = new FormData();
        formData.append('clanID', selectedClan.clanID.toString());
        formData.append('characterName', selectedClan.characterName);
        formData.append('clanImage', clanImage);

        const response = await fetch('/api/clan/upload-image', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to upload clan image');
        }
      }

      showToast('Clan updated successfully', 'success');
      setIconBust(Date.now());
      handleCloseClanModal();
      fetchCharacters();
    } catch (error) {
      console.error('Error updating clan:', error);
      showToast(error instanceof Error ? error.message : 'Failed to update clan', 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <PageShell label="Account" title="My Characters" backHref="/dashboard" backLabel="Dashboard">
        <div className="toa-loading">Loading…</div>
      </PageShell>
    );
  }

  return (
    <PageShell label="Account" title="My Characters" backHref="/dashboard" backLabel="Dashboard">
      {toast && (
        <div
          style={{
            position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 60,
            padding: '0.75rem 1.25rem', fontSize: '0.875rem',
            background: 'var(--toa-smoke)',
            border: `1px solid ${toast.type === 'success' ? 'var(--toa-success)' : 'var(--toa-danger)'}`,
            color: 'var(--toa-bone)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {toast.message}
        </div>
      )}

      {charError ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <div className="toa-msg toa-msg-error" style={{ display: 'inline-block', marginBottom: '1rem' }}>Characters temporarily unavailable.</div>
          <br />
          <button onClick={fetchCharacters} className="toa-btn toa-btn-ghost toa-btn-sm">Retry</button>
        </div>
      ) : characters.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {characters.map((char) => (
            <div key={char.Name} className="toa-seal-card" style={{ overflow: 'hidden', position: 'relative' }}>
              <div className="toa-seal-corner toa-seal-corner-tl" />
              <div className="toa-seal-corner toa-seal-corner-tr" />
              <div className="toa-seal-corner toa-seal-corner-bl" />
              <div className="toa-seal-corner toa-seal-corner-br" />
              {/* Character Header */}
              <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(184,155,94,0.1)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--toa-gold-bright)', marginBottom: '0.2rem' }}>{char.Name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--toa-muted)' }}>Level {char.Level}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--toa-muted)', marginTop: '0.15rem' }}>Reborn Stage <span style={{ color: 'var(--toa-gold-bright)', fontWeight: 600 }}>{char.RebornStage ?? 0}</span></div>
                </div>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <Image
                    src={classDetails[char.JobCode]?.image || '/images/CharClass/0.png'}
                    alt="Class"
                    width={52}
                    height={52}
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(184,155,94,0.15)', padding: '0.3rem' }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/CharClass/0.png'; }}
                  />
                  <div style={{ fontSize: '0.68rem', color: 'var(--toa-muted)', marginTop: '0.25rem' }}>{classDetails[char.JobCode]?.name || 'Unknown'}</div>
                </div>
              </div>

              {/* Character Stats */}
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <span className={`toa-badge ${char.IsOnline ? 'toa-badge-success' : 'toa-badge-muted'}`}>
                    {char.IsOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
                    {char.IsOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="toa-panel" style={{ padding: '0.75rem', minWidth: 0 }}>
                    <div style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--toa-muted)', marginBottom: '0.25rem' }}>Experience</div>
                    {(() => {
                      const cur = Number(char.Experience || 0);
                      const curLevelTotal = Number(char.ExpTotalAtLevel || 0);
                      const perLevelReq = Number(char.ExpRequiredAtLevel || 0);
                      if (curLevelTotal > 0 && perLevelReq > 0) {
                        const gained = Math.max(0, cur - curLevelTotal);
                        const pctRaw = (gained / perLevelReq) * 100;
                        const pct = Math.min(100, Math.max(0, pctRaw)).toFixed(3);
                        const curStr = cur.toLocaleString('en-US').replace(/,/g, ',\u200B');
                        const denomStr = (curLevelTotal + perLevelReq).toLocaleString('en-US').replace(/,/g, ',\u200B');
                        return (
                          <div style={{ fontSize: '0.82rem', color: 'var(--toa-bone)', fontWeight: 600, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.15rem' }}>
                            <span style={{ wordBreak: 'break-word' }}>{curStr}</span>
                            <span style={{ color: 'var(--toa-gold)' }}>/</span>
                            <span style={{ wordBreak: 'break-word' }}>{denomStr}</span>
                            <span style={{ color: 'var(--toa-gold)', fontSize: '0.72rem' }}>({pct}%)</span>
                          </div>
                        );
                      } else if (char.Level === 150) {
                        const curStr = cur.toLocaleString('en-US').replace(/,/g, ',\u200B');
                        return (
                          <div style={{ fontSize: '0.82rem', color: 'var(--toa-bone)', fontWeight: 600, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.3rem' }}>
                            <span style={{ wordBreak: 'break-word' }}>{curStr}</span>
                            <span style={{ color: 'var(--toa-gold)', fontSize: '0.72rem' }}>(Max Level)</span>
                          </div>
                        );
                      }
                      return (
                        <div style={{ fontSize: '0.82rem', color: 'var(--toa-bone)', fontWeight: 600, wordBreak: 'break-word' }}>{cur.toLocaleString('en-US')}</div>
                      );
                    })()}
                    <div style={{ fontSize: '0.65rem', color: 'var(--toa-muted)', marginTop: '0.25rem' }}>May not be accurate until logout.</div>
                  </div>
                  <div className="toa-panel" style={{ padding: '0.75rem', minWidth: 0 }}>
                    <div style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--toa-muted)', marginBottom: '0.25rem' }}>Gold</div>
                    <div style={{ color: 'var(--toa-gold-bright)', fontWeight: 600, fontSize: '0.875rem', wordBreak: 'break-all' }}>{Number(char.Gold || 0).toLocaleString('en-US')}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--toa-muted)', marginTop: '0.25rem' }}>May not be accurate until logout.</div>
                  </div>
                </div>

                {char.ClanID > 0 ? (
                  <div className="toa-panel" style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Image
                      src={getClanIconUrl(char.ClanID, iconBust)}
                      alt="Clan"
                      width={28}
                      height={28}
                      style={{ border: '1px solid rgba(184,155,94,0.2)', flexShrink: 0 }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://taleofasia.com/ClanImage/999999.bmp'; }}
                    />
                    <div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--toa-bone)', fontWeight: 600 }}>{char.ClanName}</div>
                      {char.IsClanLeader && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--toa-gold)' }}>
                          <Star size={10} />
                          Clan Leader
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="toa-panel" style={{ padding: '0.75rem' }}>
                    <div style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--toa-muted)', marginBottom: '0.2rem' }}>Clan</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--toa-muted)' }}>No Clan</div>
                  </div>
                )}
                {char.IsClanLeader && char.ClanID > 0 && (
                  <button
                    onClick={() => handleOpenClanModal(char.ClanID, char.ClanName, char.Name, char.ClanNote || '', char.ClanLoginMessage || '')}
                    className="toa-btn toa-btn-ghost toa-btn-sm"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Manage Clan
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--toa-muted)', fontSize: '0.875rem' }}>No characters found</div>
      )}

      {showClanModal && selectedClan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div className="toa-seal-card" style={{ padding: '2rem', maxWidth: '28rem', width: '100%', position: 'relative' }}>
            <div className="toa-seal-corner toa-seal-corner-tl" />
            <div className="toa-seal-corner toa-seal-corner-tr" />
            <div className="toa-seal-corner toa-seal-corner-bl" />
            <div className="toa-seal-corner toa-seal-corner-br" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--toa-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Update Clan</div>
              <button onClick={handleCloseClanModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--toa-muted)', padding: '0.25rem' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="toa-label-field">Clan Name</label>
                <input type="text" value={selectedClan?.clanName ?? ''} disabled className="toa-input" />
              </div>
              <div>
                <label className="toa-label-field">Current Login Message</label>
                <input type="text" value={currentLoginMessage} disabled className="toa-input" style={{ opacity: 0.6 }} />
              </div>
              <div>
                <label className="toa-label-field">Login Message <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(max 32 chars)</span></label>
                <input
                  type="text"
                  value={loginMessage}
                  onChange={(e) => setLoginMessage(e.target.value)}
                  maxLength={32}
                  placeholder="Enter new login message"
                  className="toa-input"
                />
              </div>
              <div>
                <label className="toa-label-field">Current Clan Note</label>
                <input type="text" value={currentNote} disabled className="toa-input" style={{ opacity: 0.6 }} />
              </div>
              <div>
                <label className="toa-label-field">Clan Note <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(max 50 chars)</span></label>
                <input
                  type="text"
                  value={clanNote}
                  onChange={(e) => setClanNote(e.target.value)}
                  maxLength={50}
                  placeholder="Enter new clan note"
                  className="toa-input"
                />
              </div>
              <div>
                <label className="toa-label-field">Clan Image <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(32×32 BMP)</span></label>
                <input
                  type="file"
                  accept=".bmp"
                  onChange={(e) => setClanImage(e.target.files?.[0] || null)}
                  className="toa-input"
                  style={{ cursor: 'pointer' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button onClick={handleCloseClanModal} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                <button onClick={handleUpdateClan} disabled={updating} className="toa-btn toa-btn-solid toa-btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                  {updating ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
