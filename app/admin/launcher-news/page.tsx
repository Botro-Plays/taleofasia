'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/app/components/PageShell';
import { Save, Plus, Trash2, Edit3, X, Eye, EyeOff } from 'lucide-react';

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

  const init = useCallback(async () => {
    try {
      const chk = await fetch('/api/admin/check');
      const data = await chk.json();
      if (!data.isAdmin) { router.push('/dashboard'); return; }
      setIsSuperAdmin(!!data.isSuperAdmin);
      setLoading(false);
      await fetchItems();
    } catch {
      router.push('/dashboard');
    }
  }, [router]);

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/admin/launcher-news');
      const j = await res.json();
      if (res.ok && Array.isArray(j.items)) setItems(j.items);
    } catch {}
  };

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
            <label className="toa-label-field">Body (plain text, line breaks supported)</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={8}
              className="toa-textarea"
              placeholder="Describe the news or patch changes..."
            />
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
