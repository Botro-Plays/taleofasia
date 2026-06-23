'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { PageShell } from '@/app/components/PageShell';
import { Plus, X, Calendar, Flag, Pencil, Trash2 } from 'lucide-react';

interface EventItem {
  EventID: number;
  Name: string;
  Description: string;
  StartDate: string;
  EndDate: string;
  Type: string;
  Status: string;
  CreatedAt: string;
}

const eventTypeLabels: Record<string, string> = {
  xp_boost: 'XP Boost',
  drop_boost: 'Drop Boost',
  pvp: 'PvP Tournament',
  siege: 'Siege War',
  special: 'Special Event',
};

const eventTypeBadge: Record<string, string> = {
  xp_boost: 'toa-badge toa-badge-gold',
  drop_boost: 'toa-badge toa-badge-success',
  pvp: 'toa-badge toa-badge-danger',
  siege: 'toa-badge toa-badge-warn',
  special: 'toa-badge toa-badge-info',
};

const statusBadge: Record<string, string> = {
  upcoming: 'toa-badge toa-badge-info',
  active: 'toa-badge toa-badge-success',
  completed: 'toa-badge toa-badge-muted',
  cancelled: 'toa-badge toa-badge-danger',
};

export default function AdminEventsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    Name: '',
    Description: '',
    StartDate: '',
    EndDate: '',
    Type: 'special',
    Status: 'upcoming',
  });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/events');
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAdminAndFetch = useCallback(async () => {
    try {
      const adminCheck = await fetch('/api/admin/check');
      const adminData = await adminCheck.json();
      if (!adminData.isAdmin) {
        router.push('/dashboard');
        return;
      }
      await fetchEvents();
    } catch (error) {
      console.error('Error checking admin status:', error);
      router.push('/dashboard');
    }
  }, [fetchEvents, router]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const id = setTimeout(() => { void checkAdminAndFetch(); }, 0);
      return () => clearTimeout(id);
    }
  }, [status, router, checkAdminAndFetch]);

  const resetForm = () => {
    setFormData({
      Name: '',
      Description: '',
      StartDate: '',
      EndDate: '',
      Type: 'special',
      Status: 'upcoming',
    });
    setEditingEvent(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const url = '/api/admin/events';
      const method = editingEvent ? 'PUT' : 'POST';
      const body = editingEvent
        ? { ...formData, EventID: editingEvent.EventID }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setMessage(editingEvent ? 'Event updated!' : 'Event created!');
        setShowForm(false);
        resetForm();
        fetchEvents();
      } else {
        setMessage('Failed to save event.');
      }
    } catch (error) {
      console.error('Error saving event:', error);
      setMessage('Failed to save event.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (event: EventItem) => {
    setEditingEvent(event);
    setFormData({
      Name: event.Name,
      Description: event.Description || '',
      StartDate: event.StartDate ? new Date(event.StartDate).toISOString().slice(0, 16) : '',
      EndDate: event.EndDate ? new Date(event.EndDate).toISOString().slice(0, 16) : '',
      Type: event.Type || 'special',
      Status: event.Status || 'upcoming',
    });
    setShowForm(true);
    setMessage('');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const response = await fetch(`/api/admin/events?id=${id}`, { method: 'DELETE' });
      if (response.ok) {
        setMessage('Event deleted.');
        fetchEvents();
      } else {
        setMessage('Failed to delete event.');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      setMessage('Failed to delete event.');
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  if (status === 'loading' || loading) {
    return (
      <PageShell label="Admin" title="Event Management" backHref="/admin" backLabel="Admin">
        <div className="toa-loading">Loading…</div>
      </PageShell>
    );
  }

  const isSuccess = message.includes('deleted') || message.includes('updated') || message.includes('created');

  return (
    <PageShell
      label="Admin"
      title="Event Management"
      backHref="/admin"
      backLabel="Admin"
      actions={
        <button
          onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); setMessage(''); }}
          className={`toa-btn toa-btn-sm ${showForm ? 'toa-btn-ghost' : 'toa-btn-solid'}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          {showForm ? <><X size={13} /> Cancel</> : <><Plus size={13} /> New Event</>}
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {message && (
          <div className={`toa-msg ${isSuccess ? 'toa-msg-success' : 'toa-msg-error'}`}>{message}</div>
        )}

        {showForm && (
          <div className="toa-seal-card" style={{ padding: '2rem', position: 'relative' }}>
            <div className="toa-seal-corner toa-seal-corner-tl" /><div className="toa-seal-corner toa-seal-corner-tr" />
            <div style={{ fontFamily: 'var(--toa-font-display)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--toa-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {editingEvent ? <><Pencil size={14} /> Edit Event</> : <><Plus size={14} /> Create New Event</>}
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="toa-label-field">Event Name</label>
                <input required value={formData.Name} onChange={(e) => setFormData({ ...formData, Name: e.target.value })} className="toa-input" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="toa-label-field">Description</label>
                <textarea rows={3} value={formData.Description} onChange={(e) => setFormData({ ...formData, Description: e.target.value })} className="toa-textarea" />
              </div>
              <div>
                <label className="toa-label-field">Start Date</label>
                <input type="datetime-local" required value={formData.StartDate} onChange={(e) => setFormData({ ...formData, StartDate: e.target.value })} className="toa-input" />
              </div>
              <div>
                <label className="toa-label-field">End Date</label>
                <input type="datetime-local" required value={formData.EndDate} onChange={(e) => setFormData({ ...formData, EndDate: e.target.value })} className="toa-input" />
              </div>
              <div>
                <label className="toa-label-field">Event Type</label>
                <select value={formData.Type} onChange={(e) => setFormData({ ...formData, Type: e.target.value })} className="toa-select" style={{ width: '100%' }}>
                  <option value="special">Special Event</option>
                  <option value="xp_boost">XP Boost</option>
                  <option value="drop_boost">Drop Boost</option>
                  <option value="pvp">PvP Tournament</option>
                  <option value="siege">Siege War</option>
                </select>
              </div>
              <div>
                <label className="toa-label-field">Status</label>
                <select value={formData.Status} onChange={(e) => setFormData({ ...formData, Status: e.target.value })} className="toa-select" style={{ width: '100%' }}>
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" disabled={saving} className="toa-btn toa-btn-solid toa-btn-sm" style={{ opacity: saving ? 0.5 : 1 }}>
                  {saving ? 'Saving…' : editingEvent ? 'Update Event' : 'Create Event'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="toa-btn toa-btn-ghost toa-btn-sm">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {events.length === 0 ? (
          <div className="toa-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--toa-muted)', fontSize: '0.875rem' }}>No events found. Create your first event above.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {events.map((event) => (
              <div key={event.EventID} className="toa-panel" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--toa-bone)', fontSize: '0.95rem' }}>{event.Name}</div>
                      <span className={statusBadge[event.Status] || 'toa-badge toa-badge-muted'}>{event.Status}</span>
                      <span className={eventTypeBadge[event.Type] || 'toa-badge toa-badge-muted'}>{eventTypeLabels[event.Type] || event.Type}</span>
                    </div>
                    {event.Description && <div style={{ fontSize: '0.82rem', color: 'var(--toa-muted)', marginBottom: '0.5rem' }}>{event.Description}</div>}
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--toa-muted)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Calendar size={11} /> Start: <span style={{ color: 'var(--toa-bone)' }}>{formatDate(event.StartDate)}</span></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Flag size={11} /> End: <span style={{ color: 'var(--toa-bone)' }}>{formatDate(event.EndDate)}</span></span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button onClick={() => handleEdit(event)} className="toa-btn-xs toa-btn-xs-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Pencil size={11} /> Edit</button>
                    <button onClick={() => handleDelete(event.EventID)} className="toa-btn-xs toa-btn-xs-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Trash2 size={11} /> Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
