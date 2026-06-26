import { NextResponse } from 'next/server';
import { gameDB, webDB } from '@/lib/db';
import { buildCategorySQL, MAIN_CATEGORIES, getItemType } from '@/lib/item-types';

const ITEM_QUERY = `
  SELECT
    sItemID, szItemName, szLastCategory, szItemPath,
    iLevel, iClass, iWidth, iHeight, iWeight, iSalePrice,
    IntegrityMin, IntegrityMax,
    OrganicMin, OrganicMax,
    FireMin, FireMax,
    FrostMin, FrostMax,
    LightningMin, LightningMax,
    PoisonMin, PoisonMax,
    AttackPower1Min, AttackPower1Max,
    AttackPower2Min, AttackPower2Max,
    iAttackRange, iAttackSpeed,
    AttackRatingMin, AttackRatingMax,
    iCritical,
    BlockRatingMin, BlockRatingMax,
    AbsorbMin, AbsorbMax,
    DefenseMin, DefenseMax,
    iPotionStorage, iPotionCount,
    HPRegenMin, HPRegenMax,
    MPRegenMin, MPRegenMax,
    STMRegenMin, STMRegenMax,
    AddHPMin, AddHPMax,
    AddMPMin, AddMPMax,
    AddSTMMin, AddSTMMax,
    sHPRecoveryMin, sHPRecoveryMax,
    sMPRecoveryMin, sMPRecoveryMax,
    sSPRecoveryMin, sSPRecoveryMax,
    RunSpeedMin, RunSpeedMax,
    AddSpecRunSpeedMin, AddSpecRunSpeedMax,
    AddSpecAbsorbMin, AddSpecAbsorbMax,
    AddSpecDefenseMin, AddSpecDefenseMax,
    iSpecAttackSpeed, iSpecCritical,
    iSpecAttackPowerDivMin, iSpecAttackPowerDivMax,
    SpecAttackRatingLevelMin, SpecAttackRatingLevelMax,
    fSpecHPRegen,
    AddSpecMPRegenMin, AddSpecMPRegenMax,
    fSpecSPRegen,
    fSpecBlockRating,
    iSpecAttackRange,
    iStrength, iSpirit, iTalent, iAgility, iHealth,
    JobBitCodeRandom1, JobBitCodeRandom2, JobBitCodeRandom3,
    JobBitCodeRandom4, JobBitCodeRandom5, JobBitCodeRandom6,
    JobBitCodeRandom7, JobBitCodeRandom8, JobBitCodeRandom9,
    JobBitCodeRandom10
  FROM ItemList
  WHERE 1=1
`;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || '';
    const search = searchParams.get('search') || '';

    // Get visible items from WebDB (composite key: sItemID + szItemName)
    const visResult = await webDB.query(
      'SELECT sItemID, szItemName FROM ItemVisibility WHERE IsVisible = 1'
    );
    const visibleKeys = new Set(visResult.recordset.map((r: any) => `${r.sItemID}|${r.szItemName}`));

    if (visibleKeys.size === 0) {
      return NextResponse.json({ items: [], categories: [] });
    }

    // Build query with optional category filter
    let query = ITEM_QUERY;
    const params: Record<string, any> = {};

    // Add visibility filter using composite key
    // We filter in JS since SQL doesn't support composite IN easily
    const sub = searchParams.get('sub') || '';
    if (category) {
      const { clause, params: catParams } = buildCategorySQL(category, sub || undefined);
      query += clause;
      Object.assign(params, catParams);
    }

    // Add search filter
    if (search) {
      query += ` AND szItemName LIKE @search`;
      params.search = `%${search}%`;
    }

    query += ` ORDER BY szLastCategory, iLevel, szItemName`;

    const result = await gameDB.query(query, params);

    // Filter by visibility using composite key (sItemID + szItemName)
    const allItems = result.recordset.filter((item: any) =>
      visibleKeys.has(`${item.sItemID}|${item.szItemName}`)
    );

    // Build sub-category counts for the active main category
    let subCategories: Array<{ key: string; label: string; count: number }> = [];
    if (category) {
      const mainCat = MAIN_CATEGORIES.find(c => c.key === category);
      if (mainCat) {
        subCategories = mainCat.subs.map((sub) => {
          const count = allItems.filter((item: any) => {
            const typeInfo = getItemType(item.szLastCategory);
            return typeInfo?.sub?.toLowerCase() === sub.key;
          }).length;
          return { key: sub.key, label: sub.label, count };
        });
      }
    }

    const items = allItems.map((item: any) => {
      const typeInfo = getItemType(item.szLastCategory);
      return {
        ...item,
        mainCategory: typeInfo?.main || 'other',
        subCategory: typeInfo?.sub || 'Other',
        imageUrl: `/items/it${item.szLastCategory.toLowerCase()}.png`,
      };
    });

    return NextResponse.json({
      items,
      mainCategories: MAIN_CATEGORIES.map(c => ({
        key: c.key,
        label: c.label,
        subs: c.subs.map(s => ({ key: s.key, label: s.label })),
      })),
      subCategories,
    });
  } catch (error: any) {
    console.error('[API /items] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
}
