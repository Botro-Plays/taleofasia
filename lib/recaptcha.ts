import { webDB } from '@/lib/db';

export async function getRecaptchaSecret(): Promise<string> {
  const res = await webDB.query(
    `SELECT ConfigValue FROM WebsiteConfigs WHERE LOWER(ConfigKey) = 'recaptcha_secret_key'`
  );
  return String(res.recordset?.[0]?.ConfigValue || '');
}

export async function isRecaptchaEnabled(): Promise<boolean> {
  const res = await webDB.query(
    `SELECT ConfigValue FROM WebsiteConfigs WHERE LOWER(ConfigKey) = 'recaptcha_enabled'`
  );
  return String(res.recordset?.[0]?.ConfigValue || '').toLowerCase() === 'true';
}

export async function verifyRecaptchaToken(token: string): Promise<boolean> {
  const secret = await getRecaptchaSecret();
  if (!secret) {
    console.error('[recaptcha] Secret key is empty — check WebsiteConfigs table');
    return false;
  }

  const params = new URLSearchParams();
  params.append('secret', secret);
  params.append('response', token);


  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    console.error(`[recaptcha] Google API HTTP error: ${res.status}`);
    return false;
  }

  const data = await res.json();

  return data.success === true;
}
