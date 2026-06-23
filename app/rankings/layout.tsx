import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Player Rankings',
  description: 'View the top players in Tale of Asia. Level rankings, PvP leaderboard, Bellatra rankings, and Battle Royale standings.',
  alternates: { canonical: 'https://taleofasia.com/rankings' },
  openGraph: {
    title: 'Tale of Asia — Player Rankings',
    description: 'Top players by level, PvP, Bellatra, and Battle Royale. See who dominates the realm.',
    url: 'https://taleofasia.com/rankings',
  },
};

export default function RankingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
