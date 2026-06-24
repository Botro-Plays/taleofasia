'use client';

import Link from 'next/link';
import { GlobalTheme } from '@/app/components/GlobalTheme';

export default function PrivacyPolicyPage() {
  return (
    <GlobalTheme>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="toa-page-header">
          <h1 className="toa-page-title">Privacy Policy</h1>
          <p className="toa-page-subtitle">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="toa-content-card" style={{ lineHeight: 1.75 }}>
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.12em', color: 'var(--toa-gold-bright)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Overview</h2>
            <p style={{ color: 'var(--toa-bone)' }}>
              Tale of Asia (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates this website and related game services. 
              This policy explains what information we collect, how we use it, and your choices.
            </p>
          </section>

          <section id="cookies" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.12em', color: 'var(--toa-gold-bright)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Cookies</h2>
            <p className="mb-2" style={{ color: 'var(--toa-bone)' }}>
              We use essential cookies for login sessions and site functionality. Optional cookies (e.g., analytics) are disabled by default. 
              You can manage your choice using the cookie banner. See also your browser settings for cookie controls.
            </p>
          </section>

          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.12em', color: 'var(--toa-gold-bright)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Data We Process</h2>
            <ul className="list-disc list-inside space-y-1" style={{ color: 'var(--toa-bone)' }}>
              <li>Account data: username, email, hashed password.</li>
              <li>Gameplay data: characters, progress, in-game activity.</li>
              <li>Technical data: IP address, device information (for security and fraud prevention).</li>
            </ul>
          </section>

          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.12em', color: 'var(--toa-gold-bright)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Google OAuth</h2>
            <p className="mb-2" style={{ color: 'var(--toa-bone)' }}>
              If you choose to sign in with Google, we receive your Google account basic profile (name, email). 
              We use this solely to authenticate you and associate your account. We do not sell Google user data or use it for advertising.
            </p>
            <p style={{ color: 'var(--toa-bone)' }}>
              You may revoke access at any time via your Google Account settings. For requests to delete your account or data, contact us below.
            </p>
          </section>

          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.12em', color: 'var(--toa-gold-bright)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Data Retention &amp; Deletion</h2>
            <p style={{ color: 'var(--toa-bone)' }}>
              We retain account and gameplay data for as long as your account is active. 
              You can request deletion of your web account by opening a support ticket; we will remove personally identifiable web data within 30 days, 
              except where retention is required by law or to resolve disputes.
            </p>
          </section>

          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.12em', color: 'var(--toa-gold-bright)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Security</h2>
            <p style={{ color: 'var(--toa-bone)' }}>
              We use industry-standard measures (hashed passwords, restricted database access) to protect your data. 
              No method of transmission or storage is 100% secure, but we strive to protect your information.
            </p>
          </section>

          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'var(--toa-font-display)', letterSpacing: '0.12em', color: 'var(--toa-gold-bright)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Contact</h2>
            <p style={{ color: 'var(--toa-bone)' }}>
              For privacy requests (access, correction, deletion) contact: <span style={{ color: 'var(--toa-gold)' }}>support@taleofasia.com</span>.
            </p>
          </section>

          <div className="pt-4" style={{ fontSize: '0.85rem', color: 'var(--toa-muted)' }}>
            <Link href="/terms" style={{ color: 'var(--toa-gold)', textDecoration: 'underline' }}>Read our Terms of Service</Link>
          </div>
        </div>
      </div>
    </GlobalTheme>
  );
}
