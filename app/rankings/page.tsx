'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { Trophy, Crosshair, Award, Crown } from 'lucide-react';
import { PageShell } from '@/app/components/PageShell';

interface RankingPlayer {
  Name: string;
  Level: number;
  RebornStage: number;
  JobCode: number;
  ClanID: number;
  ClanName: string | null;
  PVPKills?: number;
  PVPDeaths?: number;
  SODKills?: number;
  SODDeaths?: number;
  BRKills?: number;
  BRWins?: number;
  Wins?: number;
  IconID?: number;
  Members?: number;
  PVPWins?: number;
  SODWins?: number;
  Kills?: number;
  Deaths?: number;
  Streak?: number;
  Experience?: number;
  BellatraPoints?: number;
  Points?: number;
  BellatraDate?: string;
  Score?: number;
  Date?: string | number;
}

type RankingType = 'level' | 'pvp' | 'bellatra' | 'battle-royale';
type RankingSubType = 'personal' | 'clan';

export default function RankingsPage() {
  const [rankings, setRankings] = useState<RankingPlayer[]>([]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedType, setSelectedType] = useState<RankingType>('level');
  const [selectedSubType, setSelectedSubType] = useState<RankingSubType>('personal');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const rankingTypes = [
    { value: 'level' as RankingType, label: 'Level', icon: <Trophy className="w-4 h-4" /> },
    { value: 'pvp' as RankingType, label: 'PvP', icon: <Crosshair className="w-4 h-4" /> },
    { value: 'bellatra' as RankingType, label: 'Bellatra', icon: <Award className="w-4 h-4" /> },
    { value: 'battle-royale' as RankingType, label: 'Battle Royale', icon: <Crown className="w-4 h-4" /> },
  ];

  const classes = [
    { value: 'all', label: 'All Classes' },
    { value: '1', label: 'Fighter' },
    { value: '2', label: 'Mechanician' },
    { value: '3', label: 'Archer' },
    { value: '4', label: 'Pikeman' },
    { value: '5', label: 'Atalanta' },
    { value: '6', label: 'Knight' },
    { value: '7', label: 'Magician' },
    { value: '8', label: 'Priestess' },
    { value: '9', label: 'Assassin' },
    { value: '10', label: 'Shaman' },
  ];

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    try {
      let url = '';
      if (selectedType === 'level') {
        url = `/api/rankings/level?class=${selectedClass}&page=${page}&pageSize=50`;
      } else if (selectedType === 'pvp') {
        url = `/api/rankings/pvp?type=${selectedSubType}&page=${page}&pageSize=50`;
      } else if (selectedType === 'bellatra') {
        url = `/api/rankings/bellatra?type=${selectedSubType}&page=${page}&pageSize=50`;
      } else if (selectedType === 'battle-royale') {
        url = `/api/rankings/battle-royale?page=${page}&pageSize=50`;
      }

      const response = await fetch(url);
      const data = await response.json();
      if (data.error) {
        console.error('API error:', data.error);
        setRankings([]);
        setHasMore(false);
      } else {
        if (Array.isArray(data)) {
          setRankings(data);
          setHasMore(false);
        } else {
          setRankings(Array.isArray(data.items) ? data.items : []);
          setHasMore(Boolean(data.hasMore));
        }
      }
    } catch (error) {
      console.error('Error fetching rankings:', error);
      setRankings([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [selectedClass, selectedType, selectedSubType, page]);

  useEffect(() => {
    const id = setTimeout(() => { void fetchRankings(); }, 0);
    return () => clearTimeout(id);
  }, [fetchRankings]);

  const getClanIconUrl = (iconID: number) => {
    if (iconID === 0) return 'https://taleofasia.com/ClanImage/999999.bmp';
    if (iconID >= 1 && iconID <= 9) return `https://taleofasia.com/ClanImage/${100000 + iconID}.bmp`;
    if (iconID >= 10 && iconID <= 99) return `https://taleofasia.com/ClanImage/${10000 + iconID}.bmp`;
    if (iconID >= 100 && iconID <= 999) return `https://taleofasia.com/ClanImage/${1000 + iconID}.bmp`;
    return `https://taleofasia.com/ClanImage/${iconID}.bmp`;
  };

  const getOrdinalSuffix = (n: number) => {
    const lastDigit = n % 10;
    if (lastDigit === 1) return 'st';
    if (lastDigit === 2) return 'nd';
    if (lastDigit === 3) return 'rd';
    return 'th';
  };

  const getRankingTitle = () => {
    switch (selectedType) {
      case 'level': return 'Level Rankings';
      case 'pvp': return selectedSubType === 'personal' ? 'PvP Personal Rankings' : 'PvP Clan Rankings';
      case 'bellatra': return selectedSubType === 'personal' ? 'Bellatra Personal Rankings' : 'Bellatra Clan Rankings';
      case 'battle-royale': return 'Battle Royale Rankings';
    }
  };

  const getRankingDescription = () => {
    switch (selectedType) {
      case 'level': return 'Top 100 players by level and reborn stage';
      case 'pvp': return selectedSubType === 'personal' ? 'Top 100 players by PvP kills' : 'Top 100 clans by PvP wins';
      case 'bellatra': return selectedSubType === 'personal' ? 'Top 100 players by Bellatra kills' : 'Top 100 clans by Bellatra wins';
      case 'battle-royale': return 'Top 100 players by Battle Royale wins';
    }
  };

  const formatDate = (value: string | number | undefined) => {
    if (!value) return '-';
    if (typeof value === 'number') {
      const d = new Date(value * 1000);
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()} - ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    }
    // SQL datetime: 2026-05-25 13:41:05
    const sqlMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (sqlMatch) {
      const [, year, month, day, hours, minutes, seconds] = sqlMatch;
      return `${month}/${day}/${year} - ${hours}:${minutes}:${seconds}`;
    }
    // Already-formatted: 05/25/26 13:41:05
    const usMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{2,4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (usMatch) {
      const [, month, day, yearRaw, hours, minutes, seconds] = usMatch;
      const year = yearRaw.length === 2 ? '20' + yearRaw : yearRaw;
      return `${month}/${day}/${year} - ${hours}:${minutes}:${seconds}`;
    }
    return value;
  };

  const getTableColumns = () => {
    switch (selectedType) {
      case 'level':
        return [
          { key: 'Rank', label: 'Rank' },
          { key: 'Name', label: 'Character' },
          { key: 'Clan', label: 'Clan' },
          { key: 'Class', label: 'Class' },
          { key: 'Level', label: 'Level' },
          { key: 'RebornStage', label: 'Reborn' },
        ];
      case 'pvp':
        if (selectedSubType === 'personal') {
          return [
            { key: 'Rank', label: 'Rank' },
            { key: 'Name', label: 'Character' },
            { key: 'Clan', label: 'Clan' },
            { key: 'Class', label: 'Class' },
            { key: 'Level', label: 'Level' },
            { key: 'Experience', label: 'Experience' },
            { key: 'Kills', label: 'Kills' },
            { key: 'Deaths', label: 'Deaths' },
            { key: 'Streak', label: 'Streak' },
          ];
        } else {
          return [
            { key: 'Rank', label: 'Rank' },
            { key: 'ClanName', label: 'Clan' },
            { key: 'Experience', label: 'Experience' },
            { key: 'Kills', label: 'Kills' },
            { key: 'Deaths', label: 'Deaths' },
            { key: 'Streak', label: 'Streak' },
          ];
        }
      case 'bellatra':
        if (selectedSubType === 'personal') {
          return [
            { key: 'Rank', label: 'Rank' },
            { key: 'Name', label: 'Character' },
            { key: 'Clan', label: 'Clan' },
            { key: 'Class', label: 'Class' },
            { key: 'Level', label: 'Level' },
            { key: 'Score', label: 'Score' },
            { key: 'SODKills', label: 'Kills' },
            { key: 'Date', label: 'Record Date' },
          ];
        } else {
          return [
            { key: 'Rank', label: 'Rank' },
            { key: 'ClanName', label: 'Clan' },
            { key: 'BellatraPoints', label: 'Points' },
            { key: 'BellatraDate', label: 'Record Date' },
          ];
        }
      case 'battle-royale':
        return [
          { key: 'Rank', label: 'Rank' },
          { key: 'Clan', label: 'Clan' },
          { key: 'Name', label: 'Character' },
          { key: 'Class', label: 'Class' },
          { key: 'Kills', label: 'Kills' },
          { key: 'Deaths', label: 'Deaths' },
          { key: 'Wins', label: 'Wins' },
          { key: 'Points', label: 'Points' },
        ];
    }
  };

  const getCellValue = (player: RankingPlayer, key: string, index?: number) => {
    switch (key) {
      case 'Rank':
        return (
          <div className="flex items-center gap-1">
            <span className={`toa-rank-num ${rankClass(index!)}`}>{index! + 1}</span>
            <span className="toa-rank-ord">{getOrdinalSuffix(index! + 1)}</span>
          </div>
        );
      case 'Clan':
        if (selectedSubType === 'clan') {
          return (
            <div className="flex items-center gap-2">
              <Image
                src={getClanIconUrl(player.IconID || 0)}
                alt="Clan"
                width={32}
                height={32}
                className="w-8 h-8 rounded"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = 'https://taleofasia.com/ClanImage/999999.bmp';
                }}
              />
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <Image
              src={getClanIconUrl(player.IconID || player.ClanID || 0)}
              alt="Clan"
              width={32}
              height={32}
              className="w-8 h-8 rounded"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = 'https://taleofasia.com/ClanImage/999999.bmp';
              }}
            />
            <span>{player.ClanName || 'None'}</span>
          </div>
        );
      case 'ClanName':
        if (selectedSubType === 'clan') {
          return (
            <div className="flex items-center gap-2">
              <Image
                src={getClanIconUrl(player.IconID || 0)}
                alt="Clan"
                width={32}
                height={32}
                className="w-8 h-8 rounded"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = 'https://taleofasia.com/ClanImage/999999.bmp';
                }}
              />
              <span style={{ fontWeight: 500 }}>{player.ClanName || 'Unknown'}</span>
            </div>
          );
        }
        return <span>{player.ClanName || 'Unknown'}</span>;
      case 'Class':
        return (
          <Image
            src={`/images/CharClass/${player.JobCode}.png`}
            alt="Class"
            width={24}
            height={24}
            className="w-6 h-6"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/images/CharClass/0.png';
            }}
          />
        );
      case 'Name':
        return <span style={{ fontWeight: 500 }}>{player.Name}</span>;
      case 'Date':
        return <span>{formatDate(player.Date)}</span>;
      case 'BellatraDate':
        return <span>{formatDate(player.BellatraDate)}</span>;
      case 'RebornStage':
        if (!player.RebornStage || player.RebornStage === 0) {
          return <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Not yet</span>;
        }
        return <span>{player.RebornStage}</span>;
      default:
        const value = player[key as keyof RankingPlayer];
        return value !== undefined ? (
          <span>{typeof value === 'number' ? value.toLocaleString() : String(value)}</span>
        ) : (
          <span style={{ opacity: 0.35 }}>—</span>
        );
    }
  };

  const rankClass = (i: number) => i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';

  const RANK_MEDALS: Record<number, { bg: string; color: string; label: string }> = {
    0: { bg: 'rgba(212,185,122,0.12)', color: '#D4B97A', label: '1st' },
    1: { bg: 'rgba(180,180,180,0.10)', color: '#C0C0C0', label: '2nd' },
    2: { bg: 'rgba(176,140,100,0.10)', color: '#B08C64', label: '3rd' },
  };

  return (
    <PageShell label="Tale of Asia" title={getRankingTitle()} backHref="/" backLabel="Home">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* ── Type Tabs ── */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(184,155,94,0.15)' }}>
          {rankingTypes.map((type) => {
            const active = selectedType === type.value;
            return (
              <button
                key={type.value}
                onClick={() => {
                  setSelectedType(type.value);
                  if (type.value !== 'pvp' && type.value !== 'bellatra') setSelectedSubType('personal');
                  setPage(1);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.75rem 1.25rem',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: active ? '2px solid var(--toa-gold)' : '2px solid transparent',
                  color: active ? 'var(--toa-gold-bright)' : 'var(--toa-muted)',
                  fontFamily: 'var(--toa-font-display)', fontSize: '0.65rem',
                  letterSpacing: '0.15em', textTransform: 'uppercase',
                  fontWeight: active ? 700 : 400,
                  transition: 'color 0.2s, border-color 0.2s',
                  marginBottom: '-1px',
                }}
              >
                {type.icon}
                {type.label}
              </button>
            );
          })}
        </div>

        {/* ── Sub-type + Filter row ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {(selectedType === 'pvp' || selectedType === 'bellatra') && (
            <div style={{ display: 'flex', background: 'rgba(8,8,12,0.5)', border: '1px solid rgba(184,155,94,0.15)' }}>
              {(['personal', 'clan'] as RankingSubType[]).map((sub) => (
                <button
                  key={sub}
                  onClick={() => { setSelectedSubType(sub); setPage(1); }}
                  style={{
                    padding: '0.45rem 1rem',
                    background: selectedSubType === sub ? 'rgba(184,155,94,0.12)' : 'none',
                    border: 'none', cursor: 'pointer',
                    color: selectedSubType === sub ? 'var(--toa-gold-bright)' : 'var(--toa-muted)',
                    fontFamily: 'var(--toa-font-display)', fontSize: '0.6rem',
                    letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600,
                  }}
                >{sub}</button>
              ))}
            </div>
          )}
          {selectedType === 'level' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
              <span style={{ fontFamily: 'var(--toa-font-display)', fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--toa-muted)' }}>Class</span>
              <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setPage(1); }} className="toa-select" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                {classes.map((cls) => <option key={cls.value} value={cls.value}>{cls.label}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* ── Rankings Content ── */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '25vh', color: 'var(--toa-gold)', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.22em', fontSize: '0.8rem', textTransform: 'uppercase' }}>
            Loading…
          </div>
        ) : rankings.length > 0 ? (
          <div className="toa-seal-card" style={{ padding: 0, overflow: 'hidden' }}>

            {/* Card header */}
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(184,155,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ color: 'var(--toa-gold)', opacity: 0.7 }}>
                  {rankingTypes.find(t => t.value === selectedType)?.icon}
                </span>
                <span style={{ fontFamily: 'var(--toa-font-display)', fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--toa-muted)' }}>
                  {getRankingDescription()}
                </span>
              </div>
              <span style={{ fontFamily: 'var(--toa-font-display)', fontSize: '0.6rem', letterSpacing: '0.12em', color: 'var(--toa-muted)', opacity: 0.6 }}>
                {rankings.length} entries
              </span>
            </div>

            {/* Desktop Table */}
            {!isMobile && (
            <div style={{ overflowX: 'auto' }}>
              <table className="toa-table">
                <thead>
                  <tr>
                    {getTableColumns().map((col) => <th key={col.key}>{col.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((player, index) => {
                    const medal = RANK_MEDALS[index];
                    return (
                      <tr key={player.Name || player.ClanName || index}
                        style={medal ? { background: medal.bg, borderLeft: `2px solid ${medal.color}` } : { borderLeft: '2px solid transparent' }}
                      >
                        {getTableColumns().map((col) => (
                          <td key={col.key}>{getCellValue(player, col.key, index)}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}

            {/* Mobile Cards */}
            {isMobile && (
              <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {rankings.map((player, index) => {
                const medal = RANK_MEDALS[index];
                return (
                  <div key={player.Name || player.ClanName || index}
                    style={{
                      padding: '0.875rem 1rem',
                      background: medal ? medal.bg : 'rgba(28,25,37,0.4)',
                      border: `1px solid ${medal ? medal.color + '44' : 'rgba(184,155,94,0.08)'}`,
                      borderLeft: `3px solid ${medal ? medal.color : 'rgba(184,155,94,0.15)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{
                          fontFamily: 'var(--toa-font-display)', fontWeight: 700,
                          fontSize: '1rem', minWidth: '2rem',
                          color: medal ? medal.color : 'var(--toa-muted)',
                        }}>#{index + 1}</span>
                        {selectedSubType !== 'clan' && (
                          <Image src={`/images/CharClass/${player.JobCode}.png`} alt="Class" width={26} height={26}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/CharClass/0.png'; }} />
                        )}
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: medal ? medal.color : 'var(--toa-bone)' }}>
                          {player.Name || player.ClanName}
                        </span>
                      </div>
                      {player.ClanID > 0 && (
                        <Image src={getClanIconUrl(player.IconID || player.ClanID || 0)} alt="Clan" width={26} height={26}
                          className="rounded"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://taleofasia.com/ClanImage/999999.bmp'; }} />
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {selectedSubType !== 'clan' && player.Level !== undefined && <p className="toa-rank-card-stat">Lv <span>{player.Level}</span></p>}
                      {selectedSubType !== 'clan' && player.ClanName && <p className="toa-rank-card-stat">Clan <span>{player.ClanName}</span></p>}
                      {selectedType === 'level' && player.RebornStage !== undefined && <p className="toa-rank-card-stat">Reborn <span>{(!player.RebornStage || player.RebornStage === 0) ? 'Not yet' : player.RebornStage}</span></p>}
                      {(selectedType === 'pvp' || selectedType === 'battle-royale') && player.Experience !== undefined && <p className="toa-rank-card-stat">EXP <span>{player.Experience.toLocaleString()}</span></p>}
                      {(selectedType === 'pvp' || selectedType === 'battle-royale') && <p className="toa-rank-card-stat">Kills <span>{(player.Kills ?? player.PVPKills ?? 0).toLocaleString()}</span></p>}
                      {(selectedType === 'pvp' || selectedType === 'battle-royale') && <p className="toa-rank-card-stat">Deaths <span>{(player.Deaths ?? player.PVPDeaths ?? 0).toLocaleString()}</span></p>}
                      {selectedType === 'pvp' && player.Streak !== undefined && <p className="toa-rank-card-stat">Streak <span>{player.Streak.toLocaleString()}</span></p>}
                      {selectedType === 'battle-royale' && <p className="toa-rank-card-stat">Wins <span>{(player.Wins ?? player.BRWins ?? 0).toLocaleString()}</span></p>}
                      {selectedType === 'battle-royale' && player.Points !== undefined && <p className="toa-rank-card-stat">Points <span>{player.Points.toLocaleString()}</span></p>}
                      {selectedType === 'bellatra' && player.Score !== undefined && <p className="toa-rank-card-stat">Score <span>{player.Score.toLocaleString()}</span></p>}
                      {selectedType === 'bellatra' && player.SODKills !== undefined && <p className="toa-rank-card-stat">Kills <span>{player.SODKills.toLocaleString()}</span></p>}
                      {selectedType === 'bellatra' && player.BellatraPoints !== undefined && <p className="toa-rank-card-stat">Points <span>{player.BellatraPoints.toLocaleString()}</span></p>}
                    </div>
                  </div>
                );
              })}
            </div>
            )}

          </div>
        ) : (
          <div className="toa-seal-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--toa-bone)', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.15em', textTransform: 'uppercase', fontSize: '0.8rem' }}>
            No rankings available
          </div>
        )}

        {/* ── Pagination ── */}
        {(page > 1 || hasMore) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="toa-btn toa-btn-ghost toa-btn-sm"
              style={{ opacity: page === 1 || loading ? 0.4 : 1 }}
            >← Prev</button>
            <span style={{ fontFamily: 'var(--toa-font-display)', fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--toa-muted)', textTransform: 'uppercase' }}>Page {page}</span>
            <button
              onClick={() => setPage((p) => (hasMore ? p + 1 : p))}
              disabled={!hasMore || loading}
              className="toa-btn toa-btn-ghost toa-btn-sm"
              style={{ opacity: !hasMore || loading ? 0.4 : 1 }}
            >Next →</button>
          </div>
        )}

      </div>
    </PageShell>
  );
}
