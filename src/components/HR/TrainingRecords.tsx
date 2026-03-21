import { useState, useEffect } from 'react';
import { GraduationCap, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate, daysUntil } from '../../lib/utils';
import toast from 'react-hot-toast';

interface Training {
  id: string;
  employee_id: string;
  training_type: string;
  completed_date: string | null;
  expiration_date: string | null;
  certificate_drive_id: string | null;
}

const TRAINING_TYPES = [
  'Cannabis Handler Training',
  'DOT Drug & Alcohol Awareness',
  'Defensive Driving',
  'OSHA 10 / OSHA 30',
  'Hazmat Awareness',
  'State Cannabis Compliance',
  'Company Safety Policy',
];

interface Props {
  employeeId: string;
}

export default function TrainingRecords({ employeeId }: Props) {
  const [records, setRecords] = useState<Training[]>([]);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('hq_employee_training').select('*').eq('employee_id', employeeId).order('completed_date', { ascending: false });
    setRecords(data || []);
  };

  useEffect(() => { load(); }, [employeeId]);

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from('hq_employee_training').insert({
      employee_id: employeeId,
      training_type: fd.get('training_type') as string,
      completed_date: fd.get('completed_date') as string || null,
      expiration_date: fd.get('expiration_date') as string || null,
      certificate_drive_id: fd.get('certificate_drive_id') as string || null,
    });
    if (error) { toast.error('Failed to add'); return; }
    toast.success('Training added');
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('hq_employee_training').delete().eq('id', id);
    toast.success('Removed');
    load();
  };

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-tx-muted)', textTransform: 'uppercase' }}>
          <GraduationCap size={14} /> Training Records ({records.length})
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={12} /> Add
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-md)' }}>
          <select className="select-field" name="training_type" required style={{ flex: '1 1 180px' }}>
            <option value="">Select training...</option>
            {TRAINING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="input-field" type="date" name="completed_date" style={{ flex: '1 1 130px' }} placeholder="Completed" />
          <input className="input-field" type="date" name="expiration_date" style={{ flex: '1 1 130px' }} placeholder="Expires" />
          <input className="input-field" name="certificate_drive_id" placeholder="Drive URL" style={{ flex: '1 1 200px' }} />
          <button type="submit" className="btn btn-primary btn-sm">Add</button>
        </form>
      )}

      {records.length === 0 ? (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-tx-muted)', padding: '0.5rem 0' }}>No training records</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {records.map(r => {
            const days = daysUntil(r.expiration_date);
            const expBadge = days === null ? null : days < 0 ? 'badge-expired' : days <= 30 ? 'badge-due-soon' : 'badge-active';
            return (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
                <div>
                  <strong>{r.training_type}</strong>
                  <div style={{ color: 'var(--color-tx-muted)', fontSize: '0.7rem' }}>
                    Completed: {formatDate(r.completed_date)}
                    {r.expiration_date && <> | Expires: {formatDate(r.expiration_date)}</>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                  {expBadge && <span className={`badge ${expBadge}`} style={{ fontSize: '0.6rem' }}>{days! < 0 ? 'Expired' : `${days}d`}</span>}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(r.id)} style={{ color: 'var(--color-error)' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
