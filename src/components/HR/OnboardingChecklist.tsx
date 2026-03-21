import { useState, useEffect } from 'react';
import { ClipboardCheck, Plus, Check, Circle, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface OnboardingTask {
  id: string;
  employee_id: string;
  task_title: string;
  status: string;
  due_date: string | null;
  completed_date: string | null;
}

const DEFAULT_TASKS = [
  'Collect signed offer letter',
  'Complete I-9 verification',
  'Set up payroll',
  'Background check initiated',
  'Drug test scheduled',
  'Cannabis worker permit — verify or apply',
  'Add to company insurance policy',
  'Issue company vehicle/equipment',
  'Complete safety training',
  'Assign to Atlas V2 account (drivers)',
];

interface Props {
  employeeId: string;
}

export default function OnboardingChecklist({ employeeId }: Props) {
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('hq_onboarding_tasks').select('*').eq('employee_id', employeeId).order('created_at');
    setTasks(data || []);
  };

  useEffect(() => { load(); }, [employeeId]);

  // Auto-generate default tasks for new employees
  const generateDefaults = async () => {
    const inserts = DEFAULT_TASKS.map(t => ({
      employee_id: employeeId,
      task_title: t,
      status: 'pending',
    }));
    const { error } = await supabase.from('hq_onboarding_tasks').insert(inserts);
    if (error) { toast.error('Failed to create checklist'); return; }
    toast.success('Onboarding checklist created');
    load();
  };

  const toggleStatus = async (task: OnboardingTask) => {
    const nextStatus = task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'complete' : 'pending';
    const update: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === 'complete') update.completed_date = new Date().toISOString().split('T')[0];
    else update.completed_date = null;
    await supabase.from('hq_onboarding_tasks').update(update).eq('id', task.id);
    load();
  };

  const addTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await supabase.from('hq_onboarding_tasks').insert({
      employee_id: employeeId,
      task_title: fd.get('task_title') as string,
      status: 'pending',
    });
    setShowAdd(false);
    load();
  };

  const completed = tasks.filter(t => t.status === 'complete').length;

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-tx-muted)', textTransform: 'uppercase' }}>
          <ClipboardCheck size={14} /> Onboarding ({completed}/{tasks.length})
        </div>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {tasks.length === 0 && (
            <button type="button" className="btn btn-primary btn-sm" onClick={generateDefaults}>Generate Checklist</button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={12} />
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={addTask} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input className="input-field" name="task_title" required placeholder="Task name..." style={{ flex: 1 }} />
          <button type="submit" className="btn btn-primary btn-sm">Add</button>
        </form>
      )}

      {/* Progress bar */}
      {tasks.length > 0 && (
        <div style={{ height: 4, background: 'var(--color-divider)', borderRadius: 2, marginBottom: '0.5rem', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(completed / tasks.length) * 100}%`, background: 'var(--color-success)', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {tasks.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => toggleStatus(t)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.5rem',
              background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
              fontSize: '0.75rem', borderRadius: 'var(--radius-sm)',
              color: t.status === 'complete' ? 'var(--color-tx-muted)' : 'var(--color-tx)',
              textDecoration: t.status === 'complete' ? 'line-through' : 'none',
            }}
          >
            {t.status === 'complete' ? <Check size={14} style={{ color: 'var(--color-success)' }} /> :
             t.status === 'in_progress' ? <Loader size={14} style={{ color: 'var(--color-warning)' }} /> :
             <Circle size={14} style={{ color: 'var(--color-tx-muted)' }} />}
            {t.task_title}
          </button>
        ))}
      </div>
    </div>
  );
}
