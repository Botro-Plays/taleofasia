'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/app/components/PageShell';
import { Save, Upload, Plus, Trash2 } from 'lucide-react';

interface PageItem { Slug: string; Title: string; Content?: string; UpdatedAt?: string; UpdatedBy?: string }

const presets = [
  { slug: 'downloads', title: 'Downloads' },
  { slug: 'getting-started', title: 'Getting Started' },
  { slug: 'server-rules', title: 'Server Rules' },
  { slug: 'about', title: 'About' },
  { slug: 'mix-list', title: 'Mix List' },
];

export default function AdminPages() {
  const { status } = useSession();
  const router = useRouter();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState(presets[0].slug);
  const [title, setTitle] = useState(presets[0].title);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [existing, setExisting] = useState<PageItem[]>([]);
  const [customSlug, setCustomSlug] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [dlLinks, setDlLinks] = useState<{ label: string; url: string }[]>([
    { label: 'Mediafire', url: '' },
    { label: 'Google Drive', url: '' },
    { label: 'Mega', url: '' },
  ]);
  const [dlLoading, setDlLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const init = useCallback(async () => {
    try {
      const chk = await fetch('/api/admin/check');
      const data = await chk.json();
      if (!data.isAdmin) { router.push('/dashboard'); return; }
      setIsSuperAdmin(!!data.isSuperAdmin);
      setLoading(false);
      // Fetch existing pages list (non-blocking)
      setListLoading(true);
      try {
        const res = await fetch('/api/admin/pages');
        const j = await res.json();
        if (res.ok) setExisting(Array.isArray(j.items) ? j.items : []);
      } catch {}
      setListLoading(false);
    } catch {
      router.push('/dashboard');
    }
  }, [router]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated') {
      const id = setTimeout(() => { void init(); }, 0);
      return () => clearTimeout(id);
    }
  }, [status, router, init]);

  useEffect(() => {
    (async () => {
      setError(''); setInfo('');
      try {
        const res = await fetch(`/api/admin/pages?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (!res.ok) { setError(data?.error || 'Failed to load'); setTitle(presets.find(p=>p.slug===slug)?.title||slug); setContent(''); return; }
        const item: PageItem | null = data.item || null;
        if (item) {
          setTitle(item.Title || presets.find(p=>p.slug===slug)?.title || slug);
          setContent(item.Content || '');
        } else {
          setTitle(presets.find(p=>p.slug===slug)?.title || slug);
          setContent('');
        }
      } catch {
        setError('Failed to load');
      }
    })();
  }, [slug]);

  // Fetch structured downloads links (once on mount)
  useEffect(() => {
    (async () => {
      try {
        setDlLoading(true);
        const r = await fetch('/api/admin/pages/downloads-links');
        const j = await r.json();
        if (r.ok && Array.isArray(j.links)) {
          const base = [
            { label: 'Mediafire', url: '' },
            { label: 'Google Drive', url: '' },
            { label: 'Mega', url: '' },
          ];
          // Merge base with returned links (preserve order: base first, then customs)
          const known = new Map<string, number>();
          base.forEach((b, i) => known.set(b.label.toLowerCase(), i));
          const temp = [...base];
          for (const l of j.links as { label: string; url: string }[]) {
            const key = String(l.label || '').toLowerCase();
            if (known.has(key)) {
              temp[known.get(key)!] = { label: l.label, url: l.url };
            } else if (l.url) {
              temp.push({ label: l.label || 'Mirror', url: l.url });
            }
          }
          setDlLinks(temp);
        }
      } finally {
        setDlLoading(false);
      }
    })();
  }, []);

  const onSave = async () => {
    setSaving(true); setError(''); setInfo('');
    try {
      const res = await fetch('/api/admin/pages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, title, content })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setInfo('Saved');
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <PageShell label="Admin" title="Pages" backHref="/admin" backLabel="Admin">
        <div className="toa-loading">Loading…</div>
      </PageShell>
    );
  }

  if (!isSuperAdmin) {
    return (
      <PageShell label="Admin" title="Pages" backHref="/admin" backLabel="Admin">
        <div className="toa-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--toa-bone)' }}>Only Super Admins can edit pages.</div>
      </PageShell>
    );
  }

  return (
    <PageShell label="Admin" title="Pages" backHref="/admin" backLabel="Admin">
      <div style={{ maxWidth: '64rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Helper Guide */}
        <div className="toa-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--toa-gold-bright)', marginBottom: '0.75rem' }}>How to publish CMS pages</div>
          <ul style={{ listStyle: 'disc', paddingLeft: '1.25rem', color: 'var(--toa-bone)', fontSize: '0.8rem', lineHeight: 1.6 }}>
            <li>To create a new page, enter a <b style={{ color: 'var(--toa-bone)' }}>Custom slug</b> (e.g., <span style={{ fontFamily: 'monospace', color: 'var(--toa-gold)' }}>faq</span>) and click <b style={{ color: 'var(--toa-bone)' }}>Load</b>.</li>
            <li>Fill in <b style={{ color: 'var(--toa-bone)' }}>Title</b> and <b style={{ color: 'var(--toa-bone)' }}>Content</b> (HTML allowed), then click <b style={{ color: 'var(--toa-bone)' }}>Save</b>.</li>
            <li>The page is immediately available at <span style={{ fontFamily: 'monospace', color: 'var(--toa-gold)' }}>/p/&lt;slug&gt;</span>, e.g., <span style={{ fontFamily: 'monospace', color: 'var(--toa-gold)' }}>/p/faq</span>.</li>
            <li>Your new page will appear under the top nav <b style={{ color: 'var(--toa-bone)' }}>Custom Pages</b> dropdown automatically (refresh may be needed).</li>
            <li>Note: the Custom Pages menu is cached for up to 60s after edits; saves now auto-invalidate that cache.</li>
            <li>For <b style={{ color: 'var(--toa-bone)' }}>Mix List</b> intro: clearing content here will intentionally hide the intro (no default fallback).</li>
          </ul>
        </div>

        <div className="toa-seal-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="toa-label-field">Preset</label>
              <select value={slug} onChange={(e)=>{ setSlug(e.target.value); }} className="toa-select">
                {presets.map(p => <option key={p.slug} value={p.slug}>{p.title} ({p.slug})</option>)}
              </select>
            </div>
            <div>
              <label className="toa-label-field">Existing (DB)</label>
              <select value="" onChange={(e)=>{ const v = e.target.value; if (v) setSlug(v); }} className="toa-select" disabled={listLoading || existing.length === 0}>
                <option value="">{listLoading ? 'Loading...' : (existing.length ? 'Select page...' : 'No pages yet')}</option>
                {existing.map((it) => <option key={it.Slug} value={it.Slug}>{it.Title || it.Slug}</option>)}
              </select>
            </div>
            <div>
              <label className="toa-label-field">Or custom slug</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input value={customSlug} onChange={(e)=>setCustomSlug(e.target.value)} placeholder="e.g. faq" className="toa-input" />
                <button onClick={()=>{ const v = customSlug.trim().toLowerCase(); if (!v) return; setSlug(v); }} className="toa-btn toa-btn-ghost toa-btn-sm">Load</button>
              </div>
            </div>
          </div>

          <div>
            <label className="toa-label-field">Title</label>
            <input value={title} onChange={(e)=>setTitle(e.target.value)} className="toa-input" />
          </div>

          <div>
            <label className="toa-label-field">Content (HTML allowed)</label>
            <textarea value={content} onChange={(e)=>setContent(e.target.value)} rows={16} className="toa-textarea" style={{ fontFamily: 'monospace' }} />
          </div>

          {slug === 'downloads' && (
            <div style={{ borderTop: '1px solid rgba(184,155,94,0.12)', paddingTop: '1rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--toa-bone)', marginBottom: '0.5rem' }}>Downloads Links (optional)</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)', marginBottom: '0.75rem' }}>These links power the buttons on the public Downloads page. Fill in any mirrors you have; you can also add custom ones.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {dlLinks.map((l, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <input value={l.label} onChange={(e)=> setDlLinks(prev => prev.map((x,i)=> i===idx? { ...x, label: e.target.value }: x))} placeholder="Label (e.g., Mediafire)" className="toa-input" style={{ maxWidth: '12rem' }} />
                    <input value={l.url} onChange={(e)=> setDlLinks(prev => prev.map((x,i)=> i===idx? { ...x, url: e.target.value }: x))} placeholder="https://..." className="toa-input" style={{ flex: 1 }} />
                    <button onClick={()=> setDlLinks(prev => prev.filter((_,i)=> i!==idx))} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ color: 'var(--toa-danger)' }}><Trash2 size={13} /></button>
                  </div>
                ))}
                <div>
                  <button onClick={()=> setDlLinks(prev => [...prev, { label: 'Mirror', url: '' }])} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Plus size={13} />&nbsp;Add Mirror</button>
                </div>
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>Upload patch/client file (auto-hosted at /downloads/... and added as a link)</div>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <input ref={fileRef} type="file" className="toa-input" style={{ flex: 1, padding: '0.5rem' }} />
                  <button
                    disabled={uploading}
                    onClick={async ()=>{
                      try {
                        if (!fileRef.current || !fileRef.current.files || fileRef.current.files.length === 0) return;
                        setUploading(true); setUploadProgress(0); setError(''); setInfo('');
                        const file = fileRef.current.files[0];
                        const fd = new FormData();
                        fd.append('file', file);

                        const res = await new Promise<{ ok: boolean; json: any; status: number; statusText: string; responseText: string }>((resolve, reject) => {
                          const xhr = new XMLHttpRequest();
                          xhr.open('POST', '/api/admin/pages/upload', true);
                          xhr.upload.addEventListener('progress', (evt) => {
                            if (evt.lengthComputable) {
                              const pct = Math.round((evt.loaded / evt.total) * 100);
                              setUploadProgress(pct);
                            }
                          });
                          xhr.addEventListener('load', () => {
                            const ct = xhr.getResponseHeader('content-type') || '';
                            let json = null;
                            try {
                              if (ct.includes('application/json')) {
                                json = JSON.parse(xhr.responseText);
                              }
                            } catch {
                              /* ignore parse failure */
                            }
                            resolve({ ok: xhr.status >= 200 && xhr.status < 300, json, status: xhr.status, statusText: xhr.statusText, responseText: xhr.responseText });
                          });
                          xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
                          xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
                          xhr.send(fd);
                        });

                        if (!res.ok) {
                          const msg = res.json?.error || res.json?.message || (res.responseText ? `Server returned ${res.status} ${res.statusText}: ${res.responseText.slice(0, 200)}` : `Failed to upload (${res.status})`);
                          throw new Error(msg);
                        }
                        if (!res.json) {
                          throw new Error(`Server returned ${res.status} with non-JSON response: ${res.responseText.slice(0, 200)}`);
                        }
                        const label = `Direct (${res.json.filename || 'file'})`;
                        setDlLinks(prev => [...prev, { label, url: res.json.url }]);
                        setInfo('Uploaded and added link');
                        if (fileRef.current) fileRef.current.value = '';
                      } catch (e: any) {
                        setError(e?.message || 'Upload failed');
                      } finally {
                        setUploading(false);
                        setUploadProgress(0);
                      }
                    }}
                    className="toa-btn toa-btn-ghost toa-btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', opacity: uploading ? 0.6 : 1 }}
                  >{uploading ? `Uploading ${uploadProgress}%` : <><Upload size={13} />&nbsp;Upload and add link</>}</button>
                </div>
                {uploading && (
                  <div style={{ width: '100%', background: 'rgba(107,101,119,0.3)', borderRadius: '9999px', height: '0.375rem' }}>
                    <div style={{ background: 'var(--toa-gold)', height: '0.375rem', borderRadius: '9999px', transition: 'width 0.2s', width: `${uploadProgress}%` }} />
                  </div>
                )}
              </div>

              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={async ()=>{
                  try {
                    setError(''); setInfo('');
                    const cleaned = dlLinks.filter(l => (l.label?.trim() || l.url?.trim()));
                    const r = await fetch('/api/admin/pages/downloads-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ links: cleaned }) });
                    const j = await r.json();
                    if (!r.ok) throw new Error(j?.error || 'Failed to save links');
                    setInfo('Saved download links');
                  } catch (e: any) {
                    setError(e?.message || 'Failed to save links');
                  }
                }} className="toa-btn toa-btn-ghost toa-btn-sm">{dlLoading ? 'Saving…' : 'Save Links'}</button>
                <div style={{ fontSize: '0.8rem', color: 'var(--toa-muted)' }}>Public page: <span style={{ color: 'var(--toa-gold)' }}>/downloads</span></div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={onSave} disabled={saving} className="toa-btn toa-btn-solid toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : <><Save size={13} />&nbsp;Save</>}</button>
            <button
              onClick={async () => {
                setError(''); setInfo('');
                try {
                  const res = await fetch('/api/admin/pages/init', { method: 'POST' });
                  const j = await res.json();
                  if (!res.ok) throw new Error(j?.error || 'Failed to initialize');
                  setInfo('Initialized WebPages table');
                  const r = await fetch(`/api/admin/pages?slug=${encodeURIComponent(slug)}`);
                  const d = await r.json();
                  if (r.ok) { setTitle(d.item?.Title || presets.find(p=>p.slug===slug)?.title || slug); setContent(d.item?.Content || ''); }
                } catch (e: any) {
                  setError(e?.message || 'Failed to initialize');
                }
              }}
              className="toa-btn toa-btn-ghost toa-btn-sm"
            >
              Initialize WebPages table
            </button>
            <button
              onClick={async () => {
                setError(''); setInfo('');
                try {
                  const res = await fetch('/api/admin/pages/seed', { method: 'POST' });
                  const j = await res.json();
                  if (!res.ok) throw new Error(j?.error || 'Failed to seed');
                  setInfo('Seeded default page contents');
                  const r = await fetch(`/api/admin/pages?slug=${encodeURIComponent(slug)}`);
                  const d = await r.json();
                  if (r.ok) { setTitle(d.item?.Title || presets.find(p=>p.slug===slug)?.title || slug); setContent(d.item?.Content || ''); }
                } catch (e: any) {
                  setError(e?.message || 'Failed to seed');
                }
              }}
              className="toa-btn toa-btn-ghost toa-btn-sm"
            >
              Seed Defaults
            </button>
            {error && <span className="toa-msg toa-msg-error" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}>{error}</span>}
            {info && <span className="toa-msg toa-msg-success" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}>{info}</span>}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
