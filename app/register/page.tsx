'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GlobalTheme } from '@/app/components/GlobalTheme';
import ReCaptcha, { type ReCaptchaRef } from '@/app/components/ReCaptcha';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
  const [recaptchaVersion, setRecaptchaVersion] = useState<'v2' | 'v3'>('v2');
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCaptchaRef>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

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
    setLoading(true);

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 8 || formData.password.length > 20) {
      setError('Password must be between 8 and 20 characters long');
      setLoading(false);
      return;
    }

    let token = recaptchaToken || '';

    if (recaptchaEnabled) {
      if (recaptchaVersion === 'v3') {
        try {
          token = await recaptchaRef.current?.execute() || '';
        } catch {
          setError('reCAPTCHA verification failed. Please try again.');
          setLoading(false);
          return;
        }
      }
      if (!token) {
        setError('Please complete the reCAPTCHA challenge.');
        setLoading(false);
        return;
      }
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          recaptchaToken: token || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const LeftPanel = () => (
    <div className="toa-auth-left">
      <div className="toa-auth-left-content">
        <Image src="/taleofasia-logo-new.png" alt="Tale of Asia" width={160} height={160} className="mx-auto toa-auth-logo" unoptimized />
        <h1 className="toa-auth-title" style={{ fontSize: '2.5rem', marginTop: '1.5rem' }}>Tale of Asia</h1>
        <p className="toa-auth-tagline">Priston Tale Game</p>
        <p className="toa-auth-quote">Every legend begins with a single step onto the battlefield.</p>
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

  if (success) {
    return (
      <GlobalTheme showNav={false} showFooter={false}>
        <div className="toa-auth-page">
          <LeftPanel />
          <div className="toa-auth-right">
            <div className="toa-auth-form-wrap">
              <MobileLogo />
              <div className="toa-auth-card" style={{ textAlign: 'center' }}>
                <div className="toa-seal-corner toa-seal-corner-tl" />
                <div className="toa-seal-corner toa-seal-corner-tr" />
                <div className="toa-seal-corner toa-seal-corner-bl" />
                <div className="toa-seal-corner toa-seal-corner-br" />
                <div style={{ fontSize: '3rem', color: 'var(--toa-success)', marginBottom: '1rem' }}>✓</div>
                <h2 className="toa-auth-heading">Welcome, Hero!</h2>
                <p className="toa-auth-sub" style={{ marginBottom: '1rem' }}>Account created successfully</p>
                <p style={{ color: 'var(--toa-muted)', fontSize: '0.85rem', lineHeight: '1.7' }}>
                  Check your email to verify your account. Redirecting to login shortly.
                </p>
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
              <div className="toa-seal-corner toa-seal-corner-tl" />
              <div className="toa-seal-corner toa-seal-corner-tr" />
              <div className="toa-seal-corner toa-seal-corner-bl" />
              <div className="toa-seal-corner toa-seal-corner-br" />

              <h2 className="toa-auth-heading">Join the Path</h2>
              <p className="toa-auth-sub">Create your warrior account</p>

              <form onSubmit={handleSubmit}>
                {error && <div className="toa-auth-error">{error}</div>}

                <div className="toa-auth-field">
                  <label htmlFor="username" className="toa-auth-label">Username</label>
                  <input id="username" name="username" type="text" value={formData.username} onChange={handleChange} required className="toa-auth-input" placeholder="Choose your hero name" />
                </div>

                <div className="toa-auth-field">
                  <label htmlFor="email" className="toa-auth-label">Email</label>
                  <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required className="toa-auth-input" placeholder="your@email.com" />
                </div>

                <div className="toa-auth-field">
                  <label htmlFor="password" className="toa-auth-label">Password</label>
                  <input id="password" name="password" type="password" value={formData.password} onChange={handleChange} required minLength={8} className="toa-auth-input" placeholder="Min 8 characters" />
                </div>

                <div className="toa-auth-field">
                  <label htmlFor="confirmPassword" className="toa-auth-label">Confirm Password</label>
                  <input id="confirmPassword" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} required minLength={8} className="toa-auth-input" placeholder="Repeat your password" />
                </div>

                {recaptchaEnabled && recaptchaSiteKey && (
                  <div className="flex justify-center mt-4 mb-2">
                    <ReCaptcha ref={recaptchaRef} siteKey={recaptchaSiteKey} version={recaptchaVersion} action="register" onVerify={setRecaptchaToken} />
                  </div>
                )}

                <button type="submit" disabled={loading || (recaptchaEnabled && recaptchaVersion === 'v2' && !recaptchaToken)} className="toa-auth-btn">
                  {loading ? 'Creating account...' : 'Begin Your Legend'}
                </button>
              </form>

              <div className="toa-auth-divider" />
              <div className="toa-auth-links">
                <p>Already have an account? <Link href="/login">Sign in</Link></p>
              </div>
            </div>
            <Link href="/" className="toa-auth-back">← Return to Home</Link>
          </div>
        </div>
      </div>
    </GlobalTheme>
  );
}
