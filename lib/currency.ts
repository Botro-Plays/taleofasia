import { cached } from '@/lib/cache';

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  updatedAt: number;
}

const FREE_API = 'https://open.er-api.com/v6/latest/USD';

interface IpGeoEntry {
  country: string;
  timezone: string;
  expires: number;
}

// IP geolocation cache (separate from main cache to avoid serialization issues)
const ipGeoCache = new Map<string, IpGeoEntry>();
const IP_GEO_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function fetchLocationFromIP(ip: string): Promise<{ country: string | null; timezone: string | null }> {
  if (ip === 'unknown' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: null, timezone: null };
  }

  const cached = ipGeoCache.get(ip);
  if (cached && cached.expires > Date.now()) {
    return { country: cached.country, timezone: cached.timezone };
  }

  try {
    const res = await fetch(`https://ipwho.is/${ip}?fields=country_code,timezone.id,success`, { next: { revalidate: 0 } });
    if (!res.ok) return { country: null, timezone: null };
    const data = await res.json();
    if (data.success && data.country_code) {
      const country = data.country_code.toUpperCase();
      const timezone = data.timezone?.id || '';
      ipGeoCache.set(ip, { country, timezone, expires: Date.now() + IP_GEO_TTL });
      return { country, timezone };
    }
  } catch {
    // Fail silently, fallback to other methods
  }
  return { country: null, timezone: null };
}

async function fetchCountryFromIP(ip: string): Promise<string | null> {
  const loc = await fetchLocationFromIP(ip);
  return loc.country;
}

async function fetchTimezoneFromIP(ip: string): Promise<string | null> {
  const loc = await fetchLocationFromIP(ip);
  return loc.timezone;
}

async function fetchRates(): Promise<ExchangeRates> {
  const res = await fetch(FREE_API, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Currency API error: ${res.status}`);
  const data = await res.json();
  return {
    base: data.base_code || 'USD',
    rates: data.rates || {},
    updatedAt: Date.now(),
  };
}

export async function getExchangeRates(): Promise<ExchangeRates> {
  return cached('exchange_rates_v1', 60 * 60 * 1000, fetchRates);
}

export async function convertUsdToLocal(usdAmount: number, currencyCode: string): Promise<{ localAmount: number; rate: number }> {
  if (currencyCode === 'USD') return { localAmount: usdAmount, rate: 1 };
  const exchange = await getExchangeRates();
  const rate = exchange.rates[currencyCode.toUpperCase()];
  if (!rate) return { localAmount: usdAmount, rate: 1 }; // fallback
  return { localAmount: Math.round(usdAmount * rate * 100) / 100, rate };
}

export async function convertLocalToUsd(localAmount: number, currencyCode: string): Promise<{ usdAmount: number; rate: number }> {
  if (currencyCode === 'USD') return { usdAmount: localAmount, rate: 1 };
  const exchange = await getExchangeRates();
  const rate = exchange.rates[currencyCode.toUpperCase()];
  if (!rate) return { usdAmount: localAmount, rate: 1 };
  return { usdAmount: Math.round((localAmount / rate) * 100) / 100, rate };
}

export function detectCurrencyFromCountry(countryCode: string): string {
  const map: Record<string, string> = {
    US: 'USD', CA: 'CAD', GB: 'GBP', EU: 'EUR',
    PH: 'PHP', SG: 'SGD', MY: 'MYR', TH: 'THB',
    ID: 'IDR', VN: 'VND', JP: 'JPY', KR: 'KRW',
    CN: 'CNY', HK: 'HKD', TW: 'TWD', AU: 'AUD',
    NZ: 'NZD', IN: 'INR', PK: 'PKR', BD: 'BDT',
    BR: 'BRL', MX: 'MXN', AR: 'ARS', CL: 'CLP',
    CO: 'COP', PE: 'PEN', ZA: 'ZAR', NG: 'NGN',
    KE: 'KES', EG: 'EGP', AE: 'AED', SA: 'SAR',
    TR: 'TRY', RU: 'RUB', UA: 'UAH', PL: 'PLN',
    CZ: 'CZK', HU: 'HUF', RO: 'RON', SE: 'SEK',
    NO: 'NOK', DK: 'DKK', CH: 'CHF', CHN: 'CNY',
  };
  return map[countryCode.toUpperCase()] || 'USD';
}

export async function detectCountryFromRequest(request: Request): Promise<string> {
  // 1. Try IP geolocation (most accurate)
  const { getClientIP } = await import('@/lib/rate-limit');
  const clientIp = getClientIP(request);
  const ipCountry = await fetchCountryFromIP(clientIp);
  if (ipCountry) {
    return ipCountry;
  }

  // 2. Check various proxy/CDN country headers
  const countryHeaders = [
    'cf-ipcountry',
    'x-vercel-ip-country',
    'x-country-code',
    'x-nginx-ip-country',
    'x-geo-country',
    'x-real-ip-country',
  ];
  for (const h of countryHeaders) {
    const val = request.headers.get(h);
    if (val && val.trim().length >= 2) {
      return val.trim().toUpperCase();
    }
  }

  // 3. Fallback: parse Accept-Language
  const acceptLang = request.headers.get('accept-language');
  if (acceptLang) {
    const first = acceptLang.split(',')[0]?.trim();
    if (first) {
      // e.g. "en-US" or "tl-PH"
      const parts = first.split('-');
      if (parts.length >= 2) {
        const region = parts[parts.length - 1].trim().toUpperCase();
        // Be cautious with language-region combos: en-GB is common worldwide
        // Only trust the region if it's a strong signal (PH, SG, MY, etc.)
        const strongRegions = new Set(['PH', 'SG', 'MY', 'TH', 'ID', 'VN', 'JP', 'KR', 'CN', 'HK', 'TW', 'AU', 'NZ', 'IN', 'PK', 'BD', 'BR', 'MX', 'ZA', 'NG', 'KE', 'EG', 'AE', 'SA', 'RU', 'UA']);
        if (region.length === 2 && strongRegions.has(region)) {
          return region;
        }
      }
      // Language-only fallback mapping
      const langMap: Record<string, string> = {
        en: 'US', tl: 'PH', fil: 'PH', ja: 'JP', ko: 'KR',
        zh: 'CN', th: 'TH', vi: 'VN', ms: 'MY', id: 'ID',
        es: 'ES', de: 'DE', fr: 'FR', pt: 'BR', ru: 'RU',
        ar: 'SA', hi: 'IN', bn: 'BD', ur: 'PK', tr: 'TR',
        it: 'IT', pl: 'PL', nl: 'NL', sv: 'SE', da: 'DK',
        no: 'NO', fi: 'FI', cs: 'CZ', hu: 'HU', ro: 'RO',
        el: 'GR', he: 'IL', uk: 'UA', sk: 'SK', bg: 'BG',
        hr: 'HR', sr: 'RS', sl: 'SI', et: 'EE', lv: 'LV',
        lt: 'LT', sq: 'AL', mk: 'MK', ka: 'GE', az: 'AZ',
        fa: 'IR', ta: 'LK', te: 'IN', mr: 'IN', gu: 'IN',
        kn: 'IN', ml: 'IN', pa: 'IN', sw: 'KE', am: 'ET',
      };
      const lang = parts[0].toLowerCase();
      if (langMap[lang]) return langMap[lang];
    }
  }

  return 'US';
}

export async function detectTimezoneFromRequest(request: Request): Promise<string | null> {
  const { getClientIP } = await import('@/lib/rate-limit');
  const clientIp = getClientIP(request);
  return fetchTimezoneFromIP(clientIp);
}
