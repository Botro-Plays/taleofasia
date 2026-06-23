import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Download Client',
  description: 'Download the latest Tale of Asia game client. Full client v1077 available via Mediafire, Google Drive, and Mega mirrors. Free to play.',
  alternates: { canonical: 'https://taleofasia.com/downloads' },
  openGraph: {
    title: 'Download Tale of Asia Client',
    description: 'Get the latest full client v1077 from multiple mirrors. Free to play MMORPG.',
    url: 'https://taleofasia.com/downloads',
  },
};

export default function DownloadsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
