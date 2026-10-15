import { Link, useSearchParams } from 'react-router-dom';
import { InfoButton } from '../components/InfoButton';
import { ProgressBar } from '../components/WorkspaceVisuals';
import { formatDate, time } from '../lib/data';
import { useWorkspace } from '../lib/workspace';

export function GradingQueuePage() {
  const { grading, courses } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const course = courses.some((c) => c.id === params.get('course')) ? params.get('course')! : '';
  const status = ['pending', 'graded', 'empty'].includes(params.get('status') ?? '')
    ? params.get('status')
    : 'all';
  const query = params.get('q') ?? '';
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== 'all') next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const visible = grading
    .filter(
      (g) =>
        (!course || g.course.id === course) &&
        `${g.assignment.title} ${g.course.code}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()) &&
        (status === 'all' ||
          (status === 'pending'
            ? g.pending > 0
            : status === 'graded'
              ? g.graded > 0
              : g.received === 0)),
    )
    .sort(
      (a, b) => b.pending - a.pending || time(a.assignment.dueDate) - time(b.assignment.dueDate),
    );
  const received = grading.reduce((sum, g) => sum + g.received, 0);
  const pending = grading.reduce((sum, g) => sum + g.pending, 0);
  return (
    <div className="page">
      <header>
        <span className="eyebrow">Instructor workspace</span>
        <h1>Grading queue</h1>
        <p className="muted">
          Prioritize responses that need your feedback.{' '}
          <InfoButton title="Grading queue">
            <p>
              Assignments with the most ungraded responses appear first, then by deadline. Published
              grades are immediately visible to students and can be corrected. Missing submissions
              cannot be graded directly.
            </p>
          </InfoButton>
        </p>
      </header>
      <div className="queue-summary">
        <div>
          <strong>{pending}</strong>
          <span>Need grading</span>
        </div>
        <div>
          <strong>{received - pending}</strong>
          <span>Published grades</span>
        </div>
        <div>
          <strong>{received}</strong>
          <span>Responses received</span>
        </div>
        <ProgressBar
          value={received - pending}
          total={received}
          label="Received responses graded"
        />
      </div>
      <section className="card filters">
        <label>
          Search assignments
          <input
            type="search"
            value={query}
            onChange={(e) => set('q', e.target.value)}
            placeholder="Assignment or course code"
          />
        </label>
        <label>
          Course
          <select value={course} onChange={(e) => set('course', e.target.value)}>
            <option value="">All my courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </label>
        <label>
          Queue status
          <select value={status ?? 'all'} onChange={(e) => set('status', e.target.value)}>
            <option value="all">All assignments</option>
            <option value="pending">Needs grading</option>
            <option value="graded">Has published grades</option>
            <option value="empty">No submissions</option>
          </select>
        </label>
        <button className="button" onClick={() => setParams({})}>
          Reset filters
        </button>
      </section>
      <p className="muted" role="status">
        {visible.length} assignments
      </p>
      <div className="grid">
        {visible.map((g) => (
          <article className="card stack" key={g.assignment.id}>
            <div className="section-heading">
              <span className="eyebrow">{g.course.code}</span>
              <span className={`pill ${g.pending ? 'warning' : 'neutral'}`}>
                {g.pending
                  ? `${g.pending} need grading`
                  : g.received
                    ? 'Up to date'
                    : 'Awaiting submissions'}
              </span>
            </div>
            <h2>{g.assignment.title}</h2>
            <small className="muted">Due {formatDate(g.assignment.dueDate)} UTC</small>
            <div className="queue-counts">
              <span>
                <strong>
                  {g.received}/{g.enrolled}
                </strong>{' '}
                received
              </span>
              <span>
                <strong>{g.graded}</strong> graded
              </span>
              <span>
                <strong>{g.missing}</strong> missing
              </span>
            </div>
            <ProgressBar
              value={g.graded}
              total={g.received}
              label={`${g.course.code} ${g.assignment.title} responses graded`}
            />
            <Link
              className={`button ${g.pending ? 'primary' : ''}`}
              to={`/instructor/grade/${g.assignment.id}`}
            >
              Open grading workspace →
            </Link>
          </article>
        ))}
      </div>
      {!visible.length && (
        <div className="card empty-state">
          <h2>{status === 'pending' ? 'You’re caught up on grading' : 'No assignments match'}</h2>
          <p className="muted">Change your filters to review other coursework.</p>
          <button className="button" onClick={() => setParams({})}>
            Show all assignments
          </button>
        </div>
      )}
    </div>
  );
}
