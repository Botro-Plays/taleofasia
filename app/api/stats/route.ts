import { NextResponse } from 'next/server';
import { userDB } from '@/lib/db';

export async function GET() {
  try {
    const currentYear = new Date().getFullYear();
    const baseYear = 2024;
    const yearsLegacy = currentYear - baseYear;

    // Get active players count from UserInfo
    const result = await userDB.query(`
      SELECT COUNT(*) as count FROM UserInfo WHERE Flag = 98
    `);

    const activePlayers = result.recordset[0]?.count || 0;

    return NextResponse.json({
      yearsLegacy,
      activePlayers,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { yearsLegacy: 2, activePlayers: 0 },
      { status: 500 }
    );
  }
}
