import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Log in to your Tale of Asia account to access the dashboard, manage characters, and top up coins.',
  robots: { index: false, follow: false },
  alternates: { canonical: 'https://taleofasia.com/login' },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
