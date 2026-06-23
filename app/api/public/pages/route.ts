import { NextResponse } from 'next/server';
import { webDB } from '@/lib/db';
import { sanitizeHtml, escapeHtml } from '@/lib/sanitize';

const defaultPages: Record<string, { title: string; content: string }> = {
  downloads: {
    title: 'Downloads',
    content:
      '<div class="space-y-8">' +
      '<p class="text-slate-300">Welcome to <b>Tale of Asia</b>! Download the latest client below. If a mirror is slow, try another.</p>' +
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">' +
      '<a href="https://www.mediafire.com/file/hgvghxbgt81dblj/ConquestPT_Full_Client_v1077.rar/file" target="_blank" rel="noopener" class="block px-5 py-4 rounded-lg border-2 border-[var(--color-royal-gold)] text-[var(--color-royal-gold)] hover:bg-[var(--color-royal-gold)]/10">Mediafire • Full v1077 (2.35 GB)</a>' +
      '<a href="https://drive.google.com/file/d/1M3DbePDH4o4iWM0XIlkYspKLrQMgiFKC/view?usp=drive_link" target="_blank" rel="noopener" class="block px-5 py-4 rounded-lg border-2 border-[var(--color-ancient-bronze)] text-[var(--color-ancient-bronze)] hover:bg-[var(--color-ancient-bronze)]/10">Google Drive • Full v1077 (2.35 GB)</a>' +
      '<a href="https://mega.nz/file/cnQimBoI#N9Rc_8Pr23KhOpzVy0FY4b2-SAD8safrTJ51HcElIIk" target="_blank" rel="noopener" class="block px-5 py-4 rounded-lg border-2 border-cyan-600 text-cyan-300 hover:bg-cyan-600/10">Mega • Full v1077 (2.35 GB)</a>' +
      '</div>' +
      '<div class="metallic-card p-4 border-2 border-[var(--color-dark-steel)]">' +
      '<h3 class="text-xl font-semibold text-white mb-2">System Requirements</h3>' +
      '<div class="overflow-x-auto">' +
      '<table class="min-w-full text-sm text-slate-300">' +
      '<thead><tr class="text-left text-slate-400"><th class="px-3 py-2">Category</th><th class="px-3 py-2">Minimum</th><th class="px-3 py-2">Recommended</th><th class="px-3 py-2">Optimal</th></tr></thead>' +
      '<tbody>' +
      '<tr><td class="px-3 py-2 font-semibold">CPU</td><td class="px-3 py-2">Intel i3 (3.0+ GHz)</td><td class="px-3 py-2">Intel i5 (3.0+ GHz)</td><td class="px-3 py-2">Ryzen 5 (3.0+ GHz)</td></tr>' +
      '<tr><td class="px-3 py-2 font-semibold">Memory</td><td class="px-3 py-2">4 GB</td><td class="px-3 py-2">8 GB</td><td class="px-3 py-2">16 GB</td></tr>' +
      '<tr><td class="px-3 py-2 font-semibold">Graphics</td><td class="px-3 py-2">Radeon iGPU / RX 650+</td><td class="px-3 py-2">NVIDIA GTX 960+</td><td class="px-3 py-2">NVIDIA RTX 2060 Ti</td></tr>' +
      '<tr><td class="px-3 py-2 font-semibold">OS</td><td class="px-3 py-2">Windows 7</td><td class="px-3 py-2">Windows 8 / Vista</td><td class="px-3 py-2">Windows 10 (64-bit)</td></tr>' +
      '<tr><td class="px-3 py-2 font-semibold">DirectX</td><td class="px-3 py-2">10</td><td class="px-3 py-2">11</td><td class="px-3 py-2">12</td></tr>' +
      '<tr><td class="px-3 py-2 font-semibold">Storage</td><td class="px-3 py-2">HDD 10 GB+</td><td class="px-3 py-2">HDD 50 GB+</td><td class="px-3 py-2">SSD 10 GB+</td></tr>' +
      '</tbody>' +
      '</table>' +
      '</div>' +
      '</div>' +
      '<div class="metallic-card p-4 border-2 border-[var(--color-dark-steel)]">' +
      '<h3 class="text-xl font-semibold text-white mb-2">How to Install</h3>' +
      '<ol class="list-decimal list-inside text-slate-300 space-y-1">' +
      '<li>Download the client from a mirror above.</li>' +
      '<li>Extract and run the launcher.</li>' +
      '<li>Create an account and login.</li>' +
      '</ol>' +
      '<p class="mt-3 text-slate-400">Tip: Add the <b>game folder</b>, <b>game.exe</b>, and <b>Launcher.exe</b> to your antivirus exclusions.</p>' +
      '</div>' +
      '</div>',
  },
  'getting-started': {
    title: 'Getting Started',
    content:
      '<div class="space-y-4">' +
      '<p class="text-slate-300">New here? This guide covers account creation, basic controls, and your first quests.</p>' +
      '<h3 class="text-lg font-semibold text-white">Account</h3>' +
      '<p class="text-slate-300">Register, verify your email, then login to the game.</p>' +
      '<h3 class="text-lg font-semibold text-white">First Steps</h3>' +
      '<p class="text-slate-300">Pick a class, follow the tutorial, and talk to early NPCs.</p>' +
      '</div>',
  },
  'server-rules': {
    title: 'Server Rules',
    content:
      '<div class="space-y-3">' +
      '<p class="text-slate-300">Be respectful. No cheating, botting, or harassment.</p>' +
      '<ul class="list-disc list-inside text-slate-300 space-y-1">' +
      '<li>No third-party tools.</li>' +
      '<li>No real-money trading.</li>' +
      '<li>Follow GM instructions.</li>' +
      '</ul>' +
      '</div>',
  },
  about: {
    title: 'About',
    content:
      '<div class="space-y-3">' +
      '<p class="text-slate-300">Tale of Asia is a classic-inspired MMORPG experience.</p>' +
      '<p class="text-slate-300">Join the community and forge your legend.</p>' +
      '</div>',
  },
  'mix-list': {
    title: 'Mix List',
    content:
      '<div class="space-y-8">' +
      '<p class="text-slate-300">Reference guide for available item mixes. Data below is rendered live from the Mix List table; edit this intro in Admin → Pages → Mix List.</p>' +
      '<div class="metallic-card p-4 border-2 border-[var(--color-dark-steel)]">' +
      '<h3 class="text-xl font-semibold text-white mb-3">Aging Materials (Example)</h3>' +
      '<div class="overflow-x-auto">' +
      '<table class="min-w-full text-sm text-slate-300">' +
      '<thead><tr class="text-left text-slate-400">' +
      '<th class="px-3 py-2">Age</th><th class="px-3 py-2">Sheltom</th><th class="px-3 py-2">Stones</th><th class="px-3 py-2">Gold</th><th class="px-3 py-2">Notes</th>' +
      '</tr></thead>' +
      '<tbody>' +
      '<tr><td class="px-3 py-2 font-semibold">+1</td><td class="px-3 py-2">Vita</td><td class="px-3 py-2">1</td><td class="px-3 py-2">50,000</td><td class="px-3 py-2">Safe</td></tr>' +
      '<tr><td class="px-3 py-2 font-semibold">+2</td><td class="px-3 py-2">Vita</td><td class="px-3 py-2">2</td><td class="px-3 py-2">100,000</td><td class="px-3 py-2">Safe</td></tr>' +
      '<tr><td class="px-3 py-2 font-semibold">+3</td><td class="px-3 py-2">Vita</td><td class="px-3 py-2">3</td><td class="px-3 py-2">150,000</td><td class="px-3 py-2">—</td></tr>' +
      '</tbody>' +
      '</table>' +
      '</div>' +
      '</div>' +
      '<div class="metallic-card p-4 border-2 border-[var(--color-dark-steel)]">' +
      '<h3 class="text-xl font-semibold text-white mb-3">Potion Mixes (Example)</h3>' +
      '<ul class="list-disc list-inside text-slate-300 space-y-1">' +
      '<li>3x Small HP + Water → 1x Medium HP</li>' +
      '<li>3x Medium HP + Water → 1x Large HP</li>' +
      '<li>2x Mana + 1x Herb → Greater Mana</li>' +
      '</ul>' +
      '</div>' +
      '<div class="metallic-card p-4 border-2 border-[var(--color-dark-steel)]">' +
      '<h3 class="text-xl font-semibold text-white mb-3">Legend</h3>' +
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300 text-sm">' +
      '<div><div class="font-semibold mb-1">Attributes</div>' +
      '<ul class="list-disc list-inside space-y-0.5">' +
      '<li>Fire, Ice, Lightning, Poison, Organic</li>' +
      '<li>Critical, Attack Rating, Min/Max Damage, Attack Speed</li>' +
      '<li>Absorption, Defense, Block Rating, Run Speed</li>' +
      '<li>HP, MP, SP, HP/MP/SP Regen, Potion Count</li>' +
      '</ul></div>' +
      '<div><div class="font-semibold mb-1">Sheltoms</div>' +
      '<p>Lucidy, Sereneo, Fadeo, Sparky, Raident, Transparo, Murky, Devine, Celesto, Mirage, Inferna, Enigma, Bellum, NewSheltom13, NewSheltom14, NewSheltom15</p>' +
      '</div></div>' +
      '</div>' +
      '<div class="text-slate-400 text-xs">Tip: Replace the examples with your official mix formulas from the old website.</div>' +
      '</div>',
  },
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const slug = (url.searchParams.get('slug') || '').toLowerCase();
    if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

    const tableCheck = await webDB.query(
      `SELECT 1 AS HasTable FROM sys.tables WHERE name = N'WebPages'`
    );
    const hasTable = !!tableCheck.recordset?.length;

    if (slug === 'downloads' && hasTable) {
      try {
        const linksRes = await webDB.query(
          `SELECT TOP 1 Content FROM WebPages WHERE Slug = @slug`,
          { slug: 'downloads-links' }
        );
        const linksRow = linksRes.recordset?.[0];
        if (linksRow?.Content) {
          try {
            const parsed = JSON.parse(String(linksRow.Content || '{}')) as { links?: Array<{ label: string; url: string }> };
            const links = Array.isArray(parsed.links) ? parsed.links.filter(l => l && l.url) : [];
            if (links.length) {
              const grid = [
                '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">',
                ...links.map(l => {
                  const safeUrl = escapeHtml(l.url);
                  const safeLabel = escapeHtml(l.label || l.url);
                  return `<a href="${safeUrl}" target="_blank" rel="noopener" class="block px-5 py-4 rounded-lg border-2 border-[var(--color-royal-gold)]/60 text-[var(--color-royal-gold)] hover:bg-[var(--color-royal-gold)]/10">${safeLabel}</a>`;
                }),
                '</div>'
              ].join('');
              const content = sanitizeHtml([
                '<div class="space-y-8">',
                '<p class="text-slate-300">Welcome to <b>Tale of Asia</b>! Download the latest client below. If a mirror is slow, try another.</p>',
                grid,
                defaultPages.downloads.content.split('</div>').slice(1).join('</div>') ? defaultPages.downloads.content.split('</div>').slice(1).join('</div>') : '',
                '</div>'
              ].join(''));
              return NextResponse.json({ title: 'Downloads', content, updatedAt: null, source: 'db+links' });
            }
          } catch {}
        }
      } catch {}
    }

    if (hasTable) {
      const res = await webDB.query(
        `SELECT TOP 1 Slug, Title, Content, UpdatedAt FROM WebPages WHERE Slug = @slug`,
        { slug }
      );
      const row = res.recordset?.[0];
      if (row) {
        const title = row.Title || defaultPages[slug]?.title || slug;
        const rawContent = (row.Content !== null && row.Content !== undefined)
          ? row.Content
          : (defaultPages[slug]?.content || '');
        const content = sanitizeHtml(String(rawContent));
        return NextResponse.json({
          title,
          content,
          updatedAt: row.UpdatedAt || null,
          source: 'db',
        });
      }
    }

    const def = defaultPages[slug];
    if (!def) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ title: def.title, content: def.content, updatedAt: null, source: 'default' });
  } catch (e) {
    console.error('Public pages error:', e);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}
