'use client';

import Image from 'next/image';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { GlobalTheme } from '@/app/components/GlobalTheme';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    if (!token) {
      setTimeout(() => { setStatus('error'); setMessage('Invalid or missing verification token.'); }, 0);
      return;
    }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) { setTimeout(() => { setStatus('success'); setMessage(data.message || 'Email verified successfully!'); }, 0); }
        else { setTimeout(() => { setStatus('error'); setMessage(data.error || 'Verification failed.'); }, 0); }
      })
      .catch(() => { setTimeout(() => { setStatus('error'); setMessage('An error occurred. Please try again.'); }, 0); });
  }, [token]);

  return (
    <div className="toa-auth-card" style={{ textAlign: 'center' }}>
      <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-tr" />
      <div className="toa-seal-corner toa-seal-corner-bl" /><div className="toa-seal-corner toa-seal-corner-br" />

      {status === 'loading' && (
        <>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.5 }}>⋯</div>
          <h2 className="toa-auth-heading">Verifying</h2>
          <p style={{ color: 'var(--toa-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{message}</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div style={{ fontSize: '3rem', color: 'var(--toa-success)', marginBottom: '1rem' }}>✓</div>
          <h2 className="toa-auth-heading">Verified!</h2>
          <p style={{ color: 'var(--toa-muted)', fontSize: '0.85rem', margin: '0.5rem 0 1.5rem', lineHeight: '1.7' }}>{message}</p>
          <Link href="/login" className="toa-auth-btn" style={{ display: 'inline-block', padding: '0.7rem 2rem', textDecoration: 'none', fontSize: '0.75rem', letterSpacing: '0.2em' }}>
            Sign In
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <div style={{ fontSize: '2.5rem', color: 'var(--toa-danger)', marginBottom: '1rem' }}>⚠</div>
          <h2 className="toa-auth-heading">Verification Failed</h2>
          <p style={{ color: 'var(--toa-muted)', fontSize: '0.85rem', margin: '0.5rem 0 1.5rem', lineHeight: '1.7' }}>{message}</p>
          <div className="toa-auth-links" style={{ marginTop: 0 }}>
            <p><Link href="/resend-verification">Request new link</Link></p>
            <p><Link href="/register">Create account</Link></p>
          </div>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <GlobalTheme showNav={false} showFooter={false}>
      <div className="toa-auth-page">
        <div className="toa-auth-left">
          <div className="toa-auth-left-content">
            <Image src="/taleofasia-logo-new.png" alt="Tale of Asia" width={160} height={160} className="mx-auto toa-auth-logo" unoptimized />
            <h1 className="toa-auth-title" style={{ fontSize: '2.5rem', marginTop: '1.5rem' }}>Tale of Asia</h1>
            <p className="toa-auth-tagline">Priston Tale Game</p>
            <p className="toa-auth-quote">Your journey into the realm begins with a single confirmation.</p>
          </div>
        </div>
        <div className="toa-auth-right">
          <div className="toa-auth-form-wrap">
            <div className="toa-auth-mobile-logo">
              <Link href="/">
                <Image src="/taleofasia-logo-new.png" alt="Tale of Asia" width={100} height={100} className="mx-auto toa-auth-logo" unoptimized />
                <h1 className="toa-auth-title" style={{ fontSize: '1.75rem', marginTop: '0.75rem' }}>Tale of Asia</h1>
              </Link>
            </div>
            <Suspense fallback={
              <div className="toa-auth-card" style={{ textAlign: 'center', color: 'var(--toa-muted)' }}>Loading...</div>
            }>
              <VerifyEmailContent />
            </Suspense>
            <Link href="/" className="toa-auth-back">← Return to Home</Link>
          </div>
        </div>
      </div>
    </GlobalTheme>
  );
}
