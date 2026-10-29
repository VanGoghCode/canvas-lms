import { Link } from 'react-router-dom';
import { InfoButton } from '../components/InfoButton';
import { useUrlFilters } from '../lib/filters';
import { formatDate } from '../lib/data';
import { stageLabel, stageTone, useWorkspace } from '../lib/workspace';

export function WorkPage() {
  const { work, courses } = useWorkspace();
  const { params, setParams, set } = useUrlFilters({ omitAll: true });
  const status = ['missing', 'upcoming', 'pending', 'graded', 'draft'].includes(
    params.get('status') ?? '',
  )
    ? params.get('status')!
    : 'all';
  const course = courses.some((c) => c.id === params.get('course')) ? params.get('course')! : '';
  const query = params.get('q') ?? '';
  const matching = work.filter(
    (w) =>
      (!course || w.course.id === course) &&
      `${w.assignment.title} ${w.course.code}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const matchesStatus = (w: (typeof work)[number], key: string) =>
    key === 'all' || (key === 'draft' ? w.hasDraft && w.stage !== 'graded' : w.stage === key);
  const visible = matching.filter((w) => matchesStatus(w, status));
  return (
    <div className="page">
      <header>
        <span className="eyebrow">Student workspace</span>
        <h1>Assignment planner</h1>
        <p className="muted">
          Keep every deadline and draft in view.{' '}
          <InfoButton title="Assignment planner">
            <p>
              Work is ordered by deadline. A draft is saved privately in your browser; use Submit
              assignment to share it with your instructor. Missing work remains open until September
              5.
            </p>
          </InfoButton>
        </p>
      </header>
      <div className="filter-tabs" role="group" aria-label="Filter assignments">
        {[
          ['all', 'All work'],
          ['missing', 'Missing'],
          ['upcoming', 'Upcoming'],
          ['pending', 'Awaiting grade'],
          ['graded', 'Graded'],
          ['draft', 'Drafts'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={status === key}
            onClick={() => set('status', key)}
          >
            {label}
            <span>
              {matching.filter((w) => matchesStatus(w, key)).length}
            </span>
          </button>
        ))}
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
        <button className="button" onClick={() => setParams({})}>
          Reset filters
        </button>
      </section>
      <div className="section-heading">
        <h2>
          {status === 'all'
            ? 'All assignments'
            : status === 'draft'
              ? 'Saved drafts'
              : stageLabel[status as keyof typeof stageLabel]}
        </h2>
        <small className="muted" role="status">
          {visible.length} assignments
        </small>
      </div>
      <div className="work-list">
        {visible.map((w) => (
          <article className="card work-item" key={w.assignment.id}>
            <span className={`course-token course-token-${w.course.id}`}>{w.course.code}</span>
            <div>
              <h3>
                <Link to={`/assignments/${w.assignment.id}`}>{w.assignment.title}</Link>
              </h3>
              <small className="muted">
                Due {formatDate(w.assignment.dueDate)} UTC · {w.assignment.pointsPossible} points
              </small>
            </div>
            <div className="work-item-status">
              <span className={`pill ${stageTone[w.stage]}`}>{stageLabel[w.stage]}</span>
              {w.hasDraft && w.stage !== 'graded' && <small>Draft saved</small>}
            </div>
            <Link className="button" to={`/assignments/${w.assignment.id}`}>
              {w.stage === 'graded'
                ? 'View result'
                : w.hasDraft
                  ? 'Continue draft'
                  : w.submission
                    ? 'View submission'
                    : 'Start assignment'}
            </Link>
          </article>
        ))}
      </div>
      {!visible.length && (
        <div className="card empty-state">
          <h2>{work.length ? 'No work in this view' : 'No assignments yet'}</h2>
          <p className="muted">
            {work.length
              ? 'Choose another status or reset your filters.'
              : 'Enroll in a course to start planning your work.'}
          </p>
          {work.length ? (
            <button className="button" onClick={() => setParams({})}>
              Show all assignments
            </button>
          ) : (
            <Link className="button primary" to="/courses">
              Browse courses
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
