'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GlobalTheme } from '@/app/components/GlobalTheme';

interface CrownHolders {
  blessCastle: { clanName: string; iconID: number } | null;
  surviveOrDie: { clanName: string; iconID: number } | null;
}

interface ServerStatus {
  status: 'online' | 'offline' | 'maintenance';
  onlineUsers: number;
}

export default function Home() {
  const [crownHolders, setCrownHolders] = useState<CrownHolders>({
    blessCastle: null,
    surviveOrDie: null,
  });
  const [serverStatus, setServerStatus] = useState<ServerStatus>({
    status: 'online',
    onlineUsers: 0,
  });

  useEffect(() => {
    fetch('/api/crown-holders')
      .then(res => res.json())
      .then(data => setCrownHolders(data))
      .catch(console.error);

    fetch('/api/server-status')
      .then(res => res.json())
      .then(data => setServerStatus(data))
      .catch(console.error);
  }, []);

  const getClanIconUrl = (iconID: number) => {
    if (iconID === 0) return 'https://taleofasia.com/ClanImage/999999.bmp';
    if (iconID >= 1 && iconID <= 9) return `https://taleofasia.com/ClanImage/${100000 + iconID}.bmp`;
    if (iconID >= 10 && iconID <= 99) return `https://taleofasia.com/ClanImage/${10000 + iconID}.bmp`;
    if (iconID >= 100 && iconID <= 999) return `https://taleofasia.com/ClanImage/${1000 + iconID}.bmp`;
    return `https://taleofasia.com/ClanImage/${iconID}.bmp`;
  };

  const classIcons = [String]::Concat('??', ', ', '??', ', ', '??', ', ', '??', ', ', '??', ', ', '??', ', ', '??', ', ', '?', ', ', '?', ', ', '??');

  return (
    <GlobalTheme showFooter={true}>
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background with gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27]">
          {/* Animated background elements */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-red-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="fade-in">
            {/* Server Status Badge */}
            <div className="mb-8 inline-block">
              <div className="metallic-card px-6 py-3 flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${serverStatus.status === 'online' ? 'bg-green-500 glow-success' : serverStatus.status === 'maintenance' ? 'bg-orange-500' : 'bg-red-500'}`}></div>
                <span className="text-sm font-semibold">
                  Server: <span className={serverStatus.status === 'online' ? 'status-online' : serverStatus.status === 'maintenance' ? 'status-maintenance' : 'status-offline'}>
                    {serverStatus.status.toUpperCase()}
                  </span>
                </span>
                <span className="text-sm">• {serverStatus.onlineUsers.toLocaleString()} Online</span>
              </div>
            </div>

            {/* Main Title */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-tight">
              <span className="tale-of-conquest-title">TALE OF CONQUEST</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Enter a world of ancient kingdoms, epic battles, and legendary conquest. 
              <br />
              <span className="text-[var(--color-royal-gold)]">Rise as a hero. Claim your destiny.</span>
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
              <Link
                href="/register"
                className="glow-button text-lg px-8 py-4 hover:scale-105 active:scale-95"
              >
                ⚔️ Play Now
              </Link>
              <Link
                href="/rankings"
                className="crimson-button text-lg px-8 py-4 hover:scale-105 active:scale-95"
              >
                🏆 View Rankings
              </Link>
              <a
                href="#features"
                className="border-2 border-[var(--color-mystical-blue)] text-[var(--color-glowing-cyan)] px-8 py-4 rounded-lg font-semibold hover:bg-[var(--color-mystical-blue)]/10 transition-all text-lg"
              >
                📖 Learn More
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="metallic-card p-4">
                <div className="text-3xl font-bold text-[var(--color-royal-gold)]">10+</div>
                <div className="text-sm text-slate-400">Years Legacy</div>
              </div>
              <div className="metallic-card p-4">
                <div className="text-3xl font-bold text-[var(--color-royal-gold)]">5K+</div>
                <div className="text-sm text-slate-400">Active Players</div>
              </div>
              <div className="metallic-card p-4">
                <div className="text-3xl font-bold text-[var(--color-royal-gold)]">100%</div>
                <div className="text-sm text-slate-400">Free to Play</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 animate-bounce">
          <div className="text-[var(--color-royal-gold)] text-2xl">↓</div>
        </div>
      </section>

      {/* Conquest Status Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0a0e27] to-[#1a1f3a]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-center mb-4">
            <span className="gradient-text">CURRENT CONQUEST</span>
          </h2>
          <p className="text-center text-slate-400 mb-12 max-w-2xl mx-auto">
            Witness the eternal struggle for dominance. Which clan will claim glory?
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Bless Castle */}
            <div className="conquest-banner scale-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">🏰 Bless Castle</h3>
                  <p className="text-slate-300 text-sm mb-4">Siege War - Conquer the fortress and claim eternal glory</p>
                </div>
                <img
                  src={crownHolders.blessCastle ? getClanIconUrl(crownHolders.blessCastle.iconID) : getClanIconUrl(0)}
                  alt="Bless Castle Clan"
                  className="w-20 h-20 rounded border-2 border-[var(--color-crimson-glow)] glow-crimson"
                />
              </div>
              <div className="divider-gold my-4"></div>
              <div className="text-center">
                <p className="text-slate-400 text-sm mb-1">Current Holder</p>
                <p className="text-2xl font-bold text-[var(--color-royal-gold)]">
                  {crownHolders.blessCastle?.clanName || 'Unclaimed'}
                </p>
              </div>
            </div>

            {/* Bellatra - Survive or Die */}
            <div className="conquest-banner scale-in" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">⚔️ Bellatra</h3>
                  <p className="text-slate-300 text-sm mb-4">Survive or Die - 8 rounds of ultimate combat</p>
                </div>
                <img
                  src={crownHolders.surviveOrDie ? getClanIconUrl(crownHolders.surviveOrDie.iconID) : getClanIconUrl(0)}
                  alt="Bellatra Clan"
                  className="w-20 h-20 rounded border-2 border-[var(--color-crimson-glow)] glow-crimson"
                />
              </div>
              <div className="divider-gold my-4"></div>
              <div className="text-center">
                <p className="text-slate-400 text-sm mb-1">Current Champion</p>
                <p className="text-2xl font-bold text-[var(--color-royal-gold)]">
                  {crownHolders.surviveOrDie?.clanName || 'Unclaimed'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0a0e27]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-center mb-4">
            <span className="gradient-text">GAME FEATURES</span>
          </h2>
          <p className="text-center text-slate-400 mb-16 max-w-2xl mx-auto">
            Experience the ultimate MMORPG adventure with cutting-edge features
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: '⚔️', title: 'Epic PvP Combat', desc: 'Engage in intense player-versus-player battles with strategic depth' },
              { icon: '🏰', title: 'Conquest Warfare', desc: 'Lead your clan to victory and claim legendary fortresses' },
              { icon: '🎭', title: '10 Classes', desc: 'Master unique classes with distinct abilities and playstyles' },
              { icon: '🌍', title: 'Vast World', desc: 'Explore expansive dungeons, forests, and mystical realms' },
              { icon: '👥', title: 'Clan System', desc: 'Form powerful clans and dominate the realm together' },
              { icon: '💎', title: 'Rich Loot', desc: 'Collect legendary items and rare equipment' },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="metallic-card p-8 text-center hover:scale-105 transition-transform"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className="text-6xl mb-4 float">{feature.icon}</div>
                <h3 className="text-2xl font-bold text-[var(--color-royal-gold)] mb-3">{feature.title}</h3>
                <p className="text-slate-300">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Classes Showcase */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#1a1f3a] to-[#0a0e27]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-center mb-4">
            <span className="gradient-text">CHOOSE YOUR CLASS</span>
          </h2>
          <p className="text-center text-slate-400 mb-16 max-w-2xl mx-auto">
            Select from 10 unique classes, each with powerful abilities and playstyles
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              'Fighter', 'Mechanician', 'Archer', 'Pikeman', 'Atalanta',
              'Knight', 'Magician', 'Priestess', 'Assassin', 'Shaman'
            ].map((className, idx) => (
              <div
                key={idx}
                className="metallic-card p-6 text-center hover:border-[var(--color-glowing-cyan)] transition-all cursor-pointer group"
              >
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">
                  {classIcons[idx]}
                </div>
                <p className="font-bold text-[var(--color-royal-gold)] group-hover:text-[var(--color-glowing-cyan)] transition-colors">
                  {className}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0a0e27]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="metallic-card p-12 border-2 border-[var(--color-royal-gold)]">
            <h2 className="text-4xl md:text-5xl font-black mb-6">
              Ready to Begin Your <span className="gradient-text">Legend?</span>
            </h2>
            <p className="text-lg text-slate-300 mb-8">
              Join thousands of adventurers in the ultimate MMORPG experience. 
              Create your character today and start your journey to greatness.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/register" className="glow-button text-lg px-8 py-4">
                Create Account
              </Link>
              <Link href="/login" className="border-2 border-[var(--color-mystical-blue)] text-[var(--color-glowing-cyan)] px-8 py-4 rounded-lg font-semibold hover:bg-[var(--color-mystical-blue)]/10 transition-all text-lg">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>
    </GlobalTheme>
  );
}


