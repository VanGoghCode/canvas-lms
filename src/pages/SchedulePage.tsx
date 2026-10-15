import { useState } from 'react';
import { Link } from 'react-router-dom';
import { InfoButton } from '../components/InfoButton';
import { ACADEMIC_DATE, formatDate, time } from '../lib/data';
import { stageLabel, stageTone, useWorkspace } from '../lib/workspace';

const dayKey = (value: number) => new Date(value).toISOString().slice(0, 10);
export function SchedulePage() {
  const { session, work, courses } = useWorkspace();
  const [month, setMonth] = useState(
    new Date(Date.UTC(ACADEMIC_DATE.getUTCFullYear(), ACADEMIC_DATE.getUTCMonth(), 1)),
  );
  const [selectedDay, setSelectedDay] = useState('');
  const [course, setCourse] = useState('');
  const instructor = session!.role === 'instructor';
  const scoped = work.filter((w) => !course || w.course.id === course);
  const inMonth = scoped.filter((w) => {
    const due = new Date(time(w.assignment.dueDate));
    return (
      due.getUTCFullYear() === month.getUTCFullYear() && due.getUTCMonth() === month.getUTCMonth()
    );
  });
  const visible = inMonth.filter(
    (w) => !selectedDay || dayKey(time(w.assignment.dueDate)) === selectedDay,
  );
  const monthLabel = month.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const days = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = (month.getUTCDay() + 6) % 7;
  const cells = Array.from(
    { length: Math.ceil((offset + days) / 7) * 7 },
    (_, i) => i - offset + 1,
  );
  const move = (direction: number) => {
    setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + direction, 1)));
    setSelectedDay('');
  };
  return (
    <div className="page">
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">{instructor ? 'Teaching' : 'Student'} workspace</span>
          <h1>Course calendar</h1>
          <p className="muted">
            One place for every assignment deadline.{' '}
            <InfoButton title="Course calendar">
              <p>
                Only deadlines for courses you can access are shown. Dates use UTC and the fixed
                August 15, 2026 academic reference date. This calendar shows published due dates,
                including work already submitted; it is not a class meeting schedule.
              </p>
            </InfoButton>
          </p>
        </div>
        <label>
          Course
          <select value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">All my courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="calendar-layout">
        <section className="card">
          <div className="section-heading">
            <h2 aria-live="polite">{monthLabel}</h2>
            <div className="actions">
              <button
                className="button calendar-arrow"
                aria-label="Previous month"
                onClick={() => move(-1)}
              >
                ←
              </button>
              <button
                className="button calendar-arrow"
                aria-label="Next month"
                onClick={() => move(1)}
              >
                →
              </button>
              <button
                className="button"
                onClick={() => {
                  setMonth(
                    new Date(
                      Date.UTC(ACADEMIC_DATE.getUTCFullYear(), ACADEMIC_DATE.getUTCMonth(), 1),
                    ),
                  );
                  setSelectedDay(dayKey(ACADEMIC_DATE.getTime()));
                }}
              >
                Academic date
              </button>
            </div>
          </div>
          <table className="calendar-table">
            <caption className="sr-only">Assignment deadlines for {monthLabel}</caption>
            <thead>
              <tr>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <th scope="col" key={d}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: cells.length / 7 }, (_, row) => (
                <tr key={row}>
                  {cells.slice(row * 7, row * 7 + 7).map((day) => {
                    if (day < 1 || day > days) return <td key={day} />;
                    const key = dayKey(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day));
                    const count = inMonth.filter(
                      (w) => dayKey(time(w.assignment.dueDate)) === key,
                    ).length;
                    return (
                      <td key={day}>
                        <button
                          type="button"
                          aria-label={`${key}, ${count} deadline${count === 1 ? '' : 's'}`}
                          aria-pressed={selectedDay === key}
                          aria-current={
                            key === dayKey(ACADEMIC_DATE.getTime()) ? 'date' : undefined
                          }
                          className={`${count ? 'has-deadline' : ''} ${key === dayKey(ACADEMIC_DATE.getTime()) ? 'academic-date' : ''}`}
                          onClick={() => setSelectedDay(selectedDay === key ? '' : key)}
                        >
                          <span>{day}</span>
                          {count > 0 && (
                            <small>
                              {count}
                              <span className="calendar-count-label"> due</span>
                            </small>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="calendar-key">
            <span>
              <i className="dot graded" />
              Assignment due
            </span>
            <span>
              <i className="dot upcoming" />
              Academic date: Aug 15
            </span>
          </div>
        </section>
        <section className="card stack">
          <div className="section-heading">
            <h2>
              {selectedDay
                ? new Date(`${selectedDay}T00:00:00Z`).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })
                : 'This month'}
            </h2>
            <span className="pill neutral">
              {visible.length} deadline{visible.length === 1 ? '' : 's'}
            </span>
          </div>
          {selectedDay && (
            <button className="text-button" onClick={() => setSelectedDay('')}>
              Show the entire month
            </button>
          )}
          {!visible.length && (
            <div className="empty-state compact">
              <h3>No deadlines here</h3>
              <p className="muted">Choose another day, month, or course.</p>
            </div>
          )}
          <div className="calendar-agenda">
            {visible.map((w) => (
              <Link
                key={w.assignment.id}
                to={
                  instructor
                    ? `/instructor/grade/${w.assignment.id}`
                    : `/assignments/${w.assignment.id}`
                }
              >
                <span className="eyebrow">{w.course.code}</span>
                <strong>{w.assignment.title}</strong>
                <small>{formatDate(w.assignment.dueDate)} UTC</small>
                <span className={`pill ${instructor ? 'neutral' : stageTone[w.stage]}`}>
                  {instructor ? `${w.assignment.pointsPossible} points` : stageLabel[w.stage]}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
