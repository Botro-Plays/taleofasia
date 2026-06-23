import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Server Rules',
  description: 'Read the official Tale of Asia server rules. Fair play guidelines, prohibited actions, and punishment policies for all players.',
  alternates: { canonical: 'https://taleofasia.com/info/server-rules' },
  openGraph: {
    title: 'Server Rules — Tale of Asia',
    description: 'Official rules and policies for the Tale of Asia MMORPG server.',
    url: 'https://taleofasia.com/info/server-rules',
  },
};

export default function ServerRulesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
