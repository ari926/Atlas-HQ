import { useState, useEffect } from 'react';
import { Clock, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';

interface InsuranceEvent {
  id: string;
  policy_id: string;
  event_type: string;
  event_date: string | null;
  amount: number | null;
  notes: string | null;
  created_at: string;
}

const EVENT_TYPES = [
  { value: 'claim_filed', label: 'Claim Filed', color: 'var(--color-warning)' },
  { value: 'claim_approved', label: 'Claim Approved', color: 'var(--color-success)' },
  { value: 'claim_denied', label: 'Claim Denied', color: 'var(--color-error)' },
  { value: 'renewed', label: 'Renewed', color: 'var(--color-success)' },
  { value: 'amended', label: 'Amended', color: 'var(--color-warning)' },
  { value: 'cancelled', label: 'Cancelled', color: 'var(--color-error)' },
  { value: 'reinstated', label: 'Reinstated', color: 'var(--color-success)' },
  { value: 'premium_change', label: 'Premium Change', color: 'var(--color-info)' },
  { value: 'note', label: 'Note', color: 'var(--color-tx-muted)' },
];

function eventColor(type: string): string {
  return EVENT_TYPES.find(e => e.value === type)?.color || 'var(--color-tx-muted)';
}

function eventLabel(type: string): string {
  return EVENT_TYPES.find(e => e.value === type)?.label || type;
}

function formatCurrency(n: number | null): string {
  if (n === null) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

interface Props {
  policyId: string;
}

export default function InsuranceEventLog({ policyId }: Props) {
  const [events, setEvents] = useState<InsuranceEvent[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('hq_insurance_events')
      .select('*')
      .eq('policy_id', policyId)
      .order('event_date', { ascending: false, nullsFirst: false });
    setEvents(data || []);
  };

  useEffect(() => { load(); }, [policyId]);

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amountStr = (fd.get('amount') as string)?.trim();
    const { error } = await supabase.from('hq_insurance_events').insert({
      policy_id: policyId,
      event_type: fd.get('event_type') as string,
      event_date: fd.get('event_date') as string || null,
      amount: amountStr ? parseFloat(amountStr) : null,
      notes: fd.get('notes') as string || null,
    });
    if (error) { toast.error('Failed to add event'); return; }
    toast.success('Event added');
    setShowForm(false);
    load();
  };

  return (
    <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setExpanded(!expanded)}
        style={{ color: 'var(--color-tx-muted)', marginBottom: expanded ? '0.5rem' : 0 }}
      >
        <Clock size={14} /> Claims & History ({events.length})
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="event-log">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(!showForm)} style={{ marginBottom: '0.5rem' }}>
            <Plus size={12} /> Add Event
          </button>

          {showForm && (
            <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-md)' }}>
              <select className="select-field" name="event_type" required style={{ flex: '1 1 130px', minWidth: 130 }}>
                {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input className="input-field" type="date" name="event_date" style={{ flex: '1 1 130px', minWidth: 130 }} />
              <input className="input-field" type="number" name="amount" placeholder="Amount ($)" step="0.01" style={{ flex: '1 1 100px', minWidth: 100 }} />
              <input className="input-field" name="notes" placeholder="Notes..." style={{ flex: '2 1 200px', minWidth: 150 }} />
              <button type="submit" className="btn btn-primary btn-sm">Add</button>
            </form>
          )}

          {events.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-tx-muted)', padding: '0.5rem 0' }}>No events recorded</div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: '1.25rem' }}>
              <div style={{ position: 'absolute', left: '0.375rem', top: '0.25rem', bottom: '0.25rem', width: '2px', background: 'var(--color-divider)' }} />
              {events.map(ev => (
                <div key={ev.id} className="event-item" style={{ position: 'relative', paddingBottom: '0.75rem' }}>
                  <div style={{
                    position: 'absolute', left: '-1.25rem', top: '0.25rem',
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: eventColor(ev.event_type), border: '2px solid var(--color-surface)',
                    zIndex: 1
                  }} />
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span className="badge" style={{ background: eventColor(ev.event_type), color: '#fff', fontSize: '0.65rem' }}>
                      {eventLabel(ev.event_type)}
                    </span>
                    {ev.amount !== null && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-tx)' }}>
                        {formatCurrency(ev.amount)}
                      </span>
                    )}
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-tx-muted)' }}>
                      {formatDate(ev.event_date)}
                    </span>
                  </div>
                  {ev.notes && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-tx-secondary)', marginTop: '0.25rem' }}>
                      {ev.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
