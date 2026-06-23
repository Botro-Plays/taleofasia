'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageShell } from '@/app/components/PageShell';

export default function ChangePasswordPage() {
  const { status } = useSession();
  const router = useRouter();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to change password');
      } else {
        setSuccess(true);
        setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <PageShell label="Account" title="Change Password" backHref="/dashboard" backLabel="Dashboard">
        <div className="toa-loading">Loading…</div>
      </PageShell>
    );
  }

  return (
    <PageShell label="Account" title="Change Password" backHref="/dashboard" backLabel="Dashboard">
        <div style={{ maxWidth: '28rem', margin: '0 auto' }}>
          <div className="toa-seal-card" style={{ padding: '2rem', position: 'relative' }}>
            <div className="toa-seal-corner toa-seal-corner-tl" />
            <div className="toa-seal-corner toa-seal-corner-tr" />
            <div className="toa-seal-corner toa-seal-corner-bl" />
            <div className="toa-seal-corner toa-seal-corner-br" />
            {success && (
              <div className="toa-msg toa-msg-success" style={{ marginBottom: '1.5rem' }}>Password changed successfully!</div>
            )}
            {error && (
              <div className="toa-msg toa-msg-error" style={{ marginBottom: '1.5rem' }}>{error}</div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label htmlFor="currentPassword" className="toa-label-field">Current Password</label>
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  required
                  className="toa-input"
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="toa-label-field">New Password</label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  required
                  minLength={8}
                  className="toa-input"
                  placeholder="Min 8 characters"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="toa-label-field">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  minLength={8}
                  className="toa-input"
                  placeholder="Repeat new password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="toa-btn toa-btn-solid"
                style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
              >
                {loading ? 'Changing Password…' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
    </PageShell>
  );
}
