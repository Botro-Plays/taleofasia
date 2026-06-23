'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GlobalTheme } from '@/app/components/GlobalTheme';

function PaymentReturnContent() {
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get('status') || 'success';
  const method = params.get('method') || 'PayPal';
  const [countdown, setCountdown] = useState(5);

  const isSuccess = status === 'success';
  const targetUrl = `/dashboard/topup?payment=${isSuccess ? 'success' : 'failed'}&method=${encodeURIComponent(method)}`;

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.replace(targetUrl);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const returnNow = () => {
    router.replace(targetUrl);
  };

  return (
    <GlobalTheme showNav={false} showFooter={false}>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'var(--toa-void)',
      }}>
        <div className="toa-seal-card" style={{
          maxWidth: '28rem',
          width: '100%',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          position: 'relative',
          animation: 'none',
          transform: 'none',
        }}>
          <div className="toa-seal-corner toa-seal-corner-tl" />
          <div className="toa-seal-corner toa-seal-corner-tr" />
          <div className="toa-seal-corner toa-seal-corner-bl" />
          <div className="toa-seal-corner toa-seal-corner-br" />

          {/* Icon */}
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: `2px solid ${isSuccess ? 'var(--toa-success)' : 'var(--toa-danger)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            fontSize: '1.5rem',
            color: isSuccess ? 'var(--toa-success)' : 'var(--toa-danger)',
          }}>
            {isSuccess ? '✓' : '✕'}
          </div>

          {/* Title */}
          <div style={{
            fontFamily: 'var(--toa-font-display)',
            fontWeight: 700,
            fontSize: '1.1rem',
            color: isSuccess ? 'var(--toa-success)' : 'var(--toa-danger)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '0.5rem',
          }}>
            {isSuccess ? 'Payment Successful' : 'Payment Cancelled'}
          </div>

          {/* Description */}
          <div style={{
            fontSize: '0.82rem',
            color: 'var(--toa-muted)',
            marginBottom: '1.5rem',
            lineHeight: 1.5,
          }}>
            {isSuccess
              ? `Your ${method} payment has been received. Coins are being awarded to your account.`
              : `Your ${method} payment was not completed. No charge was made.`}
          </div>

          {/* Countdown */}
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--toa-muted)',
            marginBottom: '1rem',
          }}>
            Redirecting in <span style={{ color: 'var(--toa-gold-bright)', fontWeight: 700 }}>{countdown}</span> seconds...
          </div>

          {/* Return button */}
          <button
            onClick={returnNow}
            className="toa-btn toa-btn-solid"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '0.625rem 1.5rem',
              fontSize: '0.85rem',
            }}
          >
            Return to Tale of Asia
          </button>
        </div>
      </div>
    </GlobalTheme>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--toa-void)', color: 'var(--toa-muted)', fontSize: '0.85rem' }}>
        Loading...
      </div>
    }>
      <PaymentReturnContent />
    </Suspense>
  );
}
