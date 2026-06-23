import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Tale of Asia',
  description: 'Learn about Tale of Asia, a free-to-play dark fantasy MMORPG inspired by Asian mythology. Discover the lore, features, and world that awaits you.',
  alternates: { canonical: 'https://taleofasia.com/info/about' },
  openGraph: {
    title: 'About — Tale of Asia',
    description: 'Discover the world of Tale of Asia, a dark fantasy MMORPG inspired by Asian mythology.',
    url: 'https://taleofasia.com/info/about',
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
