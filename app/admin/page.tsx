'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { GlobalTheme } from '@/app/components/GlobalTheme';
import {
  Settings2, Gamepad2, Users, CreditCard, DollarSign,
  Timer, ScrollText, BarChart2, FileText, Zap, Newspaper,
  ChevronLeft, AlertTriangle, CheckCircle, WifiOff, Clock,
  XCircle, TrendingUp, ShieldAlert,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSessions: 0,
    pendingPayments: 0,
  });
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [paypalBacklog, setPaypalBacklog] = useState({
    totalPending: 0,
    pendingOver10Min: 0,
    pendingOver30Min: 0,
    expiredPending: 0,
    recentFailures: 0,
    completed24h: 0,
  });

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAdminStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/check');
      const data = await response.json();
      if (!data.isAdmin) {
        router.push('/dashboard');
        return;
      }
      // Fetch stats after admin check passes
      await fetchStats();

      // Fetch current maintenance mode status
      try {
        const res = await fetch('/api/admin/maintenance');
        if (res.ok) {
          const data = await res.json();
          setMaintenance(data.maintenance);
        }
      } catch {}

      // Fetch PayPal backlog metrics
      try {
        const backlogRes = await fetch('/api/admin/paypal/backlog');
        if (backlogRes.ok) {
          const backlogData = await backlogRes.json();
          if (backlogData.paypal) {
            setPaypalBacklog(backlogData.paypal);
          }
        }
      } catch {}
    } catch (error) {
      console.error('Error checking admin status:', error);
      router.push('/dashboard');
    }
  }, [router, fetchStats]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const id = setTimeout(() => { void checkAdminStatus(); }, 0);
      return () => clearTimeout(id);
    }
  }, [status, router, checkAdminStatus]);

  if (status === 'loading' || loading) {
    return (
      <GlobalTheme>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ color: 'var(--toa-gold)', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.2em', fontSize: '0.85rem', textTransform: 'uppercase' }}>Loading…</div>
        </div>
      </GlobalTheme>
    );
  }

  const toggleMaintenance = async () => {
    setMaintenanceLoading(true);
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !maintenance }),
      });
      if (res.ok) {
        const data = await res.json();
        setMaintenance(data.maintenance);
      }
    } catch (err) {
      console.error('Toggle maintenance error:', err);
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const adminSections = [
    { Icon: Settings2,  title: 'Website Config',    description: 'Settings, API keys, maintenance mode', href: '/admin/website-config', accent: 'var(--toa-gold)' },
    { Icon: Gamepad2,   title: 'Game Config',        description: 'Rates, drops, and server settings',    href: '/admin/game-config',    accent: 'var(--toa-info)' },
    { Icon: Users,      title: 'User Management',    description: 'Accounts, bans, and credit edits',     href: '/admin/users',          accent: 'var(--toa-gold)' },
    { Icon: CreditCard, title: 'Payments',           description: 'Transactions and payment gateways',    href: '/admin/payments',       accent: 'var(--toa-ember)' },
    { Icon: DollarSign, title: 'Finances',           description: 'Packages, pricing, and revenue',       href: '/admin/finances',       accent: 'var(--toa-success)' },
    { Icon: Timer,      title: 'Cron Monitor',       description: 'Scheduled jobs and manual triggers',   href: '/admin/cron',           accent: 'var(--toa-warning)' },
    { Icon: ScrollText, title: 'Audit Logs',         description: 'System logs and user activity',        href: '/admin/logs',           accent: 'var(--toa-info)' },
    { Icon: BarChart2,  title: 'Game Logs',          description: 'Read-only search across LogDB',        href: '/admin/game-logs',      accent: 'var(--toa-muted)' },
    { Icon: FileText,   title: 'Pages (CMS)',        description: 'Edit public info and download pages',  href: '/admin/pages',          accent: 'var(--toa-gold)' },
    { Icon: Newspaper,  title: 'Launcher News',      description: 'News & patch notes shown in launcher',  href: '/admin/launcher-news',  accent: 'var(--toa-warning)' },
    { Icon: Zap,        title: 'Event Management',   description: 'Create and manage in-game events',     href: '/admin/events',         accent: 'var(--toa-ember)' },
  ];

  const paypalItems = [
    { label: 'Pending',        value: paypalBacklog.totalPending,      color: 'var(--toa-info)',    Icon: Clock,         warn: false },
    { label: 'Stuck >10m',     value: paypalBacklog.pendingOver10Min,  color: '#E5A12A',            Icon: AlertTriangle, warn: paypalBacklog.pendingOver10Min > 0 },
    { label: 'Stuck >30m',     value: paypalBacklog.pendingOver30Min,  color: 'var(--toa-warning)', Icon: AlertTriangle, warn: paypalBacklog.pendingOver30Min > 0 },
    { label: 'Stuck Proc.',    value: paypalBacklog.expiredPending,    color: 'var(--toa-danger)',  Icon: WifiOff,       warn: paypalBacklog.expiredPending > 0 },
    { label: 'Failures 24h',   value: paypalBacklog.recentFailures,    color: 'var(--toa-danger)',  Icon: XCircle,       warn: paypalBacklog.recentFailures > 0 },
    { label: 'Completed 24h',  value: paypalBacklog.completed24h,     color: 'var(--toa-success)', Icon: TrendingUp,    warn: false },
  ];

  return (
    <GlobalTheme>
      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '3.5rem 1.5rem 10rem' }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom: '3rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div className="toa-label">Control Center</div>
            <h1 style={{
              fontFamily: 'var(--font-asian, "ZCOOL XiaoWei"), serif',
              fontWeight: 400,
              fontSize: 'clamp(2rem, 5vw, 3.25rem)', color: 'var(--toa-gold-bright)',
              letterSpacing: '0.12em', marginBottom: '0.4rem',
              textShadow: '0 0 40px rgba(184,155,94,0.15)',
            }}>
              Admin Panel
            </h1>
            <p style={{ color: 'var(--toa-muted)', fontSize: '0.85rem', margin: 0 }}>
              Logged in as <span style={{ color: 'var(--toa-gold-bright)' }}>{session?.user?.name}</span>
            </p>
          </div>
          <Link href="/dashboard" className="toa-btn toa-btn-ghost toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', alignSelf: 'flex-start', marginTop: '0.5rem' }}>
            <ChevronLeft size={14} />
            Dashboard
          </Link>
        </div>

        {/* ── KEY STATS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
          <Link href="/admin/users" style={{ textDecoration: 'none', display: 'block' }}>
            <div className="toa-seal-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
              <div className="toa-seal-corner toa-seal-corner-tl" />
              <div className="toa-seal-corner toa-seal-corner-br" />
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--toa-muted)', marginBottom: '0.6rem' }}>Total Users</div>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--toa-gold-bright)', lineHeight: 1 }}>
                {stats.totalUsers.toLocaleString()}
              </div>
              <Users size={32} style={{ position: 'absolute', right: '0.875rem', bottom: '0.75rem', color: 'var(--toa-gold)', opacity: 0.12 }} />
            </div>
          </Link>

          <Link href="/admin/online-users" style={{ textDecoration: 'none', display: 'block' }}>
            <div className="toa-seal-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
              <div className="toa-seal-corner toa-seal-corner-tl" />
              <div className="toa-seal-corner toa-seal-corner-br" />
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--toa-muted)', marginBottom: '0.6rem' }}>Online Now</div>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--toa-gold-bright)', lineHeight: 1 }}>
                {stats.activeSessions.toLocaleString()}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--toa-success)', boxShadow: '0 0 6px rgba(58,125,68,0.6)' }} />
                <span style={{ fontSize: '0.65rem', color: 'var(--toa-success)', letterSpacing: '0.1em' }}>LIVE</span>
              </div>
            </div>
          </Link>

          <Link href="/admin/payments" style={{ textDecoration: 'none', display: 'block' }}>
            <div className="toa-seal-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
              <div className="toa-seal-corner toa-seal-corner-tl" />
              <div className="toa-seal-corner toa-seal-corner-br" />
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--toa-muted)', marginBottom: '0.6rem' }}>Pending Payments</div>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontSize: '1.75rem', fontWeight: 700, color: stats.pendingPayments > 0 ? 'var(--toa-warning)' : 'var(--toa-gold-bright)', lineHeight: 1 }}>
                {stats.pendingPayments.toLocaleString()}
              </div>
              <CreditCard size={32} style={{ position: 'absolute', right: '0.875rem', bottom: '0.75rem', color: 'var(--toa-gold)', opacity: 0.12 }} />
            </div>
          </Link>

          <button
            onClick={toggleMaintenance}
            disabled={maintenanceLoading}
            style={{ all: 'unset', display: 'block', cursor: maintenanceLoading ? 'not-allowed' : 'pointer', opacity: maintenanceLoading ? 0.6 : 1 }}
          >
            <div className="toa-seal-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
              <div className="toa-seal-corner toa-seal-corner-tl" />
              <div className="toa-seal-corner toa-seal-corner-br" />
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--toa-muted)', marginBottom: '0.6rem' }}>Maintenance</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: maintenance ? 'var(--toa-warning)' : 'var(--toa-success)', boxShadow: maintenance ? '0 0 8px rgba(199,122,48,0.5)' : '0 0 8px rgba(58,125,68,0.5)' }} />
                <span style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1rem', color: maintenance ? 'var(--toa-warning)' : 'var(--toa-success)' }}>
                  {maintenance ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--toa-muted)', marginTop: '0.4rem' }}>
                {maintenanceLoading ? 'Updating…' : 'Click to toggle'}
              </div>
            </div>
          </button>
        </div>

        {/* ── PAYPAL METRICS ── */}
        <div className="toa-label" style={{ marginBottom: '1rem' }}>Payment Operations</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '3rem' }}>
          {paypalItems.map(({ label, value, color, Icon, warn }) => (
            <div key={label} style={{
              background: 'var(--toa-smoke)',
              border: `1px solid ${warn && value > 0 ? color : 'rgba(184,155,94,0.1)'}`,
              padding: '1rem 1.25rem',
              display: 'flex', flexDirection: 'column', gap: '0.35rem',
              transition: 'border-color 0.2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Icon size={13} style={{ color: warn && value > 0 ? color : 'var(--toa-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.62rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--toa-muted)' }}>{label}</span>
              </div>
              <div style={{ fontFamily: 'var(--toa-font-display)', fontSize: '1.35rem', fontWeight: 700, color: warn && value > 0 ? color : 'var(--toa-bone)', lineHeight: 1 }}>
                {value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        {/* ── ADMIN SECTIONS ── */}
        <div className="toa-label" style={{ marginBottom: '1rem' }}>Sections</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
          {adminSections.map(({ Icon, title, description, href, accent }) => (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div className="toa-seal-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden', cursor: 'pointer', height: '100%' }}>
                <div className="toa-seal-corner toa-seal-corner-tl" />
                <div className="toa-seal-corner toa-seal-corner-tr" />
                <div className="toa-seal-corner toa-seal-corner-bl" />
                <div className="toa-seal-corner toa-seal-corner-br" />
                <div style={{
                  width: 40, height: 40,
                  background: `rgba(0,0,0,0.2)`,
                  border: `1px solid ${accent}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '1rem',
                }}>
                  <Icon size={20} style={{ color: accent }} />
                </div>
                <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--toa-gold-bright)', marginBottom: '0.35rem' }}>
                  {title}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--toa-muted)', lineHeight: 1.5 }}>
                  {description}
                </div>
                <Icon size={48} style={{ position: 'absolute', right: '0.75rem', bottom: '0.75rem', color: accent, opacity: 0.06 }} />
              </div>
            </Link>
          ))}
        </div>

        {/* ── PERMISSIONS ── */}
        <div className="toa-seal-card" style={{ padding: '2rem', position: 'relative' }}>
          <div className="toa-seal-corner toa-seal-corner-tl" />
          <div className="toa-seal-corner toa-seal-corner-tr" />
          <div className="toa-seal-corner toa-seal-corner-bl" />
          <div className="toa-seal-corner toa-seal-corner-br" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <ShieldAlert size={20} style={{ color: 'var(--toa-ember)', flexShrink: 0 }} />
            <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--toa-gold-bright)' }}>
              Administrator Access
            </div>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--toa-muted)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            All actions in this panel are logged and attributed to your account. Proceed with care.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
            {['User Management', 'Game Configuration', 'Payment Processing', 'Event Management', 'Audit Logs', 'System Configuration'].map((perm) => (
              <div key={perm} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                <CheckCircle size={13} style={{ color: 'var(--toa-success)', flexShrink: 0 }} />
                <span style={{ color: 'var(--toa-bone)' }}>{perm}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </GlobalTheme>
  );
}
