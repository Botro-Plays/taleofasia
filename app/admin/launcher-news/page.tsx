'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/app/components/PageShell';
import { Save, Plus, Trash2, Edit3, X, Eye, EyeOff, Upload, Bold, Italic, Link, ImageIcon } from 'lucide-react';

function markupToHtml(text: string): string {
  const html = text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;max-height:120px;margin:4px 0;display:block;border-radius:2px"/>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#B89B5E;text-decoration:underline">$1</a>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  return html
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 8px 0;line-height:1.6;font-size:0.82rem;color:#C8C2B6">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

interface NewsItem {
  id: number;
  title: string;
  body: string;
  category: string;
  isPublished: boolean;
  sortOrder: number;
  publishedAt: string;
  updatedAt: string;
  updatedBy: string;
}

const emptyForm = {
  id: 0,
  title: '',
  body: '',
  category: 'news',
  isPublished: true,
  sortOrder: 0,
};

export default function AdminLauncherNews() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [patchVersion, setPatchVersion] = useState('');
  const [patchEntries, setPatchEntries] = useState<{ version: string; file: string }[]>([]);
  const [versionSaving, setVersionSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/admin/launcher-news');
      const j = await res.json();
      if (res.ok && Array.isArray(j.items)) setItems(j.items);
    } catch {}
  };

  const fetchVersion = async () => {
    try {
      const res = await fetch('/api/admin/launcher-version');
      const j = await res.json();
      if (res.ok) {
        setPatchVersion(j.version || '');
        setPatchEntries(j.entries || []);
      }
    } catch {}
  };

  const init = useCallback(async () => {
    try {
      const chk = await fetch('/api/admin/check');
      const data = await chk.json();
      if (!data.isAdmin) { router.push('/dashboard'); return; }
      setIsSuperAdmin(!!data.isSuperAdmin);
      setLoading(false);
      await fetchItems();
      await fetchVersion();
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

  const onSave = async () => {
    setSaving(true); setError(''); setInfo('');
    try {
      const res = await fetch('/api/admin/launcher-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed');
      setInfo(form.id ? 'Updated' : 'Created');
      setForm(emptyForm);
      setEditing(false);
      await fetchItems();
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (item: NewsItem) => {
    setForm({
      id: item.id,
      title: item.title,
      body: item.body,
      category: item.category,
      isPublished: item.isPublished,
      sortOrder: item.sortOrder,
    });
    setEditing(true);
    setError(''); setInfo('');
  };

  const onDelete = async (id: number) => {
    if (!confirm('Delete this news entry?')) return;
    setError(''); setInfo('');
    try {
      const res = await fetch(`/api/admin/launcher-news?id=${id}`, { method: 'DELETE' });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed');
      setInfo('Deleted');
      await fetchItems();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete');
    }
  };

  const onSaveVersion = async () => {
    setVersionSaving(true); setError(''); setInfo('');
    try {
      const res = await fetch('/api/admin/launcher-version', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: patchVersion, entries: patchEntries }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed');
      setInfo('Patch version updated');
      await fetchVersion();
    } catch (e: any) {
      setError(e?.message || 'Failed to save version');
    } finally {
      setVersionSaving(false);
    }
  };

  const onCancel = () => {
    setForm(emptyForm);
    setEditing(false);
    setError(''); setInfo('');
  };

  if (status === 'loading' || loading) {
    return (
      <PageShell label="Admin" title="Launcher News" backHref="/admin" backLabel="Admin">
        <div className="toa-loading">Loading…</div>
      </PageShell>
    );
  }

  if (!isSuperAdmin) {
    return (
      <PageShell label="Admin" title="Launcher News" backHref="/admin" backLabel="Admin">
        <div className="toa-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--toa-bone)' }}>
          Only Super Admins can manage launcher news.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell label="Admin" title="Launcher News" backHref="/admin" backLabel="Admin">
      <div style={{ maxWidth: '64rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Patch Version Manager */}
        <div className="toa-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--toa-gold-bright)', marginBottom: '0.75rem' }}>
            Launcher Patch Version
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div>
              <label className="toa-label-field">Current Version</label>
              <input
                value={patchVersion}
                onChange={(e) => setPatchVersion(e.target.value)}
                placeholder="e.g. 1.0.0.0"
                className="toa-input"
                style={{ width: '12rem' }}
              />
            </div>
            <button
              onClick={onSaveVersion}
              disabled={versionSaving || !patchVersion.trim()}
              className="toa-btn toa-btn-solid toa-btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', opacity: (versionSaving || !patchVersion.trim()) ? 0.6 : 1 }}
            >
              {versionSaving ? 'Saving...' : <><Upload size={13} />&nbsp;Update Version</>}
            </button>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--toa-muted)', marginBottom: '0.5rem' }}>
            Update entries in <span style={{ fontFamily: 'monospace', color: 'var(--toa-gold)' }}>updateContents.xml</span>:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {patchEntries.map((entry, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  value={entry.version}
                  onChange={(e) => setPatchEntries(patchEntries.map((p, j) => j === i ? { ...p, version: e.target.value } : p))}
                  placeholder="version"
                  className="toa-input"
                  style={{ width: '8rem' }}
                />
                <input
                  value={entry.file}
                  onChange={(e) => setPatchEntries(patchEntries.map((p, j) => j === i ? { ...p, file: e.target.value } : p))}
                  placeholder="file.zip"
                  className="toa-input"
                  style={{ width: '12rem' }}
                />
                <button
                  onClick={() => setPatchEntries(patchEntries.filter((_, j) => j !== i))}
                  className="toa-btn toa-btn-ghost toa-btn-sm"
                  style={{ color: 'var(--toa-danger)' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={() => setPatchEntries([...patchEntries, { version: '', file: '' }])}
              className="toa-btn toa-btn-ghost toa-btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', width: 'fit-content' }}
            >
              <Plus size={13} />&nbsp;Add Patch Entry
            </button>
          </div>
        </div>

        {/* Helper */}
        <div className="toa-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--toa-gold-bright)', marginBottom: '0.75rem' }}>
            Launcher News &amp; Patch Notes
          </div>
          <ul style={{ listStyle: 'disc', paddingLeft: '1.25rem', color: 'var(--toa-bone)', fontSize: '0.8rem', lineHeight: 1.6 }}>
            <li>News entries appear in the launcher&apos;s center panel immediately after publishing.</li>
            <li>Use <b style={{ color: 'var(--toa-bone)' }}>Category</b> to organize items: <span style={{ fontFamily: 'monospace', color: 'var(--toa-gold)' }}>news</span> or <span style={{ fontFamily: 'monospace', color: 'var(--toa-gold)' }}>patch-notes</span>.</li>
            <li>Unpublished items are hidden from the launcher but remain in the database.</li>
            <li><b style={{ color: 'var(--toa-bone)' }}>Sort Order</b> controls display order (lower = first).</li>
          </ul>
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(184,155,94,0.06)', borderRadius: '0.375rem', borderLeft: '2px solid rgba(184,155,94,0.3)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--toa-gold)', marginBottom: '0.4rem' }}>Body markup reference (FlowDocument renderer)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem 1.5rem', fontSize: '0.75rem' }}>
              {[['**bold text**', 'Bold'], ['*italic text*', 'Italic'], ['[label](https://...)', 'Gold hyperlink'], ['![alt](https://...image)', 'Inline image'], ['blank line between text', 'New paragraph'], ['single newline', 'Line break']].map(([syn, desc]) => (
                <div key={syn} style={{ display: 'contents' }}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--toa-gold)' }}>{syn}</span>
                  <span style={{ color: 'var(--toa-muted)' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="toa-seal-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--toa-gold-bright)' }}>
              {editing ? 'Edit Entry' : 'New Entry'}
            </div>
            {editing && (
              <button onClick={onCancel} className="toa-btn toa-btn-ghost toa-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <X size={13} />&nbsp;Cancel
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="toa-label-field">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Patch v1.2.0"
                className="toa-input"
              />
            </div>
            <div>
              <label className="toa-label-field">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="toa-select"
              >
                <option value="news">News</option>
                <option value="patch-notes">Patch Notes</option>
                <option value="announcement">Announcement</option>
                <option value="event">Event</option>
              </select>
            </div>
            <div>
              <label className="toa-label-field">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })}
                className="toa-input"
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
              <label className="toa-label-field" style={{ margin: 0 }}>Body</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {([
                  { label: 'B', title: 'Bold (**text**)', before: '**', after: '**', placeholder: 'bold text', icon: <Bold size={11}/> },
                  { label: 'I', title: 'Italic (*text*)', before: '*', after: '*', placeholder: 'italic text', icon: <Italic size={11}/> },
                  { label: 'Link', title: 'Hyperlink', before: '[', after: '](https://)', placeholder: 'link text', icon: <Link size={11}/> },
                  { label: 'Img', title: 'Image', before: '![', after: '](https://)', placeholder: 'alt text', icon: <ImageIcon size={11}/> },
                ] as { label: string; title: string; before: string; after: string; placeholder: string; icon: React.ReactNode }[]).map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    title={btn.title}
                    className="toa-btn toa-btn-ghost toa-btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => {
                      const ta = bodyRef.current;
                      if (!ta) return;
                      const start = ta.selectionStart;
                      const end = ta.selectionEnd;
                      const selected = ta.value.slice(start, end) || btn.placeholder;
                      const newVal = ta.value.slice(0, start) + btn.before + selected + btn.after + ta.value.slice(end);
                      setForm({ ...form, body: newVal });
                      setTimeout(() => {
                        ta.focus();
                        ta.selectionStart = start + btn.before.length;
                        ta.selectionEnd = start + btn.before.length + selected.length;
                      }, 0);
                    }}
                  >{btn.icon}&nbsp;{btn.label}</button>
                ))}
                <button
                  type="button"
                  className="toa-btn toa-btn-ghost toa-btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: showPreview ? 'var(--toa-gold)' : undefined }}
                  onClick={() => setShowPreview(p => !p)}
                ><Eye size={11}/>&nbsp;{showPreview ? 'Edit' : 'Preview'}</button>
              </div>
            </div>
            {showPreview ? (
              <div
                style={{
                  minHeight: '10rem', padding: '0.75rem', borderRadius: '0.375rem',
                  border: '1px solid rgba(184,155,94,0.15)', background: 'rgba(12,10,18,0.7)',
                  fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--toa-bone)',
                }}
                dangerouslySetInnerHTML={{ __html: markupToHtml(form.body) || '<span style="color:#6B6577">Nothing to preview</span>' }}
              />
            ) : (
              <textarea
                ref={bodyRef}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={8}
                className="toa-textarea"
                placeholder="Describe the news or patch changes..."
                style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
              />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--toa-bone)' }}>
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
              />
              Published
            </label>
            <button
              onClick={onSave}
              disabled={saving || !form.title.trim()}
              className="toa-btn toa-btn-solid toa-btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', opacity: (saving || !form.title.trim()) ? 0.6 : 1 }}
            >
              {saving ? 'Saving...' : <><Save size={13} />&nbsp;{editing ? 'Update' : 'Create'}</>}
            </button>
            {!editing && (
              <button
                onClick={() => { setForm(emptyForm); setEditing(true); }}
                className="toa-btn toa-btn-ghost toa-btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Plus size={13} />&nbsp;New
              </button>
            )}
            {error && <span className="toa-msg toa-msg-error" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}>{error}</span>}
            {info && <span className="toa-msg toa-msg-success" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}>{info}</span>}
          </div>
        </div>

        {/* List */}
        <div className="toa-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--toa-gold-bright)', marginBottom: '1rem' }}>
            Existing Entries ({items.length})
          </div>
          {items.length === 0 ? (
            <div style={{ color: 'var(--toa-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>
              No news entries yet. Create one above.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid rgba(184,155,94,0.12)',
                    borderRadius: '0.5rem',
                    padding: '1rem 1.25rem',
                    background: 'rgba(12,10,18,0.6)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '1rem',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{
                        fontFamily: 'var(--toa-font-display)',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        color: item.isPublished ? 'var(--toa-gold-bright)' : 'var(--toa-muted)',
                      }}>
                        {item.title}
                      </span>
                      <span style={{
                        fontSize: '0.65rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '0.25rem',
                        background: 'rgba(184,155,94,0.12)',
                        color: 'var(--toa-gold)',
                      }}>
                        {item.category}
                      </span>
                      {item.isPublished ? (
                        <Eye size={12} style={{ color: 'var(--toa-success)' }} />
                      ) : (
                        <EyeOff size={12} style={{ color: 'var(--toa-muted)' }} />
                      )}
                    </div>
                    <div style={{
                      fontSize: '0.8rem',
                      color: 'var(--toa-bone)',
                      opacity: 0.7,
                      whiteSpace: 'pre-wrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {item.body}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--toa-muted)', marginTop: '0.5rem' }}>
                      {new Date(item.publishedAt).toLocaleDateString()} · Order: {item.sortOrder} · By {item.updatedBy}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexShrink: 0 }}>
                    <button
                      onClick={() => onEdit(item)}
                      className="toa-btn toa-btn-ghost toa-btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={() => onDelete(item.id)}
                      className="toa-btn toa-btn-ghost toa-btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--toa-danger)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
