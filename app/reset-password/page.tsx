'use client';

import Image from 'next/image';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { GlobalTheme } from '@/app/components/GlobalTheme';

const LeftPanel = () => (
  <div className="toa-auth-left">
    <div className="toa-auth-left-content">
      <Image src="/taleofasia-logo-new.png" alt="Tale of Asia" width={160} height={160} className="mx-auto toa-auth-logo" unoptimized />
      <h1 className="toa-auth-title" style={{ fontSize: '2.5rem', marginTop: '1.5rem' }}>Tale of Asia</h1>
      <p className="toa-auth-tagline">Priston Tale Game</p>
      <p className="toa-auth-quote">Forge a new path. The realm awaits your return.</p>
    </div>
  </div>
);

const MobileLogo = () => (
  <div className="toa-auth-mobile-logo">
    <Link href="/">
      <Image src="/taleofasia-logo-new.png" alt="Tale of Asia" width={100} height={100} className="mx-auto toa-auth-logo" unoptimized />
      <h1 className="toa-auth-title" style={{ fontSize: '1.75rem', marginTop: '0.75rem' }}>Tale of Asia</h1>
    </Link>
  </div>
);

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters long'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Failed to reset password'); }
      else { setSuccess(true); }
    } catch { setError('An error occurred. Please try again.'); }
    finally { setLoading(false); }
  };

  if (!token) {
    return (
      <div className="toa-auth-card" style={{ textAlign: 'center' }}>
        <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-tr" />
        <div className="toa-seal-corner toa-seal-corner-bl" /><div className="toa-seal-corner toa-seal-corner-br" />
        <div style={{ fontSize: '2rem', color: 'var(--toa-danger)', marginBottom: '1rem' }}>⚠</div>
        <h2 className="toa-auth-heading">Invalid Link</h2>
        <p style={{ color: 'var(--toa-muted)', fontSize: '0.85rem', margin: '0.75rem 0 1.5rem' }}>The password reset link is missing or invalid.</p>
        <Link href="/forgot-password" className="toa-auth-btn" style={{ display: 'inline-block', padding: '0.7rem 2rem', textDecoration: 'none', fontSize: '0.75rem', letterSpacing: '0.2em' }}>
          Request New Link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="toa-auth-card" style={{ textAlign: 'center' }}>
        <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-tr" />
        <div className="toa-seal-corner toa-seal-corner-bl" /><div className="toa-seal-corner toa-seal-corner-br" />
        <div style={{ fontSize: '3rem', color: 'var(--toa-success)', marginBottom: '1rem' }}>✓</div>
        <h2 className="toa-auth-heading">Password Reset</h2>
        <p style={{ color: 'var(--toa-muted)', fontSize: '0.85rem', margin: '0.75rem 0 1.5rem' }}>Your password has been updated successfully.</p>
        <Link href="/login" className="toa-auth-btn" style={{ display: 'inline-block', padding: '0.7rem 2rem', textDecoration: 'none', fontSize: '0.75rem', letterSpacing: '0.2em' }}>
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="toa-auth-card">
      <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-tr" />
      <div className="toa-seal-corner toa-seal-corner-bl" /><div className="toa-seal-corner toa-seal-corner-br" />

      <h2 className="toa-auth-heading">New Password</h2>
      <p className="toa-auth-sub">Set your new password below</p>

      <form onSubmit={handleSubmit}>
        {error && <div className="toa-auth-error">{error}</div>}

        <div className="toa-auth-field">
          <label htmlFor="password" className="toa-auth-label">New Password</label>
          <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className="toa-auth-input" placeholder="Min 8 characters" />
        </div>

        <div className="toa-auth-field">
          <label htmlFor="confirmPassword" className="toa-auth-label">Confirm Password</label>
          <input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="toa-auth-input" placeholder="Repeat your password" />
        </div>

        <button type="submit" disabled={loading} className="toa-auth-btn">
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <GlobalTheme showNav={false} showFooter={false}>
      <div className="toa-auth-page">
        <LeftPanel />
        <div className="toa-auth-right">
          <div className="toa-auth-form-wrap">
            <MobileLogo />
            <Suspense fallback={
              <div className="toa-auth-card" style={{ textAlign: 'center', color: 'var(--toa-muted)' }}>Loading...</div>
            }>
              <ResetPasswordForm />
            </Suspense>
            <Link href="/" className="toa-auth-back">← Return to Home</Link>
          </div>
        </div>
      </div>
    </GlobalTheme>
  );
}
