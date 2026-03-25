import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, addMonths, subMonths, getDay, isSameMonth } from 'date-fns';
import { daysUntil } from '../../lib/utils';

interface InsurancePolicy {
  id: string;
  policy_type: string;
  carrier: string;
  state: string | null;
  status: string;
  expiration_date: string | null;
  renewal_date: string | null;
}

interface Props {
  policies: InsurancePolicy[];
  onSelect: (policy: InsurancePolicy) => void;
  typeFilter: string;
}

function urgencyColor(dateStr: string | null): string {
  const days = daysUntil(dateStr);
  if (days === null) return 'var(--color-tx-muted)';
  if (days < 0) return 'var(--color-error)';
  if (days <= 30) return 'var(--color-error)';
  if (days <= 90) return 'var(--color-warning)';
  return 'var(--color-success)';
}

export default function InsuranceCalendar({ policies, onSelect, typeFilter }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const filtered = useMemo(() => {
    return policies.filter(p => {
      if (typeFilter && p.policy_type !== typeFilter) return false;
      return true;
    });
  }, [policies, typeFilter]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  const eventMap = useMemo(() => {
    const map: Record<string, { policy: InsurancePolicy; type: 'expiration' | 'renewal' }[]> = {};
    for (const p of filtered) {
      if (p.expiration_date) {
        const key = p.expiration_date;
        if (!map[key]) map[key] = [];
        map[key].push({ policy: p, type: 'expiration' });
      }
      if (p.renewal_date) {
        const key = p.renewal_date;
        if (!map[key]) map[key] = [];
        map[key].push({ policy: p, type: 'renewal' });
      }
    }
    return map;
  }, [filtered]);

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft size={16} />
        </button>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{format(currentMonth, 'MMMM yyyy')}</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="license-calendar">
        {weekdays.map(d => (
          <div key={d} className="cal-header">{d}</div>
        ))}

        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="cal-day cal-day-empty" />
        ))}

        {days.map(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventMap[dateKey] || [];
          const isToday = isSameDay(day, new Date());
          const inMonth = isSameMonth(day, currentMonth);

          return (
            <div
              key={dateKey}
              className={`cal-day ${isToday ? 'cal-day-today' : ''} ${!inMonth ? 'cal-day-muted' : ''} ${dayEvents.length > 0 ? 'cal-day-has-events' : ''}`}
            >
              <div className="cal-day-number">{format(day, 'd')}</div>
              <div className="cal-day-events">
                {dayEvents.slice(0, 3).map((ev, i) => (
                  <button
                    key={i}
                    type="button"
                    className="cal-marker"
                    style={{ background: urgencyColor(ev.type === 'expiration' ? ev.policy.expiration_date : ev.policy.renewal_date) }}
                    onClick={() => onSelect(ev.policy)}
                    title={`${ev.type === 'expiration' ? 'Expires' : 'Renewal'}: ${ev.policy.policy_type}${ev.policy.state ? ` (${ev.policy.state})` : ''}`}
                  >
                    <span className="cal-marker-text">{ev.policy.state || 'ALL'}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div style={{ fontSize: '0.6rem', color: 'var(--color-tx-muted)' }}>+{dayEvents.length - 3}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--color-tx-muted)' }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-error)', marginRight: 4 }} />Expired / &lt;30d</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)', marginRight: 4 }} />30-90 days</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)', marginRight: 4 }} />&gt;90 days</span>
      </div>
    </div>
  );
}
