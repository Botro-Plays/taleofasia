'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { GlobalTheme } from '@/app/components/GlobalTheme';

interface CrownHolders {
  blessCastle: { clanName: string; iconID: number } | null;
  surviveOrDie: { clanName: string; iconID: number } | null;
}

interface ServerStatus {
  status: 'online' | 'offline' | 'maintenance';
  onlineUsers: number;
}

const CLASS_DATA = [
  { name: 'Fighter', desc: 'Warriors that exist for the glory of battle, preferring fights up close and personal. A well-balanced class that excels in group settings.' },
  { name: 'Mechanician', desc: 'Masters of all things mechanical. They employ mechanical attacks, buffs, and spells to reduce damage taken and take on tough, hard-hitting foes.' },
  { name: 'Archer', desc: 'Female warriors unmatched in their ability with projectile weaponry, picking off enemies at a distance. Excel with bows and crossbows.' },
  { name: 'Pikeman', desc: 'Masters of polearms that strike terror into their foes. Boasting the longest melee range and high critical hit ratio for quick, devastating kills.' },
  { name: 'Atalanta', desc: 'Agile warriors who prefer javelins to take down their foes. A mix of melee and range abilities with shields, rumored to be descendants of the Tempskron.' },
  { name: 'Knight', desc: 'Disciplined warriors who utilize Holy Magic in combat. They truly shine when fighting against undead-type enemies.' },
  { name: 'Magician', desc: 'Staff-wielding warriors with strong minds and powerful spells. A force to be reckoned with, using fireball and summoning elementals to do their bidding.' },
  { name: 'Priestess', desc: 'A supportive holy caster who focuses on aiding friendly players rather than dealing damage. A key member in any group with a huge array of helpful abilities.' },
  { name: 'Assassin', desc: 'A warrior-type class boasting high movement speed and stealth, utilizing poison and traps in combat to eliminate targets swiftly.' },
  { name: 'Shaman', desc: 'A magic-casting class that uses witchcraft and dark magic to devastate enemies with powerful spells and curses.' },
];

export default function Home() {
  const [crownHolders, setCrownHolders] = useState<CrownHolders>({
    blessCastle: null,
    surviveOrDie: null,
  });
  const [serverStatus, setServerStatus] = useState<ServerStatus>({
    status: 'online',
    onlineUsers: 0,
  });
  const { data: session } = useSession();
  const [stats, setStats] = useState({ yearsLegacy: 0, activePlayers: 0 });
  const [social, setSocial] = useState<{ discord?: string; facebook?: string }>({});
  const [selectedClass, setSelectedClass] = useState(0);
  const [revealedBands, setRevealedBands] = useState<Set<number>>(new Set());
  const bandRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    fetch('/api/crown-holders').then(r => r.json()).then(setCrownHolders).catch(() => {});
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {});
    fetch('/api/public/config').then(r => r.json()).then(d => setSocial(d?.social || {})).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchStatus = () => {
      fetch('/api/server-status', { cache: 'no-store' })
        .then(r => r.json())
        .then(d => { setServerStatus(d); })
        .catch(() => {});
    };
    fetchStatus();
    const id = setInterval(fetchStatus, 10_000);
    return () => clearInterval(id);
  }, []);

  // Scroll-triggered reveal for feature bands
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-band-idx'));
            setRevealedBands(prev => new Set(prev).add(idx));
          }
        });
      },
      { threshold: 0.3 }
    );
    bandRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const _getClanIconUrl = (iconID: number) => {
    if (iconID === 0) return 'https://taleofasia.com/ClanImage/999999.bmp';
    if (iconID >= 1 && iconID <= 9) return `https://taleofasia.com/ClanImage/${100000 + iconID}.bmp`;
    if (iconID >= 10 && iconID <= 99) return `https://taleofasia.com/ClanImage/${10000 + iconID}.bmp`;
    if (iconID >= 100 && iconID <= 999) return `https://taleofasia.com/ClanImage/${1000 + iconID}.bmp`;
    return `https://taleofasia.com/ClanImage/${iconID}.bmp`;
  };

  // Generate ember particles
  const embers = Array.from({ length: 25 }, (_, i) => ({
    id: i,
    left: `${(i * 37) % 100}%`,
    duration: `${8 + (i % 5) * 3}s`,
    delay: `${(i * 1.3) % 10}s`,
    size: `${2 + (i % 3)}px`,
  }));

  const tickerItems = [
    { label: 'Years Legacy', value: `${new Date().getFullYear() - 2026}+` },
    { label: 'Active Players', value: stats.activePlayers >= 1000 ? `${(stats.activePlayers / 1000).toFixed(1)}K` : `${stats.activePlayers}` },
    { label: 'Classes', value: '10' },
    { label: 'to Play', value: 'Free' },
    {
      label: 'Server',
      value: serverStatus.status === 'online' ? `${serverStatus.onlineUsers} ${serverStatus.onlineUsers <= 1 ? 'user' : 'users'}` :
             serverStatus.status === 'maintenance' ? 'Maintenance' : 'Offline',
      statusColor: serverStatus.status,
    },
    { label: 'Bless Castle', value: crownHolders.blessCastle?.clanName || 'Vacant', icon: crownHolders.blessCastle?.iconID },
    { label: 'Bellatra Champion', value: crownHolders.surviveOrDie?.clanName || 'Vacant', icon: crownHolders.surviveOrDie?.iconID },
  ];

  const features = [
    { kanji: '戦', title: 'Brutal PvP', desc: 'Open-world PvP with no safe zones outside town. Every step is a gamble. Every fight is real.' },
    { kanji: '城', title: 'Clan Sieges', desc: 'Storm fortresses, defend your territory, and crush rival clans in all-out war.' },
    { kanji: '宝', title: 'Deep Loot', desc: 'Hunt world bosses, raid dungeons, and chase gear that actually matters. Rare means rare.' },
    { kanji: '魂', title: 'Old-School Soul', desc: 'No hand-holding. No auto-path. No pay-to-win. Just you, your build, and the battlefield.' },
  ];

  return (
    <GlobalTheme showFooter={true} showTicker={true} tickerItems={tickerItems}>

      {/* === HERO: Ember particles + decode-in title + command bar === */}
      <section className="toa-hero">
        {/* Ember particles */}
        {embers.map(e => (
          <div
            key={e.id}
            className="toa-ember"
            style={{
              left: e.left,
              width: e.size,
              height: e.size,
              animationDuration: e.duration,
              animationDelay: e.delay,
            }}
          />
        ))}

        {/* Title */}
        <h1 className="toa-hero-title">TALE OF ASIA</h1>
        <p className="toa-hero-sub">
          A Priston Tale Game.
          Ten classes. Endless grind. No mercy.
          Forge your legend or die trying.
        </p>

        {/* CTA — single ghost button */}
        <div className="toa-hero-cta">
          <Link href="/register" className="toa-btn toa-btn-solid">
            Enter the Warpath
          </Link>
        </div>

        {/* Mobile nav — inside hero, above status */}
        <nav className="toa-hero-mobile-nav">
          <Link href="/downloads" className="toa-nav-link">Download</Link>
          <Link href="/rankings" className="toa-nav-link">Rankings</Link>
          <Link href="/info/getting-started" className="toa-nav-link">Guide</Link>
          <Link href="/info/server-rules" className="toa-nav-link">Rules</Link>
          <div className="toa-hero-mobile-nav-row">
            <Link href="/" className="toa-nav-brand">TOA</Link>
            {session ? (
              <Link href="/dashboard" className="toa-nav-cta">Dashboard</Link>
            ) : (
              <Link href="/login" className="toa-nav-cta">Login</Link>
            )}
          </div>
        </nav>

        {/* Command bar is now rendered by GlobalTheme */}
      </section>

      {/* === FEATURE SEALS: 2x2 glowing seal-stamp card grid === */}
      <section id="features" className="toa-section" style={{ background: 'var(--toa-void)' }}>
        <div className="toa-label" style={{ maxWidth: '1200px', margin: '0 auto 4rem' }}>What You're Getting Into</div>

        <div className="toa-seal-grid">
          {features.map((feature, idx) => (
            <div
              key={idx}
              ref={el => { bandRefs.current[idx] = el; }}
              data-band-idx={idx}
              className={`toa-seal-card toa-reveal ${revealedBands.has(idx) ? 'toa-revealed' : ''}`}
              style={{ animationDelay: `${idx * 0.15}s` }}
            >
              <div className="toa-seal-kanji">{feature.kanji}</div>
              <div className="toa-seal-number">{String(idx + 1).padStart(2, '0')}</div>
              <h3 className="toa-seal-title">{feature.title}</h3>
              <p className="toa-seal-desc">{feature.desc}</p>
              <div className="toa-seal-corner toa-seal-corner-tl" />
              <div className="toa-seal-corner toa-seal-corner-tr" />
              <div className="toa-seal-corner toa-seal-corner-bl" />
              <div className="toa-seal-corner toa-seal-corner-br" />
            </div>
          ))}
        </div>
      </section>

      {/* === CLASS SELECTOR: Interactive split panel === */}
      <section className="toa-section toa-class-section">
        <div className="toa-label" style={{ maxWidth: '900px', margin: '0 auto 3rem' }}>Pick Your Class</div>
        <div className="toa-class-panel">
          {/* List */}
          <div className="toa-class-list">
            {CLASS_DATA.map((cls, idx) => (
              <div key={idx} className="toa-class-item-wrapper">
                <button
                  type="button"
                  className={`toa-class-item ${selectedClass === idx ? 'active' : ''}`}
                  onClick={() => setSelectedClass(idx)}
                  style={{ pointerEvents: 'auto', position: 'relative', zIndex: 10 }}
                >
                  <Image
                    src={`/images/CharClass/${idx + 1}.png`}
                    alt={cls.name}
                    width={32}
                    height={32}
                    className="toa-class-item-img"
                  />
                  {cls.name}
                </button>
                {/* Inline detail for mobile — shown right below tapped class */}
                {selectedClass === idx && (
                  <div className="toa-class-detail toa-class-detail-inline">
                    <Image
                      src={`/images/CharClass/${selectedClass + 1}.png`}
                      alt={CLASS_DATA[selectedClass].name}
                      width={96}
                      height={96}
                      className="toa-class-detail-img"
                    />
                    <div className="toa-class-detail-name">{CLASS_DATA[selectedClass].name}</div>
                    <p className="toa-class-detail-desc">{CLASS_DATA[selectedClass].desc}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Detail — desktop side panel only */}
          <div className="toa-class-detail toa-class-detail-panel">
            <Image
              src={`/images/CharClass/${selectedClass + 1}.png`}
              alt={CLASS_DATA[selectedClass].name}
              width={96}
              height={96}
              className="toa-class-detail-img"
            />
            <div className="toa-class-detail-name">{CLASS_DATA[selectedClass].name}</div>
            <p className="toa-class-detail-desc">{CLASS_DATA[selectedClass].desc}</p>
          </div>
        </div>
      </section>

      {/* === FINAL CTA: Full-screen minimal === */}
      <section className="toa-cta">
        <h2 className="toa-cta-title">
          Ready to <span>fight?</span>
        </h2>
        <p className="toa-cta-sub">
          Create your account, download the client, and step onto the battlefield.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/register" className="toa-btn toa-btn-solid">Create Account</Link>
          <Link href="/downloads" className="toa-btn toa-btn-ghost">Download Client</Link>
        </div>
        <div className="toa-cta-links">
          <a href={social.discord || 'https://discord.com/invite/nszKZPtvqv'} target="_blank" rel="noopener noreferrer">Discord</a>
          <a href={social.facebook || 'https://www.facebook.com/TaleOfAsia'} target="_blank" rel="noopener noreferrer">Facebook</a>
          <Link href="/rankings">Rankings</Link>
        </div>
      </section>
    </GlobalTheme>
  );
}
