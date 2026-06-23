'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { PageShell } from '@/app/components/PageShell';
import { Search, X } from 'lucide-react';

interface User {
  AccountName: string;
  Email: string;
  Coins: number;
  Active: string;
  BanStatus: string | number;
  RegisDay?: string;
  TimePoints?: number;
  GameMasterType?: number;
  GameMasterLevel?: number;
  Flag?: number;
}

interface CharacterResult {
  Name: string;
  JobCode: number;
  Level: number;
  Experience?: number;
  AccountName: string;
  RebornStage: number;
  RebornCount: number;
  BanStatus: string | number;
  Email: string;
  Coins: number;
  IsOnline?: boolean;
}

type SearchType = 'account' | 'character';

// Class and clan helpers
const classDetails: Record<number, { name: string; image: string }> = {
  1: { name: 'Fighter', image: 'https://taleofasia.com/images/CharClass/1.png' },
  2: { name: 'Mechanician', image: 'https://taleofasia.com/images/CharClass/2.png' },
  3: { name: 'Archer', image: 'https://taleofasia.com/images/CharClass/3.png' },
  4: { name: 'Pikeman', image: 'https://taleofasia.com/images/CharClass/4.png' },
  5: { name: 'Atalanta', image: 'https://taleofasia.com/images/CharClass/5.png' },
  6: { name: 'Knight', image: 'https://taleofasia.com/images/CharClass/6.png' },
  7: { name: 'Magician', image: 'https://taleofasia.com/images/CharClass/7.png' },
  8: { name: 'Priestess', image: 'https://taleofasia.com/images/CharClass/8.png' },
  9: { name: 'Assassin', image: 'https://taleofasia.com/images/CharClass/9.png' },
  10: { name: 'Shaman', image: 'https://taleofasia.com/images/CharClass/10.png' },
};
const getClanIconUrl = (clanID: number) => {
  if (!clanID || clanID <= 0) return 'https://taleofasia.com/ClanImage/999999.bmp';
  return `https://taleofasia.com/ClanImage/${1000000 + clanID}.bmp`;
};

export default function AdminUsersPage() {
  const { status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('account');
  const [searching, setSearching] = useState(false);
  const [accountResults, setAccountResults] = useState<User[]>([]);
  const [characterResults, setCharacterResults] = useState<CharacterResult[]>([]);
  const [baseCharacterResults, setBaseCharacterResults] = useState<CharacterResult[]>([]);
  const [amountByAccount, setAmountByAccount] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [accountSortField, setAccountSortField] = useState<'name' | 'coins' | 'email' | 'regis' | 'timepoints'>('name');
  const [charSortField, setCharSortField] = useState<'name' | 'level' | 'experience' | 'reborn'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [charClassFilter, setCharClassFilter] = useState<number>(0);
  const [confirmState, setConfirmState] = useState<null | { kind: 'credit' | 'ban' | 'purge' | 'verify'; account?: string; payload?: any }>(null);
  const [expandedChars, setExpandedChars] = useState<Record<string, { loading: boolean; data: any | null; clan?: any }>>({});
  const [coinModalOpen, setCoinModalOpen] = useState(false);
  const [coinModalAccount, setCoinModalAccount] = useState<string | null>(null);
  const [coinModalAmount, setCoinModalAmount] = useState<string>('');
  const [coinModalReason, setCoinModalReason] = useState<string>('');
  const [coinModalError, setCoinModalError] = useState<string>('');
  const [banModalReason, setBanModalReason] = useState<string>('');
  const [banModalError, setBanModalError] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [purgeDays, setPurgeDays] = useState<number>(30);

  const checkAdminAndFetchUsers = useCallback(async () => {
    try {
      const adminCheck = await fetch('/api/admin/check');
      const adminData = await adminCheck.json();
      
      setIsSuperAdmin(!!adminData.isSuperAdmin);
      setIsAdmin(!!adminData.isAdmin);
      if (!adminData.isAdmin) {
        router.push('/dashboard');
        return;
      }
      // Do NOT prefetch full users list; keep UI clean until searched
      setLoading(false);
    } catch (error) {
      console.error('Error checking admin status:', error);
      router.push('/dashboard');
    }
  }, [router]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const id = setTimeout(() => { void checkAdminAndFetchUsers(); }, 0);
      return () => clearTimeout(id);
    }
  }, [status, router, checkAdminAndFetchUsers]);

  const resetAll = () => {
    setSearchTerm('');
    setSuggestions([]);
    setShowSuggestions(false);
    setAccountResults([]);
    setCharacterResults([]);
    setBaseCharacterResults([]);
    setAccountSortField('name');
    setCharSortField('name');
    setSortDir('asc');
    setCharClassFilter(0);
    setPage(1);
    setPageSize(10);
  };

  // removed unused fetchUsers

  const filteredUsers = users.filter(user =>
    user.AccountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.Email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Remote search (accounts or characters)
  const runSearch = async (q: string, type: SearchType) => {
    const query = q.trim();
    if (!query) {
      setAccountResults([]);
      setCharacterResults([]);
      setBaseCharacterResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/users/search?type=${encodeURIComponent(type)}&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.type === 'account') {
        setAccountResults(sortAccounts((data.results || []) as User[], accountSortField, sortDir));
        setCharacterResults([]);
        setBaseCharacterResults([]);
        setPage(1);
      } else if (data.type === 'character') {
        const results = (data.results || []) as CharacterResult[];
        setBaseCharacterResults(results);
        const filtered = charClassFilter > 0 ? results.filter((r) => r.JobCode === charClassFilter) : results;
        setCharacterResults(sortCharacters(filtered, charSortField, sortDir));
        setAccountResults([]);
        setPage(1);
      }
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setSearching(false);
    }
  };

  const onCredit = async (account: string, sign: 1 | -1) => {
    const raw = amountByAccount[account] ?? '';
    const val = Math.floor(Number(raw));
    if (!Number.isFinite(val) || val <= 0) return alert('Enter a positive integer amount');
    const delta = val * sign;
    setConfirmState({ kind: 'credit', account, payload: { delta } });
  };

  const onBanToggle = async (account: string, targetBan: boolean) => {
    setBanModalReason('');
    setBanModalError('');
    setConfirmState({ kind: 'ban', account, payload: { action: targetBan ? 'ban' : 'unban' } });
  };

  const executeConfirm = async () => {
    const c = confirmState;
    if (!c) return;
    try {
      if (c.kind === 'credit') {
        const { delta } = c.payload as { delta: number };
        const res = await fetch('/api/admin/users/credit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: c.account, delta, reason: coinModalReason }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed');
        setAccountResults((prev) => prev.map(u => u.AccountName === c.account ? { ...u, Coins: data.balance ?? (u.Coins + delta) } : u));
        setUsers((prev) => prev.map(u => u.AccountName === c.account ? { ...u, Coins: data.balance ?? (u.Coins + delta) } : u));
      } else if (c.kind === 'ban') {
        const { action } = c.payload as { action: 'ban' | 'unban' };
        const res = await fetch('/api/admin/users/ban', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: c.account, action, reason: banModalReason }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed');
        setAccountResults((prev) => prev.map(u => u.AccountName === c.account ? { ...u, BanStatus: data.BanStatus } : u));
        setUsers((prev) => prev.map(u => u.AccountName === c.account ? { ...u, BanStatus: data.BanStatus } : u));
      } else if (c.kind === 'verify') {
        const res = await fetch('/api/admin/users/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: c.account }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed');
        setAccountResults((prev) => prev.map(u => u.AccountName === c.account ? { ...u, Flag: data.Flag ?? 98 } : u));
        setUsers((prev) => prev.map(u => u.AccountName === c.account ? { ...u, Flag: data.Flag ?? 98 } : u));
      } else if (c.kind === 'purge') {
        const { days } = c.payload as { days: number };
        const res = await fetch('/api/admin/users/delete-unverified', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ days }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed');
      }
    } catch (e) {
      console.error('Admin action failed:', e);
    } finally {
      setConfirmState(null);
    }
  };

  const sortAccounts = (arr: User[], field: 'name' | 'coins' | 'email' | 'regis' | 'timepoints', dir: 'asc' | 'desc') => {
    const copy = [...arr];
    copy.sort((a, b) => {
      let av: string | number = a.AccountName;
      let bv: string | number = b.AccountName;
      if (field === 'coins') { av = a.Coins; bv = b.Coins; }
      if (field === 'email') { av = a.Email || ''; bv = b.Email || ''; }
      if (field === 'timepoints') { av = Number(a.TimePoints || 0); bv = Number(b.TimePoints || 0); }
      if (field === 'regis') { av = new Date(a.RegisDay || 0).getTime(); bv = new Date(b.RegisDay || 0).getTime(); }
      if (typeof av === 'number' && typeof bv === 'number') return dir === 'asc' ? av - bv : bv - av;
      return dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return copy;
  };

  const sortCharacters = (arr: CharacterResult[], field: 'name' | 'level' | 'experience' | 'reborn', dir: 'asc' | 'desc') => {
    const copy = [...arr];
    copy.sort((a, b) => {
      let av: string | number = a.Name;
      let bv: string | number = b.Name;
      if (field === 'level') { av = a.Level; bv = b.Level; }
      if (field === 'experience') { av = (a as any).Experience || 0; bv = (b as any).Experience || 0; }
      if (field === 'reborn') { av = a.RebornStage; bv = b.RebornStage; }
      if (typeof av === 'number' && typeof bv === 'number') return dir === 'asc' ? av - bv : bv - av;
      return dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return copy;
  };

  // Suggestions with debounce
  useEffect(() => {
    const id = setTimeout(async () => {
      const q = searchTerm.trim();
      if (!q) { setSuggestions([]); return; }
      try {
        const res = await fetch(`/api/admin/users/suggest?type=${encodeURIComponent(searchType)}&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      } catch {
        setSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(id);
  }, [searchTerm, searchType]);

  const showBanned = async () => {
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/users/search?type=account&banned=1`);
      const data = await res.json();
      setAccountResults(sortAccounts((data.results || []) as User[], accountSortField, sortDir));
      setCharacterResults([]);
      setPage(1);
    } catch (e) {
      console.error('Show banned error:', e);
    } finally {
      setSearching(false);
    }
  };

  const showGameMasters = async () => {
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/users/search?type=account&gm=1`);
      const data = await res.json();
      setAccountResults(sortAccounts((data.results || []) as User[], accountSortField, sortDir));
      setCharacterResults([]);
      setPage(1);
    } catch (e) {
      console.error('Show GM error:', e);
    } finally {
      setSearching(false);
    }
  };

  const showPending = async () => {
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/users/search?type=account&pending=1`);
      const data = await res.json();
      setAccountResults(sortAccounts((data.results || []) as User[], accountSortField, sortDir));
      setCharacterResults([]);
      setPage(1);
    } catch (e) {
      console.error('Show pending error:', e);
    } finally {
      setSearching(false);
    }
  };

  const toggleExpandChar = async (name: string) => {
    const current = expandedChars[name];
    if (current && (current.data || current.loading)) {
      const next: Record<string, { loading: boolean; data: any | null; clan?: any }> = { ...expandedChars };
      delete next[name];
      setExpandedChars(next);
      return;
    }
    setExpandedChars((prev) => ({ ...prev, [name]: { loading: true, data: null } }));
    try {
      const res = await fetch(`/api/admin/users/character-data?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      setExpandedChars((prev) => ({ ...prev, [name]: { loading: false, data: data.data || null, clan: data.clan || null } }));
    } catch (e) {
      console.error('Character data error:', e);
      setExpandedChars((prev) => ({ ...prev, [name]: { loading: false, data: null } }));
    }
  };

  if (status === 'loading' || loading) {
    return (
      <PageShell label="Admin" title="User Management" backHref="/admin" backLabel="Admin">
        <div className="toa-loading">Loading…</div>
      </PageShell>
    );
  }

  return (
    <PageShell label="Admin" title="User Management" backHref="/admin" backLabel="Admin">
        {/* Search */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(searchTerm, searchType); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder={`Search by ${searchType === 'account' ? 'account name' : 'character name'}...`}
              className="toa-input"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="toa-panel" style={{ marginTop: '0.25rem', padding: '0.375rem', maxHeight: '15rem', overflowY: 'auto', position: 'absolute', width: '100%', zIndex: 10 }}>
                {suggestions.map((s) => (
                  <div key={s} onMouseDown={() => { setSearchTerm(s); setShowSuggestions(false); runSearch(s, searchType); }} style={{ padding: '0.375rem 0.625rem', cursor: 'pointer', color: 'var(--toa-smoke)', fontSize: '0.875rem', borderRadius: '3px' }}>{s}</div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as SearchType)}
              className="toa-select"
            >
              <option value="account">Accounts</option>
              <option value="character">Characters</option>
            </select>
            <button onClick={() => runSearch(searchTerm, searchType)} className="toa-btn toa-btn-solid toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              {searching ? 'Searching…' : <><Search size={13} />&nbsp;Search</>}
            </button>
            <button onClick={resetAll} className="toa-btn toa-btn-ghost toa-btn-sm">Reset</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={showBanned} className="toa-btn toa-btn-ghost toa-btn-sm">Banned Accounts</button>
          <button onClick={showGameMasters} className="toa-btn toa-btn-ghost toa-btn-sm">Game Masters</button>
          <button onClick={showPending} className="toa-btn toa-btn-ghost toa-btn-sm">Pending Verification</button>
        </div>

        {isSuperAdmin && (
        <div className="toa-panel" style={{ padding: '1rem', borderColor: 'rgba(220,38,38,0.3)' }}>
          <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.75rem', color: 'var(--toa-danger)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Danger Zone</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--toa-smoke)', fontSize: '0.875rem' }}>Delete accounts with Flag &lt; 98 and age over</span>
            <select value={String(purgeDays)} onChange={(e) => setPurgeDays(Number(e.target.value))} className="toa-select">
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
            <button onClick={() => setConfirmState({ kind: 'purge', payload: { days: purgeDays } })} className="toa-btn toa-btn-sm" style={{ background: 'rgba(180,30,30,0.35)', border: '1px solid rgba(220,38,38,0.4)', color: 'var(--toa-danger)' }}>Delete Unverified Accounts</button>
          </div>
        </div>
        )}

        {(accountResults.length > 0 || characterResults.length > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sort by:</div>
            {accountResults.length > 0 && (
              <select
                value={accountSortField}
                onChange={(e) => {
                  const val = e.target.value as 'name' | 'coins' | 'email' | 'regis' | 'timepoints';
                  setAccountSortField(val);
                  setAccountResults(sortAccounts(accountResults, val, sortDir));
                }}
                className="toa-select"
              >
                <option value="name">Account Name</option>
                <option value="coins">Credits</option>
                <option value="timepoints">Time Points</option>
                <option value="email">Email</option>
                <option value="regis">RegisDay</option>
              </select>
            )}
            {characterResults.length > 0 && (
              <select
                value={charSortField}
                onChange={(e) => {
                  const val = e.target.value as 'name' | 'level' | 'experience' | 'reborn';
                  setCharSortField(val);
                  const source = charClassFilter > 0 ? baseCharacterResults.filter((r) => r.JobCode === charClassFilter) : baseCharacterResults;
                  setCharacterResults(sortCharacters(source, val, sortDir));
                }}
                className="toa-select"
              >
                <option value="name">Name</option>
                <option value="level">Level</option>
                <option value="experience">Experience</option>
                <option value="reborn">Reborn Stage</option>
              </select>
            )}
            <select
              value={sortDir}
              onChange={(e) => {
                const d = e.target.value as 'asc' | 'desc';
                setSortDir(d);
                if (accountResults.length) setAccountResults(sortAccounts(accountResults, accountSortField, d));
                if (characterResults.length) {
                  const source = charClassFilter > 0 ? baseCharacterResults.filter((r) => r.JobCode === charClassFilter) : baseCharacterResults;
                  setCharacterResults(sortCharacters(source, charSortField, d));
                }
              }}
              className="toa-select"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <span style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>Per page:</span>
              <select
                value={String(pageSize)}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="toa-select"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
              </select>
              {(() => {
                const activeIsAccount = accountResults.length > 0;
                const total = activeIsAccount ? accountResults.length : characterResults.length;
                const totalPages = Math.max(1, Math.ceil(total / pageSize));
                return (
                  <>
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className={"toa-btn toa-btn-ghost toa-btn-sm"}
                    >
                      Prev
                    </button>
                    <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>Page {page} of {totalPages}</div>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className={"toa-btn toa-btn-ghost toa-btn-sm"}
                    >
                      Next
                    </button>
                  </>
                );
              })()}
            </div>

            {/* Character class quick filter */}
            {characterResults.length > 0 && (
              <>
                <span style={{ fontSize: '0.8rem', color: 'var(--toa-muted)', marginLeft: '0.5rem' }}>Class:</span>
                <select
                  value={String(charClassFilter)}
                  onChange={(e) => {
                    const cls = Number(e.target.value);
                    setCharClassFilter(cls);
                    const source = cls > 0 ? baseCharacterResults.filter((r) => r.JobCode === cls) : baseCharacterResults;
                    setCharacterResults(sortCharacters(source, charSortField, sortDir));
                    setPage(1);
                  }}
                  className="toa-select"
                >
                  <option value="0">All</option>
                  <option value="1">Fighter</option>
                  <option value="2">Mechanician</option>
                  <option value="3">Archer</option>
                  <option value="4">Pikeman</option>
                  <option value="5">Atalanta</option>
                  <option value="6">Knight</option>
                  <option value="7">Magician</option>
                  <option value="8">Priestess</option>
                  <option value="9">Assassin</option>
                  <option value="10">Shaman</option>
                </select>
              </>
            )}
          </div>
        )}

        {/* Search Results */}
        {(accountResults.length > 0 || characterResults.length > 0) && (
          <div className="toa-seal-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--toa-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>Search Results</div>

            {/* Account results */}
            {accountResults.length > 0 && (
              <div className="space-y-3">
                {(() => {
                  const start = (page - 1) * pageSize;
                  const end = start + pageSize;
                  const items = accountResults.slice(start, end);
                  return items.map((u) => {
                  const banned = String(u.BanStatus) === '1';
                  return (
                    <div key={u.AccountName} className="toa-panel" style={{ padding: '0.75rem 1rem' }}>
                      <div className="min-w-0">
                        <div style={{ fontSize: '0.7rem', color: 'var(--toa-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Account Name</div>
                        <div style={{ fontWeight: 600, color: 'var(--toa-bone)', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                          <span>{u.AccountName}</span>
                          {(() => {
                            const gmType = Number(u.GameMasterType || 0);
                            const gmLevel = Number(u.GameMasterLevel || 0);
                            if (gmType === 1 && gmLevel >= 3) {
                              return <span className="toa-badge toa-badge-info">Admin</span>;
                            }
                            if (gmType === 1 && gmLevel < 3) {
                              return <span className="toa-badge toa-badge-gold">Game Master</span>;
                            }
                            return null;
                          })()}
                          {banned && <span className="toa-badge toa-badge-danger">Banned</span>}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>{u.Email}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--toa-smoke)' }}>Reg: {u.RegisDay ? new Date(u.RegisDay).toLocaleDateString() : '—'} &nbsp;·&nbsp; Credits: {u.Coins.toLocaleString()} &nbsp;·&nbsp; TP: {Number(u.TimePoints || 0).toLocaleString()}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isSuperAdmin && (
                          <button
                            onClick={() => { setCoinModalOpen(true); setCoinModalAccount(u.AccountName); setCoinModalAmount(''); setCoinModalReason(''); setCoinModalError(''); }}
                            className="toa-btn toa-btn-ghost toa-btn-sm"
                          >
                            Manage Coins
                          </button>
                        )}
                        <div className="hidden md:block" />
                        {(isAdmin || isSuperAdmin) && u.Flag === 64 && (
                          <button
                            onClick={() => setConfirmState({ kind: 'verify', account: u.AccountName })}
                            className="toa-btn toa-btn-ghost toa-btn-sm"
                          >
                            Verify
                          </button>
                        )}
                        {(isAdmin || isSuperAdmin) && (
                          <div className="hidden md:block" />
                        )}
                        {(isSuperAdmin || isAdmin) && (
                          <button
                            onClick={() => onBanToggle(u.AccountName, !banned)}
                            className="toa-btn toa-btn-ghost toa-btn-sm"
                          >
                            {banned ? 'Unban' : 'Ban'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
                })()}
              </div>
            )}

            {/* Character results */}
            {characterResults.length > 0 && (
              <div className="space-y-3">
                {(() => {
                  const start = (page - 1) * pageSize;
                  const end = start + pageSize;
                  const items = characterResults.slice(start, end);
                  return items.map((c) => {
                  const banned = String(c.BanStatus) === '1';
                  return (
                    <div key={`${c.Name}:${c.AccountName}`} className="toa-panel" style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleExpandChar(c.Name)}>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="min-w-0">
                          <div style={{ fontWeight: 600, color: 'var(--toa-bone)', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600 }}>{c.Name}</span>
                            <span style={{ color: 'var(--toa-muted)', fontSize: '0.8rem' }}>Lv {c.Level}</span>
                            <span className={c.IsOnline ? 'toa-badge toa-badge-success' : 'toa-badge toa-badge-danger'}>{c.IsOnline ? 'Online' : 'Offline'}</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--toa-smoke)' }}>Reborn Stage <span style={{ fontWeight: 600 }}>{c.RebornStage}</span> · Account: <span style={{ fontWeight: 600 }}>{c.AccountName}</span></div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>{c.Email} · Credits: {c.Coins.toLocaleString()} {banned && <span className="toa-badge toa-badge-danger" style={{ marginLeft: '0.5rem' }}>BANNED</span>}</div>
                        </div>
                      </div>
                      {(expandedChars[c.Name]?.loading || expandedChars[c.Name]?.data) && (
                        <div className="mt-4 space-y-3">
                          {expandedChars[c.Name]?.loading && <div className="text-slate-400">Loading details...</div>}
                          {expandedChars[c.Name]?.data && (
                            <div className="space-y-3">
                              <div className="text-slate-400 text-sm">CharacterID: <span className="text-slate-200 font-semibold">{expandedChars[c.Name]?.data?.CharacterID}</span></div>
                              <div className="grid md:grid-cols-2 gap-3">
                                <div className="toa-panel">
                                  <Image
                                    src={getClanIconUrl(Number(expandedChars[c.Name]?.data?.ClanID || 0))}
                                    alt="Clan"
                                    width={32}
                                    height={32}
                                    className="w-8 h-8 rounded border border-slate-600"
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://taleofasia.com/ClanImage/999999.bmp'; }}
                                  />
                                  <div>
                                    <div className="text-slate-400 text-xs">Clan</div>
                                    <div className="text-slate-200 font-semibold">{expandedChars[c.Name]?.clan?.ClanName || (Number(expandedChars[c.Name]?.data?.ClanID || 0) > 0 ? 'Unknown' : 'No Clan')}</div>
                                  </div>
                                </div>
                                <div className="toa-panel">
                                  <Image
                                    src={classDetails[Number(expandedChars[c.Name]?.data?.Class)]?.image || 'https://taleofasia.com/images/CharClass/unknown.png'}
                                    alt="Class"
                                    width={32}
                                    height={32}
                                    className="w-8 h-8 rounded border border-slate-600 bg-[var(--color-obsidian)] p-1"
                                  />
                                  <div>
                                    <div className="text-slate-400 text-xs">Class</div>
                                    <div className="text-slate-200 font-semibold">{classDetails[Number(expandedChars[c.Name]?.data?.Class)]?.name || `Class ${expandedChars[c.Name]?.data?.Class}`}</div>
                                  </div>
                                </div>
                              </div>
                              <div className="grid md:grid-cols-3 gap-3 text-sm text-slate-300">
                                {Object.entries(expandedChars[c.Name]?.data)
                                  .filter(([k]) => !['CharacterID', 'ClanID', 'Class', 'CharacterName'].includes(String(k)))
                                  .map(([k, v]) => (
                                    <div key={String(k)} className="toa-panel"><span className="text-slate-400">{String(k)}</span>: <span className="text-slate-200">{String(v)}</span></div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                });
                })()}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              {(() => {
                const activeIsAccount = accountResults.length > 0;
                const total = activeIsAccount ? accountResults.length : characterResults.length;
                const totalPages = Math.max(1, Math.ceil(total / pageSize));
                return (
                  <>
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className={"toa-btn toa-btn-ghost toa-btn-sm"}
                    >
                      Prev
                    </button>
                    <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>Page {page} of {totalPages}</div>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className={"toa-btn toa-btn-ghost toa-btn-sm"}
                    >
                      Next
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Empty state when no search is active */}
        {accountResults.length === 0 && characterResults.length === 0 && (
          <div className="toa-panel" style={{ padding: '2.5rem', textAlign: 'center' }}>
            <Search size={32} style={{ margin: '0 auto 0.75rem', color: 'var(--toa-muted)' }} />
            <div style={{ fontWeight: 600, color: 'var(--toa-bone)', fontSize: '1rem', marginBottom: '0.25rem' }}>Search accounts or characters</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--toa-muted)' }}>Use the bar above to find a user by AccountName or Character name to manage credits and bans.</div>
          </div>
        )}

        {/* Users Table (fallback / browse) - hidden unless preloaded list exists */}
        {filteredUsers.length > 0 && (
          <div className="toa-seal-card overflow-hidden" style={{ padding: 0 }}>
            <table className="toa-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Credits</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.AccountName}>
                    <td>{user.AccountName}</td>
                    <td>{user.Email}</td>
                    <td>{user.Coins.toLocaleString()}</td>
                    <td>
                      <span className={user.Active === '1' ? 'toa-badge toa-badge-success' : 'toa-badge toa-badge-danger'}>{user.Active === '1' ? 'Active' : 'Inactive'}</span>
                      {String(user.BanStatus) === '1' && <span className="toa-badge toa-badge-danger" style={{ marginLeft: '0.375rem' }}>Banned</span>}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          value={amountByAccount[user.AccountName] ?? ''}
                          onChange={(e) => setAmountByAccount((prev) => ({ ...prev, [user.AccountName]: e.target.value }))}
                          placeholder="Amount"
                          className="toa-input"
                        />
                        <button onClick={() => onCredit(user.AccountName, 1)} className="toa-btn toa-btn-ghost toa-btn-xs">+ Add</button>
                        <button onClick={() => onCredit(user.AccountName, -1)} className="toa-btn toa-btn-ghost toa-btn-xs">- Sub</button>
                        <button onClick={() => onBanToggle(user.AccountName, String(user.BanStatus) !== '1')} className="toa-btn toa-btn-ghost toa-btn-xs">{String(user.BanStatus) === '1' ? 'Unban' : 'Ban'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {isSuperAdmin && coinModalOpen && coinModalAccount && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="toa-seal-card" style={{ maxWidth: '28rem', width: '95%', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--toa-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Manage Coins</div>
              <button onClick={() => setCoinModalOpen(false)} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ padding: '0.25rem' }}><X size={14} /></button>
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--toa-smoke)', marginBottom: '1rem' }}>Account: <span style={{ fontWeight: 600, color: 'var(--toa-bone)' }}>{coinModalAccount}</span></div>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={coinModalAmount}
                onChange={(e) => setCoinModalAmount(e.target.value)}
                placeholder="Amount"
                className="toa-input"
              />
            </div>
            <div className="mb-4">
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--toa-muted)', marginBottom: '0.25rem' }}>Reason (5-200 chars)</label>
              <input
                type="text"
                value={coinModalReason}
                onChange={(e) => setCoinModalReason(e.target.value.slice(0, 200))}
                placeholder="e.g. Event reward adjustment"
                className="toa-input"
              />
              {coinModalError && <div className="text-red-400 text-sm mt-1">{coinModalError}</div>}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCoinModalOpen(false)} className="toa-btn toa-btn-ghost toa-btn-sm">Close</button>
              <button
                onClick={() => {
                  const n = Math.floor(Number(coinModalAmount));
                  if (!Number.isFinite(n) || n <= 0) return;
                  if (!coinModalReason || coinModalReason.trim().length < 5) { setCoinModalError('Reason must be at least 5 characters'); return; }
                  setCoinModalError('');
                  setCoinModalOpen(false);
                  setConfirmState({ kind: 'credit', account: coinModalAccount!, payload: { delta: +n } });
                }}
                className="toa-btn toa-btn-ghost toa-btn-sm"
              >
                Add
              </button>
              <button
                onClick={() => {
                  const n = Math.floor(Number(coinModalAmount));
                  if (!Number.isFinite(n) || n <= 0) return;
                  if (!coinModalReason || coinModalReason.trim().length < 5) { setCoinModalError('Reason must be at least 5 characters'); return; }
                  setCoinModalError('');
                  setCoinModalOpen(false);
                  setConfirmState({ kind: 'credit', account: coinModalAccount!, payload: { delta: -n } });
                }}
                className="toa-btn toa-btn-ghost toa-btn-sm"
              >
                Sub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban/Unban reason modal */}
      {confirmState && confirmState.kind === 'ban' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="toa-seal-card" style={{ maxWidth: '28rem', width: '95%', padding: '1.5rem' }}>
            <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--toa-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>{confirmState.payload?.action === 'ban' ? 'Ban Account' : 'Unban Account'}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--toa-smoke)', marginBottom: '1rem' }}>Account: <span style={{ fontWeight: 600, color: 'var(--toa-bone)' }}>{confirmState.account}</span></div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--toa-muted)', marginBottom: '0.25rem' }}>Reason (5-200 chars)</label>
              <input
                type="text"
                value={banModalReason}
                onChange={(e) => { setBanModalReason(e.target.value.slice(0, 200)); if (banModalError) setBanModalError(''); }}
                placeholder="e.g. Repeated ToS violations"
                className="toa-input"
              />
              {banModalError && <div className="text-red-400 text-sm mb-2">{banModalError}</div>}
              <div className="flex justify-end gap-3">
                <button onClick={() => setConfirmState(null)} className="toa-btn toa-btn-ghost toa-btn-sm">Cancel</button>
                <button
                  onClick={() => {
                    const r = banModalReason.trim();
                    if (r.length < 5) { setBanModalError('Reason must be at least 5 characters'); return; }
                    executeConfirm();
                  }}
                  className="toa-btn toa-btn-ghost toa-btn-sm"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmState && confirmState.kind !== 'ban' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="toa-seal-card" style={{ maxWidth: '28rem', width: '95%', padding: '1.5rem' }}>
            <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--toa-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Confirm Action</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--toa-smoke)', marginBottom: '1.5rem' }}>
              {confirmState.kind === 'credit' ? (
                <>Are you sure you want to {(confirmState.payload?.delta || 0) > 0 ? 'add' : 'subtract'} {Math.abs(confirmState.payload?.delta || 0)} credits for <span className="text-slate-100 font-semibold">{confirmState.account}</span>?</>
              ) : confirmState.kind === 'verify' ? (
                <>Verify account <span className="text-slate-100 font-semibold">{confirmState.account}</span>? This will set Flag to 98 and clear ActiveCode.</>
              ) : (
                <>This will permanently delete all accounts with Flag &lt; 98 and older than <span className="text-slate-100 font-semibold">{String(confirmState.payload?.days)}</span> days. This action cannot be undone.</>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmState(null)} className="toa-btn toa-btn-ghost toa-btn-sm">Cancel</button>
              <button onClick={executeConfirm} className="toa-btn toa-btn-ghost toa-btn-sm">Confirm</button>
            </div>
          </div>
        </div>
      )}

    </PageShell>
  );
}
