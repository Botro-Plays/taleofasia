import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mix List — Item Crafting Guide',
  description: 'Browse the complete item mix list for Tale of Asia. Find crafting recipes, item combinations, and upgrade paths.',
  alternates: { canonical: 'https://taleofasia.com/mix-list' },
  openGraph: {
    title: 'Mix List — Tale of Asia',
    description: 'Complete item crafting and mix guide for Tale of Asia MMORPG.',
    url: 'https://taleofasia.com/mix-list',
  },
};

export default function MixListLayout({ children }: { children: React.ReactNode }) {
  return children;
}
