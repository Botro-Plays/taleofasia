export interface ItemTypeMapping {
  main: string;
  sub: string;
  prefix: string;
}

export const ITEM_TYPE_MAP: Record<string, ItemTypeMapping> = {
  'WA':  { main: 'weapons',     sub: 'Axes',       prefix: 'WA' },
  'WC':  { main: 'weapons',     sub: 'Claws',      prefix: 'WC' },
  'WH':  { main: 'weapons',     sub: 'Hammers',    prefix: 'WH' },
  'WM':  { main: 'weapons',     sub: 'Wands',      prefix: 'WM' },
  'WP':  { main: 'weapons',     sub: 'Scythes',    prefix: 'WP' },
  'WS1': { main: 'weapons',     sub: 'Bows',       prefix: 'WS1' },
  'WS2': { main: 'weapons',     sub: 'Swords',     prefix: 'WS2' },
  'WT':  { main: 'weapons',     sub: 'Javelins',   prefix: 'WT' },
  'WN':  { main: 'weapons',     sub: 'Phantoms',   prefix: 'WN' },
  'WD':  { main: 'weapons',     sub: 'Daggers',    prefix: 'WD' },

  'DA1': { main: 'defenses',    sub: 'Armors',     prefix: 'DA1' },
  'DA2': { main: 'defenses',    sub: 'Robes',      prefix: 'DA2' },
  'DB':  { main: 'defenses',    sub: 'Boots',      prefix: 'DB' },
  'DG':  { main: 'defenses',    sub: 'Gauntlets',  prefix: 'DG' },
  'DS':  { main: 'defenses',    sub: 'Shields',    prefix: 'DS' },
  'OA2': { main: 'defenses',    sub: 'Bracelets',  prefix: 'OA2' },
  'OM':  { main: 'defenses',    sub: 'Orbs',       prefix: 'OM' },

  'OA1': { main: 'accessories', sub: 'Amulets',    prefix: 'OA1' },
  'OR':  { main: 'accessories', sub: 'Rings',      prefix: 'OR' },
  'OS':  { main: 'accessories', sub: 'Sheltoms',   prefix: 'OS' },
  'OE':  { main: 'accessories', sub: 'Earrings',   prefix: 'OE' },

  'CA':  { main: 'costumes',    sub: 'Costumes',   prefix: 'CA' },
};

export function getItemType(szLastCategory: string): ItemTypeMapping | null {
  if (!szLastCategory || szLastCategory.length < 3) return null;
  const upper = szLastCategory.toUpperCase();

  const three = upper.substring(0, 3);
  if (ITEM_TYPE_MAP[three]) return ITEM_TYPE_MAP[three];

  const two = upper.substring(0, 2);
  if (ITEM_TYPE_MAP[two]) return ITEM_TYPE_MAP[two];

  return null;
}

export function getMainCategory(szLastCategory: string): string | null {
  return getItemType(szLastCategory)?.main || null;
}

export function getSubCategory(szLastCategory: string): string | null {
  return getItemType(szLastCategory)?.sub || null;
}

export function getPrefixesForMain(main: string): string[] {
  return Object.values(ITEM_TYPE_MAP)
    .filter(m => m.main === main)
    .map(m => m.prefix);
}

export function getPrefixForSub(main: string, subLower: string): string | null {
  const found = Object.values(ITEM_TYPE_MAP)
    .find(m => m.main === main && m.sub.toLowerCase() === subLower);
  return found?.prefix || null;
}

export interface MainCategoryInfo {
  key: string;
  label: string;
  subs: Array<{ key: string; label: string; prefix: string }>;
}

export const MAIN_CATEGORIES: MainCategoryInfo[] = [
  {
    key: 'weapons',
    label: 'Weapons',
    subs: Object.values(ITEM_TYPE_MAP)
      .filter(m => m.main === 'weapons')
      .map(m => ({ key: m.sub.toLowerCase(), label: m.sub, prefix: m.prefix }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  },
  {
    key: 'defenses',
    label: 'Defenses',
    subs: Object.values(ITEM_TYPE_MAP)
      .filter(m => m.main === 'defenses')
      .map(m => ({ key: m.sub.toLowerCase(), label: m.sub, prefix: m.prefix }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  },
  {
    key: 'accessories',
    label: 'Accessories',
    subs: Object.values(ITEM_TYPE_MAP)
      .filter(m => m.main === 'accessories')
      .map(m => ({ key: m.sub.toLowerCase(), label: m.sub, prefix: m.prefix }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  },
  {
    key: 'costumes',
    label: 'Costumes',
    subs: Object.values(ITEM_TYPE_MAP)
      .filter(m => m.main === 'costumes')
      .map(m => ({ key: m.sub.toLowerCase(), label: m.sub, prefix: m.prefix }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  },
];

export function buildCategorySQL(main: string, sub?: string): { clause: string; params: Record<string, string> } {
  if (sub) {
    const prefix = getPrefixForSub(main, sub);
    if (!prefix) return { clause: ' AND 1=0', params: {} };
    return {
      clause: ` AND szLastCategory LIKE @prefix + '%'`,
      params: { prefix },
    };
  }

  const prefixes = getPrefixesForMain(main);
  if (prefixes.length === 0) return { clause: ' AND 1=0', params: {} };

  const clause = ` AND (${prefixes.map((_, i) => `szLastCategory LIKE @p${i} + '%'`).join(' OR ')})`;
  const params: Record<string, string> = {};
  prefixes.forEach((p, i) => { params[`p${i}`] = p; });

  return { clause, params };
}
