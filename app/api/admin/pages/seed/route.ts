import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { userDB, webDB } from '@/lib/db';

function downloadsHtml() {
  const mediafire = 'https://www.mediafire.com/file/hgvghxbgt81dblj/ConquestPT_Full_Client_v1077.rar/file';
  const drive = 'https://drive.google.com/file/d/1M3DbePDH4o4iWM0XIlkYspKLrQMgiFKC/view?usp=drive_link';
  const mega = 'https://mega.nz/file/cnQimBoI#N9Rc_8Pr23KhOpzVy0FY4b2-SAD8safrTJ51HcElIIk';
  return `
  <div class="space-y-8">
    <p class="text-slate-300">Welcome to <b>Tale of Asia</b>! Download the latest client below. If a mirror is slow, try another.</p>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <a href="${mediafire}" target="_blank" rel="noopener" class="block px-5 py-4 rounded-lg border-2 border-[var(--color-royal-gold)] text-[var(--color-royal-gold)] hover:bg-[var(--color-royal-gold)]/10">
        Mediafire • Full v1077 (2.35 GB)
      </a>
      <a href="${drive}" target="_blank" rel="noopener" class="block px-5 py-4 rounded-lg border-2 border-[var(--color-ancient-bronze)] text-[var(--color-ancient-bronze)] hover:bg-[var(--color-ancient-bronze)]/10">
        Google Drive • Full v1077 (2.35 GB)
      </a>
      <a href="${mega}" target="_blank" rel="noopener" class="block px-5 py-4 rounded-lg border-2 border-cyan-600 text-cyan-300 hover:bg-cyan-600/10">
        Mega • Full v1077 (2.35 GB)
      </a>
    </div>

    <div class="metallic-card p-4 border-2 border-[var(--color-dark-steel)]">
      <h3 class="text-xl font-semibold text-white mb-2">System Requirements</h3>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm text-slate-300">
          <thead>
            <tr class="text-left text-slate-400">
              <th class="px-3 py-2">Category</th>
              <th class="px-3 py-2">Minimum</th>
              <th class="px-3 py-2">Recommended</th>
              <th class="px-3 py-2">Optimal</th>
            </tr>
          </thead>
          <tbody>
            <tr><td class="px-3 py-2 font-semibold">CPU</td><td class="px-3 py-2">Intel i3 (3.0+ GHz)</td><td class="px-3 py-2">Intel i5 (3.0+ GHz)</td><td class="px-3 py-2">Ryzen 5 (3.0+ GHz)</td></tr>
            <tr><td class="px-3 py-2 font-semibold">Memory</td><td class="px-3 py-2">4 GB</td><td class="px-3 py-2">8 GB</td><td class="px-3 py-2">16 GB</td></tr>
            <tr><td class="px-3 py-2 font-semibold">Graphics</td><td class="px-3 py-2">Radeon iGPU / RX 650+</td><td class="px-3 py-2">NVIDIA GTX 960+</td><td class="px-3 py-2">NVIDIA RTX 2060 Ti</td></tr>
            <tr><td class="px-3 py-2 font-semibold">OS</td><td class="px-3 py-2">Windows 7</td><td class="px-3 py-2">Windows 8 / Vista</td><td class="px-3 py-2">Windows 10 (64-bit)</td></tr>
            <tr><td class="px-3 py-2 font-semibold">DirectX</td><td class="px-3 py-2">10</td><td class="px-3 py-2">11</td><td class="px-3 py-2">12</td></tr>
            <tr><td class="px-3 py-2 font-semibold">Storage</td><td class="px-3 py-2">HDD 10 GB+</td><td class="px-3 py-2">HDD 50 GB+</td><td class="px-3 py-2">SSD 10 GB+</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="metallic-card p-4 border-2 border-[var(--color-dark-steel)]">
      <h3 class="text-xl font-semibold text-white mb-2">How to Install</h3>
      <ol class="list-decimal list-inside text-slate-300 space-y-1">
        <li>Download the client from a mirror above.</li>
        <li>Extract and run the launcher.</li>
        <li>Create an account and login.</li>
      </ol>
      <p class="mt-3 text-slate-400">Tip: Add the <b>game folder</b>, <b>game.exe</b>, and <b>Launcher.exe</b> to your antivirus exclusions.</p>
    </div>
  </div>`;
}

function gettingStartedHtml() {
  return `
  <div class="space-y-4">
    <p class="text-slate-300">New here? This guide covers account setup and your first session.</p>
    <h3 class="text-lg font-semibold text-white">1) Create Your Account</h3>
    <p class="text-slate-300">Register on the website, verify your email (if required), then login.</p>
    <h3 class="text-lg font-semibold text-white">2) Install the Game</h3>
    <p class="text-slate-300">Visit the <a class="text-[var(--color-royal-gold)] hover:underline" href="/downloads">Downloads</a> page and install the latest client.</p>
    <h3 class="text-lg font-semibold text-white">3) First Steps</h3>
    <p class="text-slate-300">Pick a class, follow the tutorial, and talk to early NPCs for gear and quests.</p>
  </div>`;
}

function serverRulesHtml() {
  return `
  <div class="space-y-3">
    <p class="text-slate-300">Help us keep the world fair and fun. Violations may result in suspensions or bans.</p>
    <ul class="list-disc list-inside text-slate-300 space-y-1">
      <li>No third‑party tools, bots, or exploits.</li>
      <li>No real‑money trading or account selling.</li>
      <li>Be respectful. No harassment or hate speech.</li>
      <li>Follow GM instructions at all times.</li>
    </ul>
  </div>`;
}

function aboutHtml() {
  return `
  <div class="space-y-3">
    <p class="text-slate-300">Tale of Asia is a classic‑inspired MMORPG with an active community and seasonal events.</p>
    <p class="text-slate-300">Join us for epic hunts, competitive rankings, and a nostalgic gameplay loop brought to modern hardware.</p>
  </div>`;
}

function mixListHtml() {
  return `
  <div class="space-y-8">
    <p class="text-slate-300">Reference guide for common mixes. This page is managed in the Admin CMS (Pages → Mix List). Update values to match current server settings.</p>

    <div class="metallic-card p-4 border-2 border-[var(--color-dark-steel)]">
      <h3 class="text-xl font-semibold text-white mb-3">Aging Materials (Example)</h3>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm text-slate-300">
          <thead><tr class="text-left text-slate-400">
            <th class="px-3 py-2">Age</th><th class="px-3 py-2">Sheltom</th><th class="px-3 py-2">Stones</th><th class="px-3 py-2">Gold</th><th class="px-3 py-2">Notes</th>
          </tr></thead>
          <tbody>
            <tr><td class="px-3 py-2 font-semibold">+1</td><td class="px-3 py-2">Vita</td><td class="px-3 py-2">1</td><td class="px-3 py-2">50,000</td><td class="px-3 py-2">Safe</td></tr>
            <tr><td class="px-3 py-2 font-semibold">+2</td><td class="px-3 py-2">Vita</td><td class="px-3 py-2">2</td><td class="px-3 py-2">100,000</td><td class="px-3 py-2">Safe</td></tr>
            <tr><td class="px-3 py-2 font-semibold">+3</td><td class="px-3 py-2">Vita</td><td class="px-3 py-2">3</td><td class="px-3 py-2">150,000</td><td class="px-3 py-2">—</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="metallic-card p-4 border-2 border-[var(--color-dark-steel)]">
      <h3 class="text-xl font-semibold text-white mb-3">Potion Mixes (Example)</h3>
      <ul class="list-disc list-inside text-slate-300 space-y-1">
        <li>3x Small HP + Water → 1x Medium HP</li>
        <li>3x Medium HP + Water → 1x Large HP</li>
        <li>2x Mana + 1x Herb → Greater Mana</li>
      </ul>
    </div>

    <div class="text-slate-400 text-xs">Tip: Replace the examples with your official mix formulas from the old website.</div>
  </div>`;
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const username = session.user.id;

    const adminCheck = await userDB.query(
      `SELECT GameMasterType, GameMasterLevel FROM UserInfo WHERE AccountName = @username`,
      { username }
    );
    if (!adminCheck.recordset?.length) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const user = adminCheck.recordset[0];
    const isSuperAdmin = user.GameMasterType === 1 && user.GameMasterLevel >= 4;
    if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Ensure table exists
    await webDB.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'WebPages')
      BEGIN
        CREATE TABLE WebPages (
          Slug nvarchar(100) NOT NULL PRIMARY KEY,
          Title nvarchar(200) NOT NULL,
          Content nvarchar(max) NULL,
          UpdatedAt datetime NOT NULL CONSTRAINT DF_WebPages_UpdatedAt DEFAULT(GETDATE()),
          UpdatedBy nvarchar(50) NULL
        )
      END
    `);

    await webDB.query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes WHERE name = N'IX_WebPages_UpdatedAt' AND object_id = OBJECT_ID(N'WebPages')
      )
      BEGIN
        CREATE INDEX IX_WebPages_UpdatedAt ON WebPages(UpdatedAt DESC)
      END
    `);

    const pages = [
      { slug: 'downloads', title: 'Downloads', content: downloadsHtml() },
      { slug: 'getting-started', title: 'Getting Started', content: gettingStartedHtml() },
      { slug: 'server-rules', title: 'Server Rules', content: serverRulesHtml() },
      { slug: 'about', title: 'About', content: aboutHtml() },
      { slug: 'mix-list', title: 'Mix List', content: mixListHtml() },
    ];

    for (const p of pages) {
      const exists = await webDB.query(`SELECT 1 AS X FROM WebPages WHERE Slug = @slug`, { slug: p.slug });
      if (exists.recordset?.length) {
        await webDB.query(
          `UPDATE WebPages SET Title = @title, Content = @content, UpdatedAt = GETDATE(), UpdatedBy = @by WHERE Slug = @slug`,
          { slug: p.slug, title: p.title, content: p.content, by: username }
        );
      } else {
        await webDB.query(
          `INSERT INTO WebPages (Slug, Title, Content, UpdatedAt, UpdatedBy) VALUES (@slug, @title, @content, GETDATE(), @by)`,
          { slug: p.slug, title: p.title, content: p.content, by: username }
        );
      }
    }

    return NextResponse.json({ ok: true, seeded: pages.map(p => p.slug) });
  } catch (e) {
    console.error('Seed pages error:', e);
    return NextResponse.json({ error: 'Failed to seed pages' }, { status: 500 });
  }
}
