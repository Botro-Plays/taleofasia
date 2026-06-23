import type { NextAuthConfig } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { userDB, webDB } from '@/lib/db';
import { isRecaptchaEnabled, verifyRecaptchaToken } from '@/lib/recaptcha';
import type { JWT } from 'next-auth/jwt';
import type { Session } from 'next-auth';
import NextAuth from 'next-auth';

export const authOptions: NextAuthConfig = {
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
        recaptchaToken: { label: 'reCAPTCHA Token', type: 'text' },
      },
      async authorize(credentials) {
        console.log('[auth] authorize called with username:', credentials?.username, 'recaptchaToken length:', (credentials?.recaptchaToken as string)?.length || 0);

        if (!credentials?.username || !credentials?.password) {
          throw new Error('Username and password are required');
        }

        try {
          // Verify reCAPTCHA if enabled
          const captchaOn = await isRecaptchaEnabled();
          console.log('[auth] reCAPTCHA enabled:', captchaOn);
          if (captchaOn) {
            const token = credentials.recaptchaToken as string | undefined;
            console.log('[auth] reCAPTCHA token present:', !!token, 'length:', token?.length);
            if (!token) {
              throw new Error('reCAPTCHA verification required');
            }
            const valid = await verifyRecaptchaToken(token);
            console.log('[auth] reCAPTCHA validation result:', valid);
            if (!valid) {
              throw new Error('reCAPTCHA verification failed');
            }
          }
          // Check if user exists in UserInfo table (UserDB)
          const userResult = await userDB.query(
            `SELECT AccountName, Password, Email, Flag, BanStatus, Coins 
             FROM UserInfo WHERE AccountName = @username`,
            { username: credentials.username }
          );

          if (!userResult.recordset || userResult.recordset.length === 0) {
            throw new Error('Invalid username or password');
          }

          const user = userResult.recordset[0];

          // Check if account is activated using Flag column
          // Flag = 98 = activated, Flag = 64 = pending email verification
          if (user.Flag !== 98) {
            throw new Error('Account is not active. Please verify your email.');
          }

          // Check if account is banned (handle both string and number)
          if (user.BanStatus === '1' || user.BanStatus === 1) {
            throw new Error('Account is banned. Please contact support.');
          }

          // Verify password (assuming plain text comparison based on existing PHP code)
          // In production, you should hash passwords. For now, we'll do direct comparison
          // to maintain compatibility with existing system
          if (user.Password !== credentials.password) {
            throw new Error('Invalid username or password');
          }

          // Create or update web user preferences
          await webDB.query(`
            IF NOT EXISTS (SELECT 1 FROM WebUserPreferences WHERE AccountName = @username)
            BEGIN
              INSERT INTO WebUserPreferences (AccountName, LastLoginIP, LastLoginAt)
              VALUES (@username, @ip, GETDATE())
            END
            ELSE
            BEGIN
              UPDATE WebUserPreferences 
              SET LastLoginIP = @ip, LastLoginAt = GETDATE()
              WHERE AccountName = @username
            END
          `, { 
            username: credentials.username,
            ip: '127.0.0.1' // Will be updated with actual IP in production
          });

          // Log the login
          await webDB.query(`
            INSERT INTO WebAuditLogs (AccountName, Action, Details, IPAddress)
            VALUES (@username, 'LOGIN', 'User logged in successfully', @ip)
          `, {
            username: credentials.username,
            ip: '127.0.0.1'
          });

          return {
            id: user.AccountName,
            name: user.AccountName,
            email: user.Email,
            coins: user.Coins,
          };
        } catch (error) {
          console.error('Authorization error:', error);
          throw error;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user: any }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.coins = user.coins;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.coins = token.coins as number;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET!,
};

export const { handlers, auth } = NextAuth(authOptions);
