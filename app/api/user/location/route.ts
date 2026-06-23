import { NextRequest, NextResponse } from 'next/server';
import { detectCountryFromRequest, detectTimezoneFromRequest, detectCurrencyFromCountry, convertUsdToLocal } from '@/lib/currency';
import { getClientIP } from '@/lib/rate-limit';

const TIMEZONE_COUNTRY_MAP: Record<string, string> = {
  'Asia/Manila': 'PH', 'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY',
  'Asia/Bangkok': 'TH', 'Asia/Jakarta': 'ID', 'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN',
  'Asia/Hong_Kong': 'HK', 'Asia/Taipei': 'TW', 'Australia/Sydney': 'AU',
  'Pacific/Auckland': 'NZ', 'Asia/Kolkata': 'IN', 'Asia/Karachi': 'PK',
  'Asia/Dhaka': 'BD', 'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX',
  'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Moscow': 'RU',
  'Europe/Amsterdam': 'NL', 'Europe/Stockholm': 'SE', 'Europe/Copenhagen': 'DK',
  'Europe/Oslo': 'NO', 'Europe/Helsinki': 'FI', 'Europe/Prague': 'CZ',
  'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO', 'Europe/Warsaw': 'PL',
  'Europe/Athens': 'GR', 'Europe/Istanbul': 'TR', 'Africa/Cairo': 'EG',
  'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE', 'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA', 'America/Toronto': 'CA', 'America/New_York': 'US',
  'America/Los_Angeles': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
};

export async function GET(request: NextRequest) {
  try {
    let countryCode = await detectCountryFromRequest(request);

    // Client timezone override: if the browser reports a known timezone, force matching country
    const clientTz = request.nextUrl.searchParams.get('timezone') || '';
    if (clientTz && TIMEZONE_COUNTRY_MAP[clientTz]) {
      countryCode = TIMEZONE_COUNTRY_MAP[clientTz];
    }

    const currency = detectCurrencyFromCountry(countryCode);
    let localAmount = 0;
    let rate = 1;
    try {
      const conv = await convertUsdToLocal(1, currency);
      localAmount = conv.localAmount;
      rate = conv.rate;
    } catch {
      // If conversion fails, return 1:1
    }

    const detectedTz = await detectTimezoneFromRequest(request);
    const timezone = detectedTz || clientTz || null;

    return NextResponse.json({
      countryCode,
      currency,
      usdToLocalRate: rate,
      oneUsdInLocal: localAmount,
      detectedIp: getClientIP(request),
      timezone,
      timezoneHint: clientTz || null,
    });
  } catch {
    return NextResponse.json({ countryCode: 'US', currency: 'USD', usdToLocalRate: 1, oneUsdInLocal: 1 });
  }
}
