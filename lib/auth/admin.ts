import { userDB } from '@/lib/db';

export interface AdminCheckResult {
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export async function checkAdminPrivileges(accountName: string): Promise<AdminCheckResult> {
  const result = await userDB.query(
    `SELECT ISNULL(GameMasterType,0) as GameMasterType, ISNULL(GameMasterLevel,0) as GameMasterLevel
     FROM UserInfo WHERE AccountName = @accountName`,
    { accountName }
  );

  if (!result.recordset?.length) {
    return { isAdmin: false, isSuperAdmin: false };
  }

  const user = result.recordset[0];
  const isAdmin = user.GameMasterType === 1 && user.GameMasterLevel >= 3;
  const isSuperAdmin = user.GameMasterType === 1 && user.GameMasterLevel >= 4;

  return { isAdmin, isSuperAdmin };
}
