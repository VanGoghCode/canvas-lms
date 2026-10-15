import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { InfoButton } from './InfoButton';
import { ACADEMIC_DATE, time } from '../lib/data';
import type { Assignment, Course } from '../types';

export function ProgressRing({
  completed,
  total,
  label,
}: {
  completed: number;
  total: number;
  label: string;
}) {
  const percentage = total ? Math.round((completed / total) * 100) : null;
  return (
    <div
      className="progress-ring"
      role="img"
      aria-label={`${label}: ${completed} of ${total}${percentage == null ? '' : `, ${percentage}%`}`}
      style={{ '--progress': `${percentage ?? 0}%` } as CSSProperties}
    >
      <div>
        <strong>{percentage == null ? '—' : `${percentage}%`}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}
export function ProgressBar({
  value,
  total,
  label,
}: {
  value: number;
  total: number;
  label: string;
}) {
  return (
    <div
      className="visual-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total || 1}
      aria-valuenow={value}
      aria-valuetext={`${value} of ${total}`}
    >
      <span style={{ width: `${total ? Math.min(100, (value / total) * 100) : 0}%` }} />
    </div>
  );
}
export function DeadlineList({
  assignments,
  courses,
  instructor = false,
}: {
  assignments: Assignment[];
  courses: Course[];
  instructor?: boolean;
}) {
  const upcoming = assignments.filter((a) => time(a.dueDate) > ACADEMIC_DATE.getTime()).slice(0, 4);
  return (
    <section className="card stack deadlines-card">
      <div className="section-heading">
        <h2>
          Coming up{' '}
          <InfoButton title="Upcoming deadlines">
            <p>
              Published assignment deadlines after the academic date, shown in UTC. Student
              dashboards include only work that has not been submitted.
            </p>
          </InfoButton>
        </h2>
        <Link to="/schedule">Calendar →</Link>
      </div>
      {!upcoming.length && <p className="muted">No upcoming deadlines for this view.</p>}
      <div className="deadline-list">
        {upcoming.map((a) => {
          const date = new Date(time(a.dueDate));
          return (
            <Link
              className="deadline-item"
              key={a.id}
              to={instructor ? `/instructor/grade/${a.id}` : `/assignments/${a.id}`}
            >
              <span className="date-tile">
                <small>
                  {date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}
                </small>
                <strong>{date.getUTCDate()}</strong>
              </span>
              <span>
                <strong>{a.title}</strong>
                <small>
                  {courses.find((c) => c.id === a.courseId)?.code} · {a.pointsPossible} points
                </small>
              </span>
              <span className="muted">→</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
export function GradeDistribution({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  return (
    <div className="grade-distribution" aria-label="Grade distribution">
      {['A', 'B', 'C', 'D', 'F'].map((letter, i) => (
        <div key={letter}>
          <strong>{counts[i]}</strong>
          <div className="grade-column">
            <span style={{ height: `${(counts[i] / max) * 100}%` }} />
          </div>
          <span>{letter}</span>
        </div>
      ))}
    </div>
  );
}
