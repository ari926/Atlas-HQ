import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, addMonths, subMonths, getDay, isSameMonth } from 'date-fns';
import { daysUntil } from '../../lib/utils';

interface License {
  id: string;
  license_type: string;
  license_number: string | null;
  state: string;
  status: string;
  expiration_date: string | null;
  renewal_date: string | null;
  license_category: string | null;
}

interface Props {
  licenses: License[];
  onSelect: (license: License) => void;
  stateFilter: string;
  categoryFilter: string;
}

function urgencyColor(dateStr: string | null): string {
  const days = daysUntil(dateStr);
  if (days === null) return 'var(--color-tx-muted)';
  if (days < 0) return 'var(--color-error)';
  if (days <= 30) return 'var(--color-error)';
  if (days <= 90) return 'var(--color-warning)';
  return 'var(--color-success)';
}

export default function LicenseCalendar({ licenses, onSelect, stateFilter, categoryFilter }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const filtered = useMemo(() => {
    return licenses.filter(l => {
      if (stateFilter && l.state !== stateFilter) return false;
      if (categoryFilter && l.license_category !== categoryFilter) return false;
      return true;
    });
  }, [licenses, stateFilter, categoryFilter]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start of month with empty cells
  const startPad = getDay(monthStart); // 0=Sun

  // Build events map: date string -> license[]
  const eventMap = useMemo(() => {
    const map: Record<string, { license: License; type: 'expiration' | 'renewal' }[]> = {};
    for (const l of filtered) {
      if (l.expiration_date) {
        const key = l.expiration_date;
        if (!map[key]) map[key] = [];
        map[key].push({ license: l, type: 'expiration' });
      }
      if (l.renewal_date) {
        const key = l.renewal_date;
        if (!map[key]) map[key] = [];
        map[key].push({ license: l, type: 'renewal' });
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
        {/* Weekday headers */}
        {weekdays.map(d => (
          <div key={d} className="cal-header">{d}</div>
        ))}

        {/* Empty padding cells */}
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="cal-day cal-day-empty" />
        ))}

        {/* Day cells */}
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
                    style={{ background: urgencyColor(ev.type === 'expiration' ? ev.license.expiration_date : ev.license.renewal_date) }}
                    onClick={() => onSelect(ev.license)}
                    title={`${ev.type === 'expiration' ? 'Expires' : 'Renewal'}: ${ev.license.license_type} (${ev.license.state})`}
                  >
                    <span className="cal-marker-text">{ev.license.state}</span>
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
