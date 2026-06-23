import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Getting Started Guide',
  description: 'New to Tale of Asia? Learn how to download the client, create an account, and start your adventure in this free-to-play dark fantasy MMORPG.',
  alternates: { canonical: 'https://taleofasia.com/info/getting-started' },
  openGraph: {
    title: 'Getting Started — Tale of Asia',
    description: 'Step-by-step guide to start playing Tale of Asia MMORPG.',
    url: 'https://taleofasia.com/info/getting-started',
  },
};

export default function GettingStartedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
