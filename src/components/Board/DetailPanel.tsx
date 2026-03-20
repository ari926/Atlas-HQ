import { useEffect, useState } from 'react';
import { X, MessageSquare, Clock, Send } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useBoardStore } from '../../stores/boardStore';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { timeAgo, getInitials, personColor } from '../../lib/utils';
import CellRenderer from './cells/CellRenderer';

interface Comment { id: string; task_id: string; user_name: string; content: string; created_at: string; }
interface Activity { id: string; action: string; user_name: string; field_name: string | null; old_value: string | null; new_value: string | null; created_at: string; }

export default function DetailPanel() {
  const { detailTaskId, closeDetail } = useUIStore();
  const { tasks, columns, taskValues, updateCellValue, updateTaskTitle } = useBoardStore();
  const { profile, user } = useAuthStore();

  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'activity'>('details');

  const task = tasks.find(t => t.id === detailTaskId);

  useEffect(() => {
    if (!detailTaskId) return;
    // Load comments
    supabase.from('hq_task_comments').select('*').eq('task_id', detailTaskId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setComments(data || []));
    // Load activity
    supabase.from('hq_task_activity').select('*').eq('task_id', detailTaskId)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setActivity(data || []));
  }, [detailTaskId]);

  if (!detailTaskId || !task) return null;

  const values = taskValues[task.id] || {};

  const handleAddComment = async () => {
    const content = newComment.trim();
    if (!content) return;
    const userName = profile?.full_name || user?.email || 'Unknown';
    const { data } = await supabase.from('hq_task_comments').insert({
      task_id: task.id,
      user_id: user?.id,
      user_name: userName,
      content,
    }).select().single();
    if (data) setComments(prev => [...prev, data]);
    setNewComment('');
  };

  return (
    <div className="detail-panel-overlay" onClick={closeDetail}>
      <div className="detail-panel" onClick={e => e.stopPropagation()}>
        <div className="detail-panel-header">
          <h2
            className="detail-panel-title"
            contentEditable
            suppressContentEditableWarning
            onBlur={e => {
              const newTitle = e.currentTarget.textContent?.trim();
              if (newTitle && newTitle !== task.title) updateTaskTitle(task.id, newTitle);
            }}
          >
            {task.title}
          </h2>
          <button className="modal-close" onClick={closeDetail}><X size={18} /></button>
        </div>

        <div className="detail-panel-tabs">
          <button className={`tab-btn${activeTab === 'details' ? ' active' : ''}`} onClick={() => setActiveTab('details')}>Details</button>
          <button className={`tab-btn${activeTab === 'comments' ? ' active' : ''}`} onClick={() => setActiveTab('comments')}>
            <MessageSquare size={14} /> Comments ({comments.length})
          </button>
          <button className={`tab-btn${activeTab === 'activity' ? ' active' : ''}`} onClick={() => setActiveTab('activity')}>
            <Clock size={14} /> Activity
          </button>
        </div>

        <div className="detail-panel-body">
          {activeTab === 'details' && (
            <div className="detail-fields">
              {columns.map(col => (
                <div key={col.id} className="detail-field-row">
                  <label className="field-label">{col.name}</label>
                  <CellRenderer
                    column={col}
                    value={values[col.id] || ''}
                    taskId={task.id}
                    onUpdate={updateCellValue}
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="detail-comments">
              {comments.length === 0 && (
                <p style={{ color: 'var(--color-tx-faint)', textAlign: 'center', padding: '2rem' }}>No comments yet</p>
              )}
              {comments.map(c => (
                <div key={c.id} className="comment-item">
                  <div className="comment-avatar" style={{ background: personColor(c.user_name) }}>
                    {getInitials(c.user_name)}
                  </div>
                  <div className="comment-body">
                    <div className="comment-header">
                      <strong>{c.user_name}</strong>
                      <span className="comment-time">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="comment-text">{c.content}</p>
                  </div>
                </div>
              ))}
              <div className="comment-input-row">
                <input
                  className="input-field"
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
                />
                <button className="btn btn-primary btn-sm" onClick={handleAddComment}>
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="activity-feed">
              {activity.length === 0 && (
                <p style={{ color: 'var(--color-tx-faint)', textAlign: 'center', padding: '2rem' }}>No activity yet</p>
              )}
              {activity.map(a => (
                <div key={a.id} className="activity-item">
                  <div className="activity-dot" style={{ background: 'var(--color-primary)' }} />
                  <div>
                    <div className="activity-text">
                      <strong>{a.user_name}</strong> {a.action}
                      {a.field_name && <> <em>{a.field_name}</em></>}
                      {a.new_value && <> to <strong>{a.new_value}</strong></>}
                    </div>
                    <div className="activity-time">{timeAgo(a.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
