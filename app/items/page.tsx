'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { PageShell } from '@/app/components/PageShell';
import { Search, X } from 'lucide-react';

interface GameItem {
  sItemID: number;
  szItemName: string;
  szLastCategory: string;
  szItemPath: string;
  iLevel: number;
  iClass: number;
  iWidth: number;
  iHeight: number;
  iWeight: number;
  iSalePrice: number;
  IntegrityMin: number;
  IntegrityMax: number;
  OrganicMin: number;
  OrganicMax: number;
  FireMin: number;
  FireMax: number;
  FrostMin: number;
  FrostMax: number;
  LightningMin: number;
  LightningMax: number;
  PoisonMin: number;
  PoisonMax: number;
  AttackPower1Min: number;
  AttackPower1Max: number;
  AttackPower2Min: number;
  AttackPower2Max: number;
  iAttackRange: number;
  iAttackSpeed: number;
  AttackRatingMin: number;
  AttackRatingMax: number;
  iCritical: number;
  BlockRatingMin: number;
  BlockRatingMax: number;
  AbsorbMin: number;
  AbsorbMax: number;
  DefenseMin: number;
  DefenseMax: number;
  iPotionStorage: number;
  iPotionCount: number;
  HPRegenMin: number;
  HPRegenMax: number;
  MPRegenMin: number;
  MPRegenMax: number;
  STMRegenMin: number;
  STMRegenMax: number;
  AddHPMin: number;
  AddHPMax: number;
  AddMPMin: number;
  AddMPMax: number;
  AddSTMMin: number;
  AddSTMMax: number;
  RunSpeedMin: number;
  RunSpeedMax: number;
  AddSpecRunSpeedMin: number;
  AddSpecRunSpeedMax: number;
  AddSpecAbsorbMin: number;
  AddSpecAbsorbMax: number;
  AddSpecDefenseMin: number;
  AddSpecDefenseMax: number;
  iSpecAttackSpeed: number;
  iSpecCritical: number;
  iSpecAttackPowerDivMin: number;
  iSpecAttackPowerDivMax: number;
  SpecAttackRatingLevelMin: number;
  SpecAttackRatingLevelMax: number;
  fSpecHPRegen: number;
  AddSpecMPRegenMin: number;
  AddSpecMPRegenMax: number;
  fSpecSPRegen: number;
  fSpecBlockRating: number;
  iSpecAttackRange: number;
  iStrength: number;
  iSpirit: number;
  iTalent: number;
  iAgility: number;
  iHealth: number;
  eSpecialization: number;
  JobBitCodeRandom1: number;
  JobBitCodeRandom2: number;
  JobBitCodeRandom3: number;
  JobBitCodeRandom4: number;
  JobBitCodeRandom5: number;
  JobBitCodeRandom6: number;
  JobBitCodeRandom7: number;
  JobBitCodeRandom8: number;
  JobBitCodeRandom9: number;
  JobBitCodeRandom10: number;
  imageUrl: string;
  mainCategory: string;
  subCategory: string;
}

interface MainCategory {
  key: string;
  label: string;
  subs: Array<{ key: string; label: string }>;
}

interface SubCategory {
  key: string;
  label: string;
  count: number;
}

const SPEC_CLASSES = [
  'Fighter', 'Mechanician', 'Archer', 'Pikeman', 'Atalanta',
  'Knight', 'Magician', 'Priestess', 'Assassin', 'Shaman',
];

function buildSpecInfo(item: GameItem): Array<{ class: string; hasSpec: boolean }> {
  return SPEC_CLASSES.map((cls, i) => {
    const idx = i + 1;
    const hasJobBit = (item as any)[`JobBitCodeRandom${idx}`] > 0;
    const isMainSpec = item.eSpecialization === idx;
    return { class: cls, hasSpec: hasJobBit || isMainSpec };
  });
}

function buildStats(item: GameItem): Array<{ label: string; value: string; spec?: boolean }> {
  const stats: Array<{ label: string; value: string; spec?: boolean }> = [];

  if (item.iLevel > 0) stats.push({ label: 'Level', value: String(item.iLevel) });
  if (item.iStrength > 0) stats.push({ label: 'Strength', value: String(item.iStrength) });
  if (item.iSpirit > 0) stats.push({ label: 'Spirit', value: String(item.iSpirit) });
  if (item.iTalent > 0) stats.push({ label: 'Talent', value: String(item.iTalent) });
  if (item.iAgility > 0) stats.push({ label: 'Agility', value: String(item.iAgility) });
  if (item.iHealth > 0) stats.push({ label: 'Health', value: String(item.iHealth) });
  if (item.IntegrityMin > 0) stats.push({ label: 'Integrity', value: `${item.IntegrityMin} - ${item.IntegrityMax}` });
  if (item.OrganicMin > 0) stats.push({ label: 'Organic', value: `${item.OrganicMin} - ${item.OrganicMax}` });
  if (item.FireMin > 0) stats.push({ label: 'Fire', value: `${item.FireMin} - ${item.FireMax}` });
  if (item.FrostMin > 0) stats.push({ label: 'Frost', value: `${item.FrostMin} - ${item.FrostMax}` });
  if (item.LightningMin > 0) stats.push({ label: 'Lightning', value: `${item.LightningMin} - ${item.LightningMax}` });
  if (item.PoisonMin > 0) stats.push({ label: 'Poison', value: `${item.PoisonMin} - ${item.PoisonMax}` });
  if (item.AttackPower1Min > 0) stats.push({ label: 'Atk Power', value: `${item.AttackPower1Min} - ${item.AttackPower1Max}` });
  if (item.AttackPower2Min > 0) stats.push({ label: 'Atk Power 2', value: `${item.AttackPower2Min} - ${item.AttackPower2Max}` });
  if (item.iAttackRange > 0) stats.push({ label: 'Range', value: String(item.iAttackRange) });
  if (item.iAttackSpeed > 0) stats.push({ label: 'Atk Speed', value: String(item.iAttackSpeed) });
  if (item.AttackRatingMin > 0) stats.push({ label: 'Atk Rating', value: `${item.AttackRatingMin} - ${item.AttackRatingMax}` });
  if (item.iCritical > 0) stats.push({ label: 'Critical', value: `${item.iCritical}%` });
  if (item.BlockRatingMin > 0) stats.push({ label: 'Block', value: `${item.BlockRatingMin}% - ${item.BlockRatingMax}%` });
  if (item.AbsorbMin > 0) stats.push({ label: 'Absorb', value: `${item.AbsorbMin}% - ${item.AbsorbMax}%` });
  if (item.DefenseMin > 0) stats.push({ label: 'Defense', value: `${item.DefenseMin} - ${item.DefenseMax}` });
  if (item.iPotionStorage > 0) stats.push({ label: 'Pot Capacity', value: String(item.iPotionStorage) });
  if (item.HPRegenMin > 0) stats.push({ label: 'HP Regen', value: `${item.HPRegenMin} - ${item.HPRegenMax}` });
  if (item.MPRegenMin > 0) stats.push({ label: 'MP Regen', value: `${item.MPRegenMin} - ${item.MPRegenMax}` });
  if (item.STMRegenMin > 0) stats.push({ label: 'STM Regen', value: `${item.STMRegenMin} - ${item.STMRegenMax}` });
  if (item.AddHPMin > 0) stats.push({ label: 'Add HP', value: `${item.AddHPMin} - ${item.AddHPMax}` });
  if (item.AddMPMin > 0) stats.push({ label: 'Add MP', value: `${item.AddMPMin} - ${item.AddMPMax}` });
  if (item.AddSTMMin > 0) stats.push({ label: 'Add STM', value: `${item.AddSTMMin} - ${item.AddSTMMax}` });
  if (item.RunSpeedMin > 0) stats.push({ label: 'Run Speed', value: `${item.RunSpeedMin} - ${item.RunSpeedMax}` });

  // Spec stats
  if (item.AddSpecRunSpeedMin > 0) stats.push({ label: 'Spec +Run Speed', value: `${item.AddSpecRunSpeedMin} - ${item.AddSpecRunSpeedMax}`, spec: true });
  if (item.AddSpecAbsorbMin > 0) stats.push({ label: 'Spec +Absorb', value: `${item.AddSpecAbsorbMin}% - ${item.AddSpecAbsorbMax}%`, spec: true });
  if (item.AddSpecDefenseMin > 0) stats.push({ label: 'Spec +Defense', value: `${item.AddSpecDefenseMin} - ${item.AddSpecDefenseMax}`, spec: true });
  if (item.iSpecAttackSpeed > 0) stats.push({ label: 'Spec +Atk Speed', value: String(item.iSpecAttackSpeed), spec: true });
  if (item.iSpecCritical > 0) stats.push({ label: 'Spec +Crit', value: `${item.iSpecCritical}%`, spec: true });
  if (item.iSpecAttackPowerDivMin > 0) stats.push({ label: 'Spec +Atk Power', value: `${item.iSpecAttackPowerDivMin} - ${item.iSpecAttackPowerDivMax}`, spec: true });
  if (item.SpecAttackRatingLevelMin > 0) stats.push({ label: 'Spec +Atk Rating', value: `${item.SpecAttackRatingLevelMin} - ${item.SpecAttackRatingLevelMax}`, spec: true });
  if (item.fSpecHPRegen > 0) stats.push({ label: 'Spec +HP Regen', value: String(item.fSpecHPRegen), spec: true });
  if (item.AddSpecMPRegenMin > 0) stats.push({ label: 'Spec +MP Regen', value: `${item.AddSpecMPRegenMin} - ${item.AddSpecMPRegenMax}`, spec: true });
  if (item.fSpecSPRegen > 0) stats.push({ label: 'Spec +STM Regen', value: String(item.fSpecSPRegen), spec: true });
  if (item.fSpecBlockRating > 0) stats.push({ label: 'Spec +Block', value: `${item.fSpecBlockRating}%`, spec: true });
  if (item.iSpecAttackRange > 0) stats.push({ label: 'Spec +Range', value: String(item.iSpecAttackRange), spec: true });

  return stats;
}

export default function ItemsPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<GameItem[]>([]);
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [activeMain, setActiveMain] = useState('weapons');
  const [activeSub, setActiveSub] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchItems = useCallback(async (main: string, sub: string, search: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (main) params.set('category', main);
      if (sub) params.set('sub', sub);
      if (search) params.set('search', search);
      const res = await fetch(`/api/items?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setMainCategories(data.mainCategories || []);
      setSubCategories(data.subCategories || []);
    } catch (e) {
      console.error('Failed to fetch items:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const hasFetched = useRef(false);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchItems('weapons', '', '');
    }
  }, [fetchItems]);

  const handleMainClick = (main: string) => {
    setActiveMain(main);
    setActiveSub('');
    fetchItems(main, '', search);
  };

  const handleSubClick = (sub: string) => {
    setActiveSub(sub);
    fetchItems(activeMain, sub, search);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    fetchItems(activeMain, activeSub, searchInput);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
    fetchItems(activeMain, activeSub, '');
  };

  return (
    <PageShell label="Guide" title="Item List" backHref="/" backLabel="Home">
        {/* Search bar */}
        <form onSubmit={handleSearch} style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', maxWidth: '400px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search item name..."
              className="toa-input"
              style={{ width: '100%', paddingLeft: '2.25rem' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--toa-muted)' }} />
          </div>
          {searchInput && (
            <button type="button" onClick={clearSearch} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ padding: '0.5rem' }}>
              <X size={16} />
            </button>
          )}
        </form>

        {/* Main category tabs */}
        {mainCategories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {mainCategories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => handleMainClick(cat.key)}
                className="toa-btn toa-btn-sm"
                style={{
                  background: activeMain === cat.key ? 'var(--toa-gold)' : 'transparent',
                  color: activeMain === cat.key ? 'var(--toa-bg)' : 'var(--toa-gold)',
                  border: '1px solid var(--toa-gold)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  padding: '0.5rem 1.25rem',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Sub-category tabs */}
        {subCategories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '2rem' }}>
            <button
              onClick={() => handleSubClick('')}
              className="toa-btn toa-btn-sm"
              style={{
                background: !activeSub ? 'var(--toa-gold-dark)' : 'transparent',
                color: !activeSub ? 'var(--toa-bg)' : 'var(--toa-gold-dark)',
                border: '1px solid var(--toa-gold-dark)',
                fontSize: '0.8rem',
                padding: '0.35rem 0.75rem',
              }}
            >
              All
            </button>
            {subCategories.map((sub) => (
              <button
                key={sub.key}
                onClick={() => handleSubClick(sub.key)}
                className="toa-btn toa-btn-sm"
                style={{
                  background: activeSub === sub.key ? 'var(--toa-gold-dark)' : 'transparent',
                  color: activeSub === sub.key ? 'var(--toa-bg)' : 'var(--toa-gold-dark)',
                  border: '1px solid var(--toa-gold-dark)',
                  fontSize: '0.8rem',
                  padding: '0.35rem 0.75rem',
                }}
              >
                {sub.label} ({sub.count})
              </button>
            ))}
          </div>
        )}

        {/* Items grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--toa-muted)' }}>
            Loading items...
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--toa-muted)' }}>
            No items found. {items.length === 0 && subCategories.length === 0 && 'An admin needs to make items visible first.'}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1rem',
          }}>
            {items.map((item) => {
              const stats = buildStats(item);
              const specInfo = buildSpecInfo(item);
              return (
                <div
                  key={`${item.sItemID}-${item.szLastCategory}`}
                  className="toa-seal-card"
                  style={{
                    padding: '1rem',
                    transition: 'transform 0.2s, filter 0.2s',
                    cursor: 'default',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.filter = 'brightness(1.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.filter = 'brightness(1)'; }}
                >
                  {/* Item name */}
                  <div style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: 'var(--toa-gold-bright)',
                    marginBottom: '0.75rem',
                    borderBottom: '1px solid var(--toa-border)',
                    paddingBottom: '0.5rem',
                  }}>
                    {item.szItemName}
                  </div>

                  {/* Image + Stats */}
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {/* Image */}
                    <div style={{
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--toa-border)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      padding: '2px',
                      minWidth: '52px',
                      minHeight: '52px',
                    }}>
                      <img
                        src={item.imageUrl}
                        alt={item.szItemName}
                        style={{ maxWidth: '48px', maxHeight: '48px', objectFit: 'contain', imageRendering: 'auto' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>

                    {/* Stats */}
                    <div style={{ flex: 1, fontSize: '0.8rem', lineHeight: 1.6 }}>
                      {stats.length === 0 ? (
                        <span style={{ color: 'var(--toa-muted)' }}>No stats</span>
                      ) : (
                        stats.map((stat, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: '0.5rem',
                              color: stat.spec ? '#3b7d5e' : 'var(--toa-text)',
                            }}
                          >
                            <span style={{ color: stat.spec ? '#3b7d5e' : 'var(--toa-muted)' }}>{stat.label}</span>
                            <span style={{ fontWeight: 600 }}>{stat.value}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Spec class info */}
                  {specInfo.some(s => s.hasSpec) ? (
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {specInfo.filter(s => s.hasSpec).map((s) => (
                        <span key={s.class} style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '3px',
                          background: 'rgba(184,155,94,0.1)',
                          color: '#b8a55e',
                          border: '1px solid rgba(184,155,94,0.2)',
                          whiteSpace: 'nowrap',
                        }}>
                          {s.class} Spec
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.75rem' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '3px',
                        color: 'var(--toa-muted)',
                        whiteSpace: 'nowrap',
                      }}>
                        No Spec
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </PageShell>
  );
}
