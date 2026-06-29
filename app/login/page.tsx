'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { GlobalTheme } from '@/app/components/GlobalTheme';
import ReCaptcha, { type ReCaptchaRef } from '@/app/components/ReCaptcha';

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
  const [recaptchaVersion, setRecaptchaVersion] = useState<'v2' | 'v3'>('v2');
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCaptchaRef>(null);

  useEffect(() => {
    if (status === 'authenticated') router.push('/dashboard');
  }, [status, router]);

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
        try { token = await recaptchaRef.current?.execute() || ''; }
        catch { setError('reCAPTCHA verification failed. Please try again.'); return; }
      }
      if (!token) { setError('Please complete the reCAPTCHA challenge.'); return; }
    }
    setLoading(true);
    try {
      const result = await signIn('credentials', { username, password, recaptchaToken: token, redirect: false });
      if (result?.error) {
        const errorMessages: Record<string, string> = {
          'Configuration': 'Invalid username or password. Please try again.',
          'CallbackRouteError': 'Invalid username or password. Please try again.',
          'reCAPTCHA verification failed': 'reCAPTCHA verification failed. Please try again.',
        };
        setError(errorMessages[result.error] || result.error);
      }
      else { router.push('/dashboard'); router.refresh(); }
    } catch { setError('An error occurred. Please try again.'); }
    finally { setLoading(false); }
  };

  if (status === 'authenticated') {
    return (
      <GlobalTheme showNav={false} showFooter={false}>
        <div className="flex-1 flex items-center justify-center" style={{ minHeight: '100vh' }}>
          <p style={{ color: 'var(--toa-gold)' }}>Redirecting...</p>
        </div>
      </GlobalTheme>
    );
  }

  return (
    <GlobalTheme showNav={false} showFooter={false}>
      <div className="toa-auth-page">

        {/* Left — branding panel (desktop) */}
        <div className="toa-auth-left">
          <div className="toa-auth-left-content">
            <Image src="/taleofasia-logo-new.png" alt="Tale of Asia" width={160} height={160} className="mx-auto toa-auth-logo" unoptimized />
            <h1 className="toa-auth-title" style={{ fontSize: '2.5rem', marginTop: '1.5rem' }}>Tale of Asia</h1>
            <p className="toa-auth-tagline">Priston Tale Game</p>
            <p className="toa-auth-quote">Where legends are forged in battle and glory is written in blood.</p>
          </div>
        </div>

        {/* Right — form panel */}
        <div className="toa-auth-right">
          <div className="toa-auth-form-wrap">

            {/* Mobile logo */}
            <div className="toa-auth-mobile-logo">
              <Link href="/">
                <Image src="/taleofasia-logo-new.png" alt="Tale of Asia" width={100} height={100} className="mx-auto toa-auth-logo" unoptimized />
                <h1 className="toa-auth-title" style={{ fontSize: '1.75rem', marginTop: '0.75rem' }}>Tale of Asia</h1>
              </Link>
            </div>

            <div className="toa-auth-card">
              <div className="toa-seal-corner toa-seal-corner-tl" />
              <div className="toa-seal-corner toa-seal-corner-tr" />
              <div className="toa-seal-corner toa-seal-corner-bl" />
              <div className="toa-seal-corner toa-seal-corner-br" />

              <h2 className="toa-auth-heading">Welcome Back</h2>
              <p className="toa-auth-sub">Sign in to continue your journey</p>

              <form onSubmit={handleSubmit}>
                {error && <div className="toa-auth-error">{error}</div>}

                <div className="toa-auth-field">
                  <label htmlFor="username" className="toa-auth-label">Username</label>
                  <input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)} required className="toa-auth-input" placeholder="Your hero name" />
                </div>

                <div className="toa-auth-field">
                  <label htmlFor="password" className="toa-auth-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className="toa-auth-input" placeholder="••••••••" style={{ paddingRight: '2rem' }} />
                    <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1} style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--toa-muted)', padding: '0.25rem', lineHeight: 0 }} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {recaptchaEnabled && recaptchaSiteKey && (
                  <div className="flex justify-center mt-4 mb-2">
                    <ReCaptcha ref={recaptchaRef} siteKey={recaptchaSiteKey} version={recaptchaVersion} action="login" onVerify={setRecaptchaToken} />
                  </div>
                )}

                <button type="submit" disabled={loading || (recaptchaEnabled && recaptchaVersion === 'v2' && !recaptchaToken)} className="toa-auth-btn">
                  {loading ? 'Signing in...' : 'Enter the Realm'}
                </button>
              </form>

              <div className="toa-auth-divider" />

              <div className="toa-auth-links">
                <p>New here? <Link href="/register">Create an account</Link></p>
                <p><Link href="/forgot-password">Forgot password?</Link></p>
                <p><Link href="/resend-verification">Resend verification email</Link></p>
              </div>
            </div>

            <Link href="/" className="toa-auth-back">← Return to Home</Link>
          </div>
        </div>

      </div>
    </GlobalTheme>
  );
}
