import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Register for a free Tale of Asia account and start your adventure in this dark fantasy MMORPG inspired by Asian mythology.',
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://taleofasia.com/register' },
  openGraph: {
    title: 'Create Your Free Account — Tale of Asia',
    description: 'Join Tale of Asia, a free-to-play dark fantasy MMORPG. Register now and forge your legend.',
    url: 'https://taleofasia.com/register',
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
