'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { GlobalTheme } from '@/app/components/GlobalTheme';
import ReCaptcha, { type ReCaptchaRef } from '@/app/components/ReCaptcha';

const LeftPanel = () => (
  <div className="toa-auth-left">
    <div className="toa-auth-left-content">
      <Image src="/taleofasia-logo-new.png" alt="Tale of Asia" width={160} height={160} className="mx-auto toa-auth-logo" unoptimized />
      <h1 className="toa-auth-title" style={{ fontSize: '2.5rem', marginTop: '1.5rem' }}>Tale of Asia</h1>
      <p className="toa-auth-tagline">Priston Tale Game</p>
      <p className="toa-auth-quote">The gates open only for those who prove themselves worthy.</p>
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

export default function ResendVerificationPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
  const [recaptchaVersion, setRecaptchaVersion] = useState<'v2' | 'v3'>('v2');
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCaptchaRef>(null);

  useEffect(() => {
    fetch('/api/public/config', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (data.recaptcha?.enabled) {
          setRecaptchaEnabled(true);
          setRecaptchaVersion(data.recaptcha.version || 'v2');
          setRecaptchaSiteKey(data.recaptcha.siteKey || '');
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let token = recaptchaToken || '';

    if (recaptchaEnabled) {
      if (recaptchaVersion === 'v3') {
        try {
          token = await recaptchaRef.current?.execute() || '';
        } catch {
          setError('reCAPTCHA verification failed. Please try again.');
          return;
        }
      }
      if (!token) {
        setError('Please complete the reCAPTCHA challenge.');
        return;
      }
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, recaptchaToken: token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to resend verification email');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <GlobalTheme showNav={false} showFooter={false}>
        <div className="toa-auth-page">
          <LeftPanel />
          <div className="toa-auth-right">
            <div className="toa-auth-form-wrap">
              <MobileLogo />
              <div className="toa-auth-card" style={{ textAlign: 'center' }}>
                <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-tr" />
                <div className="toa-seal-corner toa-seal-corner-bl" /><div className="toa-seal-corner toa-seal-corner-br" />
                <div style={{ fontSize: '3rem', color: 'var(--toa-success)', marginBottom: '1rem' }}>✓</div>
                <h2 className="toa-auth-heading">Email Sent</h2>
                <p className="toa-auth-sub" style={{ marginBottom: '1rem' }}>Check your inbox</p>
                <p style={{ color: 'var(--toa-muted)', fontSize: '0.85rem', lineHeight: '1.7', marginBottom: '1.5rem' }}>
                  If your account exists and is unverified, you will receive instructions shortly.
                </p>
                <Link href="/login" className="toa-auth-btn" style={{ display: 'inline-block', padding: '0.7rem 2rem', textDecoration: 'none', fontSize: '0.75rem', letterSpacing: '0.2em' }}>
                  Back to Login
                </Link>
              </div>
              <Link href="/" className="toa-auth-back">← Return to Home</Link>
            </div>
          </div>
        </div>
      </GlobalTheme>
    );
  }

  return (
    <GlobalTheme showNav={false} showFooter={false}>
      <div className="toa-auth-page">
        <LeftPanel />
        <div className="toa-auth-right">
          <div className="toa-auth-form-wrap">
            <MobileLogo />
            <div className="toa-auth-card">
              <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-tr" />
              <div className="toa-seal-corner toa-seal-corner-bl" /><div className="toa-seal-corner toa-seal-corner-br" />

              <h2 className="toa-auth-heading">Resend Verification</h2>
              <p className="toa-auth-sub">Get a new verification link</p>

              <form onSubmit={handleSubmit}>
                {error && <div className="toa-auth-error">{error}</div>}

                <div className="toa-auth-field">
                  <label htmlFor="email" className="toa-auth-label">Email Address</label>
                  <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="toa-auth-input" placeholder="your@email.com" />
                </div>

                {recaptchaEnabled && recaptchaSiteKey && (
                  <div className="flex justify-center mt-4 mb-2">
                    <ReCaptcha ref={recaptchaRef} siteKey={recaptchaSiteKey} version={recaptchaVersion} action="resend_verification" onVerify={setRecaptchaToken} />
                  </div>
                )}

                <button type="submit" disabled={loading || (recaptchaEnabled && recaptchaVersion === 'v2' && !recaptchaToken)} className="toa-auth-btn">
                  {loading ? 'Sending...' : 'Resend Verification'}
                </button>
              </form>

              <div className="toa-auth-divider" />
              <div className="toa-auth-links">
                <p>Already verified? <Link href="/login">Sign in</Link></p>
                <p>No account? <Link href="/register">Register</Link></p>
              </div>
            </div>
            <Link href="/" className="toa-auth-back">← Return to Home</Link>
          </div>
        </div>
      </div>
    </GlobalTheme>
  );
}
