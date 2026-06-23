import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    coins: number;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      coins: number;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    coins: number;
  }
}
