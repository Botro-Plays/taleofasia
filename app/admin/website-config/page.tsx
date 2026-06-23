'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { PageShell } from '@/app/components/PageShell';
import { Save } from 'lucide-react';

interface Config {
  ConfigKey: string;
  ConfigValue: string;
  Description: string;
}

const RECAPTCHA_KEYS = ['recaptcha_enabled', 'recaptcha_version', 'recaptcha_site_key', 'recaptcha_secret_key'];

const EMAIL_KEYS = [
  'email_provider', 'email_from', 'email_from_name',
  'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass',
  'resend_api_key',
  'zoho_user', 'zoho_pass', 'zoho_host', 'zoho_port',
  // Legacy keys (hidden from General Settings)
  'email_smtp_host', 'email_smtp_port', 'email_smtp_username', 'email_smtp_password', 'email_smtp_secure',
];

const PAYMENT_KEYS = [
  'payment_gcash_enabled', 'payment_paymongo_enabled', 'payment_paypal_enabled', 'payment_crypto_enabled',
  'paymongo_public_key', 'paymongo_secret_key', 'paymongo_webhook_secret',
  'paypal_client_id', 'paypal_secret', 'paypal_sandbox', 'paypal_webhook_id',
  'crypto_wallet_bep20', 'crypto_wallet_base',
  'crypto_custom_rpc_bep20', 'crypto_custom_api_key_bep20',
  'crypto_custom_rpc_base', 'crypto_custom_api_key_base',
  // Finances/pricing keys — managed in /admin/finances → Pricing
  'coin_base_rate', 'coin_rate_paymongo', 'coin_rate_paypal', 'coin_rate_crypto', 'coin_rate_gcash',
  'bonus_tier_1_threshold', 'bonus_tier_1_rate', 'bonus_tier_2_threshold', 'bonus_tier_2_rate',
  'bonus_tier_3_threshold', 'bonus_tier_3_rate',
  'payment_min_usd', 'paymongo_min_php', 'paypal_min_usd', 'crypto_min_usd',
];

const PAYMONGO_ALERT_RECIPIENTS_KEY = 'paymongo_alert_recipients';
const READONLY_KEYS = new Set(['crypto_usd_to_credit_rate']);

function getRecaptchaConfig(configs: Config[]) {
  return {
    enabled: configs.find(c => c.ConfigKey === 'recaptcha_enabled')?.ConfigValue === 'true',
    version: configs.find(c => c.ConfigKey === 'recaptcha_version')?.ConfigValue || 'v2',
    siteKey: configs.find(c => c.ConfigKey === 'recaptcha_site_key')?.ConfigValue || '',
    secretKey: configs.find(c => c.ConfigKey === 'recaptcha_secret_key')?.ConfigValue || '',
  };
}

function setRecaptchaInConfigs(configs: Config[], patch: { enabled?: boolean; version?: string; siteKey?: string; secretKey?: string }): Config[] {
  // Read current reCAPTCHA values so we don't lose them when updating a single field
  const current = getRecaptchaConfig(configs);
  const next = configs.filter(c => !RECAPTCHA_KEYS.includes(c.ConfigKey));

  const enabled = patch.enabled !== undefined ? patch.enabled : current.enabled;
  const version = patch.version !== undefined ? patch.version : current.version;
  const siteKey = patch.siteKey !== undefined ? patch.siteKey : current.siteKey;
  const secretKey = patch.secretKey !== undefined ? patch.secretKey : current.secretKey;

  next.push({ ConfigKey: 'recaptcha_enabled', ConfigValue: enabled ? 'true' : 'false', Description: 'Enable Google reCAPTCHA on login/register' });
  next.push({ ConfigKey: 'recaptcha_version', ConfigValue: version, Description: 'reCAPTCHA Version (v2 or v3)' });
  next.push({ ConfigKey: 'recaptcha_site_key', ConfigValue: siteKey, Description: 'Google reCAPTCHA Site Key (public)' });
  next.push({ ConfigKey: 'recaptcha_secret_key', ConfigValue: secretKey, Description: 'Google reCAPTCHA Secret Key (server-only)' });

  return next;
}

function getEmailConfig(configs: Config[]) {
  return {
    provider: configs.find(c => c.ConfigKey === 'email_provider')?.ConfigValue || 'smtp',
    from: configs.find(c => c.ConfigKey === 'email_from')?.ConfigValue || '',
    fromName: configs.find(c => c.ConfigKey === 'email_from_name')?.ConfigValue || 'Tale of Asia',
    smtpHost: configs.find(c => c.ConfigKey === 'smtp_host')?.ConfigValue || '',
    smtpPort: configs.find(c => c.ConfigKey === 'smtp_port')?.ConfigValue || '465',
    smtpSecure: configs.find(c => c.ConfigKey === 'smtp_secure')?.ConfigValue === 'true',
    smtpUser: configs.find(c => c.ConfigKey === 'smtp_user')?.ConfigValue || '',
    smtpPass: configs.find(c => c.ConfigKey === 'smtp_pass')?.ConfigValue || '',
    resendApiKey: configs.find(c => c.ConfigKey === 'resend_api_key')?.ConfigValue || '',
    zohoUser: configs.find(c => c.ConfigKey === 'zoho_user')?.ConfigValue || '',
    zohoPass: configs.find(c => c.ConfigKey === 'zoho_pass')?.ConfigValue || '',
    zohoHost: configs.find(c => c.ConfigKey === 'zoho_host')?.ConfigValue || 'smtp.zoho.com',
    zohoPort: configs.find(c => c.ConfigKey === 'zoho_port')?.ConfigValue || '465',
  };
}

function setEmailInConfigs(configs: Config[], patch: Partial<ReturnType<typeof getEmailConfig>>): Config[] {
  const current = getEmailConfig(configs);
  const next = configs.filter(c => !EMAIL_KEYS.includes(c.ConfigKey));

  next.push({ ConfigKey: 'email_provider', ConfigValue: patch.provider !== undefined ? patch.provider : current.provider, Description: 'Email provider: smtp, resend, or zoho' });
  next.push({ ConfigKey: 'email_from', ConfigValue: patch.from !== undefined ? patch.from : current.from, Description: 'Sender email address (e.g. noreply@taleofasia.com)' });
  next.push({ ConfigKey: 'email_from_name', ConfigValue: patch.fromName !== undefined ? patch.fromName : current.fromName, Description: 'Sender display name' });
  next.push({ ConfigKey: 'smtp_host', ConfigValue: patch.smtpHost !== undefined ? patch.smtpHost : current.smtpHost, Description: 'SMTP server hostname (for SMTP provider)' });
  next.push({ ConfigKey: 'smtp_port', ConfigValue: patch.smtpPort !== undefined ? patch.smtpPort : current.smtpPort, Description: 'SMTP server port' });
  next.push({ ConfigKey: 'smtp_secure', ConfigValue: patch.smtpSecure !== undefined ? (patch.smtpSecure ? 'true' : 'false') : (current.smtpSecure ? 'true' : 'false'), Description: 'Use SSL/TLS for SMTP' });
  next.push({ ConfigKey: 'smtp_user', ConfigValue: patch.smtpUser !== undefined ? patch.smtpUser : current.smtpUser, Description: 'SMTP username' });
  next.push({ ConfigKey: 'smtp_pass', ConfigValue: patch.smtpPass !== undefined ? patch.smtpPass : current.smtpPass, Description: 'SMTP password' });
  next.push({ ConfigKey: 'resend_api_key', ConfigValue: patch.resendApiKey !== undefined ? patch.resendApiKey : current.resendApiKey, Description: 'Resend API key (for Resend provider)' });
  next.push({ ConfigKey: 'zoho_user', ConfigValue: patch.zohoUser !== undefined ? patch.zohoUser : current.zohoUser, Description: 'Zoho Mail username (for Zoho provider)' });
  next.push({ ConfigKey: 'zoho_pass', ConfigValue: patch.zohoPass !== undefined ? patch.zohoPass : current.zohoPass, Description: 'Zoho Mail password / app-specific password' });
  next.push({ ConfigKey: 'zoho_host', ConfigValue: patch.zohoHost !== undefined ? patch.zohoHost : current.zohoHost, Description: 'Zoho SMTP host' });
  next.push({ ConfigKey: 'zoho_port', ConfigValue: patch.zohoPort !== undefined ? patch.zohoPort : current.zohoPort, Description: 'Zoho SMTP port' });

  return next;
}


export default function WebsiteConfigPage() {
  const { status } = useSession();
  const router = useRouter();
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/website-config');
      const data = await response.json();
      setConfigs(data);
    } catch (error) {
      console.error('Error fetching configs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAdminAndFetchConfigs = useCallback(async () => {
    try {
      const adminCheck = await fetch('/api/admin/check');
      const adminData = await adminCheck.json();
      
      if (!adminData.isAdmin) {
        router.push('/dashboard');
        return;
      }

      await fetchConfigs();
    } catch (error) {
      console.error('Error checking admin status:', error);
      router.push('/dashboard');
    }
  }, [router, fetchConfigs]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const id = setTimeout(() => { void checkAdminAndFetchConfigs(); }, 0);
      return () => clearTimeout(id);
    }
  }, [status, router, checkAdminAndFetchConfigs]);

  const handleConfigChange = (key: string, value: string) => {
    setConfigs(configs.map(config => 
      config.ConfigKey === key ? { ...config, ConfigValue: value } : config
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/website-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs }),
      });

      if (response.ok) {
        setMessage('Configuration saved successfully!');
      } else {
        setMessage('Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving configs:', error);
      setMessage('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(t);
  }, [message]);

  if (status === 'loading' || loading) {
    return (
      <PageShell label="Admin" title="Website Configuration" backHref="/admin" backLabel="Admin">
        <div className="toa-loading">Loading…</div>
      </PageShell>
    );
  }

  return (
    <PageShell label="Admin" title="Website Configuration" backHref="/admin" backLabel="Admin">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {message && (
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999, minWidth: '20rem', textAlign: 'center' }}>
            <div className={`toa-msg ${message.includes('success') ? 'toa-msg-success' : 'toa-msg-error'}`} style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>{message}</div>
          </div>
        )}

        {/* reCAPTCHA Settings */}
        <div className="toa-seal-card" style={{ padding: '2rem', position: 'relative' }}>
          <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-tr" />
          <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--toa-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.5rem' }}>reCAPTCHA Settings</div>

          {(() => {
            const r = getRecaptchaConfig(configs);
            return (
              <div className="space-y-6">
                <div className="toa-panel" style={{ padding: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--toa-bone)', fontSize: '0.875rem' }}>Enable reCAPTCHA</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)', marginTop: '0.125rem' }}>Show Google reCAPTCHA challenge on login and registration</div>
                  </div>
                  <button type="button" onClick={() => setConfigs(setRecaptchaInConfigs(configs, { enabled: !r.enabled }))} style={{ position: 'relative', display: 'inline-flex', height: '1.5rem', width: '2.75rem', alignItems: 'center', borderRadius: '9999px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', background: r.enabled ? 'var(--toa-success)' : 'rgba(107,101,119,0.4)', flexShrink: 0 }}>
                    <span style={{ display: 'inline-block', height: '1.125rem', width: '1.125rem', borderRadius: '9999px', background: 'white', transition: 'transform 0.2s', transform: r.enabled ? 'translateX(1.375rem)' : 'translateX(0.25rem)' }} />
                  </button>
                </div>

                <div>
                  <label className="toa-label-field">Version</label>
                  <select
                    value={r.version}
                    onChange={(e) => setConfigs(setRecaptchaInConfigs(configs, { version: e.target.value }))}
                    className="toa-input"
                  >
                    <option value="v2">v2 Checkbox (visible challenge)</option>
                    <option value="v3">v3 Invisible (score-based, no user interaction)</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    v2 shows a checkbox. v3 runs invisibly and scores the interaction.
                  </p>
                </div>

                <div>
                  <label className="toa-label-field">Site Key (public)</label>
                  <input
                    type="text"
                    value={r.siteKey}
                    onChange={(e) => setConfigs(setRecaptchaInConfigs(configs, { siteKey: e.target.value }))}
                    placeholder="e.g. 6Lc..."
                    className="toa-input"
                  />
                </div>

                <div>
                  <label className="toa-label-field">Secret Key (server-only)</label>
                  <div className="flex gap-2">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={r.secretKey}
                      onChange={(e) => setConfigs(setRecaptchaInConfigs(configs, { secretKey: e.target.value }))}
                      placeholder="e.g. 6Lc..."
                      className="toa-input"
                    />
                    <button type="button" onClick={() => setShowSecret(v => !v)} className="toa-btn toa-btn-ghost toa-btn-sm">
                      {showSecret ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSave} disabled={saving} className="toa-btn toa-btn-solid toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Saving…' : <><Save size={13} />&nbsp;Save</>}
            </button>
          </div>
        </div>

        {/* Email Provider Settings */}
        <div className="toa-seal-card" style={{ padding: '2rem', position: 'relative' }}>
          <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-tr" />
          <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--toa-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.5rem' }}>Email Provider Settings</div>

          {(() => {
            const e = getEmailConfig(configs);
            return (
              <div className="space-y-6">
                <div>
                  <label className="toa-label-field">Email Provider</label>
                  <select
                    value={e.provider}
                    onChange={(ev) => setConfigs(setEmailInConfigs(configs, { provider: ev.target.value }))}
                    className="toa-input"
                  >
                    <option value="smtp">SMTP (Custom Server)</option>
                    <option value="resend">Resend</option>
                    <option value="zoho">Zoho Mail</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Choose the email service used for password resets and verification emails.
                  </p>
                </div>

                <div>
                  <label className="toa-label-field">Sender Email Address</label>
                  <input
                    type="text"
                    value={e.from}
                    onChange={(ev) => setConfigs(setEmailInConfigs(configs, { from: ev.target.value }))}
                    placeholder="noreply@taleofasia.com"
                    className="toa-input"
                  />
                </div>

                <div>
                  <label className="toa-label-field">Sender Display Name</label>
                  <input
                    type="text"
                    value={e.fromName}
                    onChange={(ev) => setConfigs(setEmailInConfigs(configs, { fromName: ev.target.value }))}
                    placeholder="Tale of Asia"
                    className="toa-input"
                  />
                </div>

                {e.provider === 'smtp' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="toa-label-field">SMTP Host</label>
                        <input
                          type="text"
                          value={e.smtpHost}
                          onChange={(ev) => setConfigs(setEmailInConfigs(configs, { smtpHost: ev.target.value }))}
                          placeholder="taleofasia.com"
                          className="toa-input"
                        />
                      </div>
                      <div>
                        <label className="toa-label-field">SMTP Port</label>
                        <input
                          type="text"
                          value={e.smtpPort}
                          onChange={(ev) => setConfigs(setEmailInConfigs(configs, { smtpPort: ev.target.value }))}
                          placeholder="465"
                          className="toa-input"
                        />
                      </div>
                    </div>

                    <div className="toa-panel" style={{ padding: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--toa-bone)', fontSize: '0.875rem' }}>Use SSL/TLS</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)', marginTop: '0.125rem' }}>Enable for port 465 (SSL), disable for 587 (STARTTLS)</div>
                      </div>
                      <button type="button" onClick={() => setConfigs(setEmailInConfigs(configs, { smtpSecure: !e.smtpSecure }))} style={{ position: 'relative', display: 'inline-flex', height: '1.5rem', width: '2.75rem', alignItems: 'center', borderRadius: '9999px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', background: e.smtpSecure ? 'var(--toa-success)' : 'rgba(107,101,119,0.4)', flexShrink: 0 }}>
                        <span style={{ display: 'inline-block', height: '1.125rem', width: '1.125rem', borderRadius: '9999px', background: 'white', transition: 'transform 0.2s', transform: e.smtpSecure ? 'translateX(1.375rem)' : 'translateX(0.25rem)' }} />
                      </button>
                    </div>

                    <div>
                      <label className="toa-label-field">SMTP Username</label>
                      <input
                        type="text"
                        value={e.smtpUser}
                        onChange={(ev) => setConfigs(setEmailInConfigs(configs, { smtpUser: ev.target.value }))}
                        placeholder="noreply@taleofasia.com"
                        className="toa-input"
                      />
                    </div>

                    <div>
                      <label className="toa-label-field">SMTP Password</label>
                      <input
                        type="password"
                        value={e.smtpPass}
                        onChange={(ev) => setConfigs(setEmailInConfigs(configs, { smtpPass: ev.target.value }))}
                        placeholder="••••••••"
                        className="toa-input"
                      />
                    </div>
                  </>
                )}

                {e.provider === 'resend' && (
                  <div>
                    <label className="toa-label-field">Resend API Key</label>
                    <input
                      type="password"
                      value={e.resendApiKey}
                      onChange={(ev) => setConfigs(setEmailInConfigs(configs, { resendApiKey: ev.target.value }))}
                      placeholder="re_xxxxxxxxxxxxxxxx"
                      className="toa-input"
                    />
                    <p className="text-xs text-slate-500 mt-1">Get your API key from https://resend.com/api-keys</p>
                  </div>
                )}

                {e.provider === 'zoho' && (
                  <>
                    <div>
                      <label className="toa-label-field">Zoho Mail Username</label>
                      <input
                        type="text"
                        value={e.zohoUser}
                        onChange={(ev) => setConfigs(setEmailInConfigs(configs, { zohoUser: ev.target.value }))}
                        placeholder="you@taleofasia.com"
                        className="toa-input"
                      />
                    </div>

                    <div>
                      <label className="toa-label-field">Zoho Mail Password / App Password</label>
                      <input
                        type="password"
                        value={e.zohoPass}
                        onChange={(ev) => setConfigs(setEmailInConfigs(configs, { zohoPass: ev.target.value }))}
                        placeholder="••••••••"
                        className="toa-input"
                      />
                      <p className="text-xs text-slate-500 mt-1">Use an app-specific password from Zoho Mail settings.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="toa-label-field">Zoho SMTP Host</label>
                        <input
                          type="text"
                          value={e.zohoHost}
                          onChange={(ev) => setConfigs(setEmailInConfigs(configs, { zohoHost: ev.target.value }))}
                          placeholder="smtp.zoho.com"
                          className="toa-input"
                        />
                      </div>
                      <div>
                        <label className="toa-label-field">Zoho SMTP Port</label>
                        <input
                          type="text"
                          value={e.zohoPort}
                          onChange={(ev) => setConfigs(setEmailInConfigs(configs, { zohoPort: ev.target.value }))}
                          placeholder="465"
                          className="toa-input"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSave} disabled={saving} className="toa-btn toa-btn-solid toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Saving…' : <><Save size={13} />&nbsp;Save</>}
            </button>
          </div>
        </div>

        {/* General Website Configs */}
        <div className="toa-panel" style={{ padding: '2rem' }}>
          <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--toa-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.5rem' }}>General Settings</div>
          <div className="space-y-6">
            {configs.filter(c => !RECAPTCHA_KEYS.includes(c.ConfigKey) && !EMAIL_KEYS.includes(c.ConfigKey) && !PAYMENT_KEYS.includes(c.ConfigKey) && c.ConfigKey !== PAYMONGO_ALERT_RECIPIENTS_KEY).map((config) => {
              const isReadOnly = READONLY_KEYS.has(config.ConfigKey);
              return (
              <div key={config.ConfigKey}>
                <label className="toa-label-field">
                  {config.Description || config.ConfigKey}
                  {isReadOnly && <span style={{ fontSize: '0.7rem', color: 'var(--toa-muted)', marginLeft: '0.5rem' }}>(read-only — managed in Finances → Pricing)</span>}
                </label>
                <input
                  type="text"
                  value={config.ConfigValue}
                  onChange={(e) => handleConfigChange(config.ConfigKey, e.target.value)}
                  className="toa-input"
                  readOnly={isReadOnly}
                  style={isReadOnly ? { opacity: 0.6, cursor: 'default' } : undefined}
                />
              </div>
              );
            })}
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSave} disabled={saving} className="toa-btn toa-btn-solid toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Saving…' : <><Save size={13} />&nbsp;Save All Configuration</>}
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
