# Admin Panel Access Guide

## Overview
The admin panel is accessible only to accounts with **GameMaster privileges**. Access is automatically granted to users with:
- **GameMasterType = 1**
- **GameMasterLevel = 4**

## How to Access the Admin Panel

### Method 1: From Dashboard (Recommended)
1. Log in to your account at `/login`
2. Navigate to your dashboard at `/dashboard`
3. If you have GameMaster privileges, you'll see an **"Admin Panel"** button in the Quick Actions section (red card with ⚔️ icon)
4. Click the button to access the admin panel at `/admin`

### Method 2: Direct URL
If you have GameMaster privileges, you can directly navigate to:
```
https://taleofconquest.com/admin
```

The system will automatically verify your permissions and grant access.

## Admin Panel Features

### 1. Website Configuration
- Manage website settings
- Configure API keys
- Enable/disable maintenance mode
- Update server information

### 2. Game Configuration
- Adjust game rates
- Manage events
- Configure server settings
- Update game parameters

### 3. User Management
- View all user accounts
- Manage user bans
- Adjust user credits
- Monitor account activity

### 4. Payment Management
- View all transactions
- Manage payment gateways
- Process refunds
- Monitor payment status

### 5. Audit Logs
- View system logs
- Track user activity
- Monitor admin actions
- Review security events

### 6. Event Management
- Create new events
- Schedule game events
- Manage event rewards
- Update event status

## Technical Details

### Authentication Flow

1. **Login**: User logs in with credentials
   - Credentials are verified against `UserInfo` table
   - Session is created with JWT token

2. **Admin Check**: When accessing dashboard or admin panel
   - System calls `/api/admin/check` endpoint
   - Checks `GameMasterType` and `GameMasterLevel` from `UserInfo`
   - Returns `isAdmin: true` if both conditions are met

3. **Access Control**:
   - Admin panel link appears in dashboard only if `isAdmin = true`
   - Direct access to `/admin` is protected by the same check
   - Unauthorized users are redirected to dashboard

### Database Requirements

The system checks the following fields in the `UserInfo` table:

```sql
SELECT GameMasterType, GameMasterLevel 
FROM UserInfo 
WHERE AccountName = @username
```

**Conditions for Admin Access:**
- `GameMasterType = 1` (GameMaster type)
- `GameMasterLevel = 4` (Maximum level)

### API Endpoints

#### Check Admin Status
```
GET /api/admin/check
```

**Response (Admin):**
```json
{
  "isAdmin": true
}
```

**Response (Non-Admin):**
```json
{
  "isAdmin": false
}
```

## Granting Admin Access

To grant admin access to a user:

1. **Update UserInfo table:**
```sql
UPDATE UserInfo 
SET GameMasterType = 1, GameMasterLevel = 4 
WHERE AccountName = 'username'
```

2. **User logs out and logs back in** to refresh session

3. **Admin panel link appears** in dashboard

## Security Notes

- ✅ Admin access is verified on every request
- ✅ All admin actions are logged in audit logs
- ✅ Session-based authentication with JWT tokens
- ✅ Admin panel requires active login session
- ✅ Unauthorized access attempts are rejected with 403 Forbidden

## Troubleshooting

### Admin Panel Link Not Showing
- **Issue**: User has GameMaster privileges but link doesn't appear
- **Solution**: 
  1. Log out completely
  2. Clear browser cache
  3. Log back in
  4. Refresh dashboard page

### Access Denied Error
- **Issue**: Getting 403 Forbidden when accessing admin panel
- **Solution**:
  1. Verify `GameMasterType = 1` in database
  2. Verify `GameMasterLevel = 4` in database
  3. Check if account is banned (`BanStatus = 0`)
  4. Ensure account is activated (`Flag = 98`)

### Can't Log In
- **Issue**: Account won't log in
- **Solution**:
  1. Check if account is banned (`BanStatus = 1`)
  2. Check if account is activated (`Flag = 98`)
  3. Verify password is correct
  4. Check if account exists in UserInfo table

## Files Modified

- `/app/api/admin/check/route.ts` - Updated to check GameMasterType and GameMasterLevel
- `/app/dashboard/page.tsx` - Added admin panel link for GameMasters
- `/app/admin/page.tsx` - MMORPG-themed admin dashboard

## Related Documentation

- [Design System](./DESIGN_SYSTEM.md) - UI/UX design guidelines
- [MMORPG Theme](./MMORPG_THEME.md) - Theme implementation details
