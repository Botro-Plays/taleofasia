import type { Metadata } from "next";
import { Cinzel, Inter, JetBrains_Mono, ZCOOL_XiaoWei } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

const cinzel = Cinzel({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const zcoolXiaoWei = ZCOOL_XiaoWei({
  variable: "--font-asian",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://taleofasia.com'),
  title: {
    default: "Tale of Asia — Forge Your Legend | Free MMORPG",
    template: "%s | Tale of Asia",
  },
  description: "Tale of Asia is a free-to-play dark fantasy MMORPG. Battle ancient warriors, conquer realms, and forge your legend in a world inspired by Asian mythology.",
  keywords: [
    'Tale of Asia', 'ToA', 'MMORPG', 'free MMORPG', 'online game', 'dark fantasy MMORPG',
    'Asian MMORPG', 'RPG online', 'multiplayer game', 'PC game', 'free to play',
    'server status', 'rankings', 'character rankings', 'PvP MMORPG',
  ],
  authors: [{ name: 'Tale of Asia Team' }],
  creator: 'Tale of Asia',
  publisher: 'Tale of Asia',
  applicationName: 'Tale of Asia',
  category: 'Games',
  classification: 'Games',
  formatDetection: { telephone: false, address: false, email: false },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: "Tale of Asia — Forge Your Legend",
    description: "Play Tale of Asia Now! A Dark Fantasy Free-to-Play MMORPG inspired by Asian mythology.",
    url: "https://taleofasia.com/",
    siteName: "Tale of Asia",
    images: [
      {
        url: "/images/taleofasia-logo.png",
        width: 512,
        height: 512,
        alt: "Tale of Asia Logo",
      },
    ],
    locale: 'en_US',
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tale of Asia — Forge Your Legend",
    description: "Play Tale of Asia Now! A Dark Fantasy Free-to-Play MMORPG.",
    images: ["/images/taleofasia-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  alternates: {
    canonical: "https://taleofasia.com/",
  },
  other: {
    'theme-color': '#0a0a0e',
    'msapplication-TileColor': '#0a0a0e',
    'msapplication-config': '/browserconfig.xml',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: 'Tale of Asia',
    description: 'A free-to-play dark fantasy MMORPG inspired by Asian mythology.',
    applicationCategory: 'Game',
    operatingSystem: 'Windows',
    genre: ['MMORPG', 'RPG', 'Fantasy'],
    url: 'https://taleofasia.com/',
    image: 'https://taleofasia.com/images/taleofasia-logo.png',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Tale of Asia',
      url: 'https://taleofasia.com/',
    },
  };

  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${inter.variable} ${jetbrainsMono.variable} ${zcoolXiaoWei.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{ backgroundColor: 'var(--toa-void)', color: 'var(--toa-bone)' }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
