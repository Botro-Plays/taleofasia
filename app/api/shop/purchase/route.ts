import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { webDB, logDB } from '@/lib/db';
import { invalidate } from '@/lib/cache';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.id;
    const body = await request.json();
    const shopItemId = Number(body?.shopItemId);

    if (!Number.isFinite(shopItemId)) {
      return NextResponse.json({ error: 'Invalid shop item ID' }, { status: 400 });
    }

    // Fetch the shop item
    const itemResult = await webDB.query(`
      SELECT ShopItemID, sItemID, szItemName, szLastCategory, PriceVP, IsActive
      FROM WebShopItems
      WHERE ShopItemID = @shopItemId
    `, { shopItemId });

    if (itemResult.recordset.length === 0) {
      return NextResponse.json({ error: 'Item not found in shop' }, { status: 404 });
    }

    const item = itemResult.recordset[0];
    if (!item.IsActive) {
      return NextResponse.json({ error: 'This item is no longer available' }, { status: 400 });
    }

    // Fetch user's VP balance
    const vpResult = await webDB.query(`
      SELECT VotePoints FROM WebVotePoints WHERE AccountName = @username
    `, { username });

    const currentVP = vpResult.recordset[0]?.VotePoints ?? 0;
    if (currentVP < item.PriceVP) {
      return NextResponse.json(
        { error: `Insufficient Vote Points. You have ${currentVP} VP, need ${item.PriceVP} VP.` },
        { status: 400 }
      );
    }

    // Deduct VP and record purchase
    const deductResult = await webDB.query(`
      UPDATE WebVotePoints
      SET VotePoints = VotePoints - @price, TotalSpent = TotalSpent + @price, UpdatedAt = GETDATE()
      WHERE AccountName = @username AND VotePoints >= @price
    `, { price: item.PriceVP, username });

    if (deductResult.rowsAffected[0] === 0) {
      return NextResponse.json({ error: 'Insufficient Vote Points or race condition detected.' }, { status: 400 });
    }

    // Record purchase in WebShopPurchases
    const purchaseResult = await webDB.query(`
      INSERT INTO WebShopPurchases (AccountName, ShopItemID, sItemID, szItemName, PriceVP, ItemCode, ItemSpec)
      OUTPUT INSERTED.PurchaseID
      VALUES (@username, @shopItemId, @sItemID, @szItemName, @priceVP, @itemCode, 0)
    `, {
      username,
      shopItemId,
      sItemID: item.sItemID,
      szItemName: item.szItemName,
      priceVP: item.PriceVP,
      itemCode: item.szLastCategory,
    });

    const purchaseId = purchaseResult.recordset[0]?.PurchaseID;

    // Insert into LogDB.dbo.ItemBox
    try {
      await logDB.query(`
        INSERT INTO ItemBox (AccountName, SenderName, ItemCode, ItemSpec, IsItem, Item, DateReceived, Date)
        VALUES (@username, 'Server', @itemCode, 0, 0, NULL, GETDATE(), GETDATE())
      `, { username, itemCode: item.szLastCategory });

      // Mark as delivered
      await webDB.query(`
        UPDATE WebShopPurchases SET Delivered = 1, DeliveredAt = GETDATE()
        WHERE PurchaseID = @purchaseId
      `, { purchaseId });
    } catch (deliveryErr) {
      console.error('[shop/purchase] ItemBox insert failed:', deliveryErr);
      // VP already deducted, purchase recorded — item will need manual delivery
      // Don't refund — admin can see undelivered purchases
    }

    // Invalidate caches
    invalidate('shop_items_public');
    invalidate(`votelogs:${username}`);

    // Fetch updated VP balance
    const updatedVP = await webDB.query(`
      SELECT VotePoints FROM WebVotePoints WHERE AccountName = @username
    `, { username });
    const newBalance = updatedVP.recordset[0]?.VotePoints ?? 0;

    return NextResponse.json({
      message: `Successfully purchased ${item.szItemName}! Item will appear in your in-game ItemBox.`,
      votePoints: newBalance,
      itemName: item.szItemName,
      pricePaid: item.PriceVP,
    });
  } catch (error) {
    console.error('Error during purchase:', error);
    return NextResponse.json({ error: 'Failed to complete purchase' }, { status: 500 });
  }
}
