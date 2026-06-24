'use client';

import Link from 'next/link';
import { GlobalTheme } from '@/app/components/GlobalTheme';

export default function TermsPage() {
  return (
    <GlobalTheme>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="toa-page-header">
          <h1 className="toa-page-title">Terms of Service</h1>
          <p className="toa-page-subtitle">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="toa-content-card" style={{ lineHeight: 1.75 }}>
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.12em', color: 'var(--toa-gold-bright)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Acceptance of Terms</h2>
            <p style={{ color: 'var(--toa-bone)' }}>
              By accessing or using Tale of Asia, you agree to these Terms. If you do not agree, do not use the service.
            </p>
          </section>

          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.12em', color: 'var(--toa-gold-bright)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Accounts</h2>
            <ul className="list-disc list-inside space-y-1" style={{ color: 'var(--toa-bone)' }}>
              <li>You are responsible for maintaining the confidentiality of your account.</li>
              <li>You must not share, sell, or otherwise transfer accounts.</li>
              <li>We may suspend or terminate accounts that violate these Terms or our rules.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.12em', color: 'var(--toa-gold-bright)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Rules of Conduct</h2>
            <ul className="list-disc list-inside space-y-1" style={{ color: 'var(--toa-bone)' }}>
              <li>No cheating, exploiting, or automation.</li>
              <li>No harassment, hate speech, or illegal activity.</li>
              <li>Follow game and community guidelines as posted.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.12em', color: 'var(--toa-gold-bright)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Virtual Goods &amp; Payments</h2>
            <p style={{ color: 'var(--toa-bone)' }}>
              Some features may involve virtual currency or items. Purchases are final and non-refundable except where required by law.
            </p>
          </section>

          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.12em', color: 'var(--toa-gold-bright)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Disclaimer</h2>
            <p style={{ color: 'var(--toa-bone)' }}>
              Service is provided &quot;as is&quot; without warranties. We are not liable for indirect or consequential damages.
            </p>
          </section>

          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.12em', color: 'var(--toa-gold-bright)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Privacy</h2>
            <p style={{ color: 'var(--toa-bone)' }}>
              Your use of the service is also governed by our <Link href="/privacy-policy" style={{ color: 'var(--toa-gold)', textDecoration: 'underline' }}>Privacy Policy</Link>.
            </p>
          </section>

          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.12em', color: 'var(--toa-gold-bright)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Contact</h2>
            <p style={{ color: 'var(--toa-bone)' }}>
              For questions about these Terms, contact: <span style={{ color: 'var(--toa-gold)' }}>support@taleofasia.com</span>.
            </p>
          </section>
        </div>
      </div>
    </GlobalTheme>
  );
}
