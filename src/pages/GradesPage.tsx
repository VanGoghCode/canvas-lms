import { Link, useSearchParams } from 'react-router-dom';
import { InfoButton } from '../components/InfoButton';
import { ProgressBar } from '../components/WorkspaceVisuals';
import { calculateCurrentCourseGrade } from '../lib/grading';
import { stageLabel, stageTone, useWorkspace } from '../lib/workspace';

export function GradesPage() {
  const { session, courses, assignments, submissions, work } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const selected = courses.some((c) => c.id === params.get('course')) ? params.get('course')! : '';
  const visible = courses.filter((c) => !selected || c.id === selected);
  return (
    <div className="page">
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">Student workspace</span>
          <h1>Grades & feedback</h1>
          <p className="muted">
            See your progress and what to work on next.{' '}
            <InfoButton title="Progress grades">
              <p>
                Current grades are points-based, not an average of assignment percentages. Graded
                responses count toward earned points, and overdue missing work counts as zero.
                Future unsubmitted assignments and responses awaiting grading are excluded. No
                counted points means no current grade; these are not final grades.
              </p>
            </InfoButton>
          </p>
        </div>
        <label>
          Course
          <select
            value={selected}
            onChange={(e) => setParams(e.target.value ? { course: e.target.value } : {})}
          >
            <option value="">All my courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </label>
      </header>
      {!courses.length && (
        <div className="card empty-state">
          <h2>Your gradebook is ready when you are</h2>
          <Link className="button primary" to="/courses">
            Enroll in a course
          </Link>
        </div>
      )}
      {visible.map((c) => {
        const grade = calculateCurrentCourseGrade(session!.userId, c.id, assignments, submissions);
        const rows = work.filter((w) => w.course.id === c.id);
        const done = rows.filter((w) => w.submission).length;
        return (
          <section className="card stack" key={c.id}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">{c.code}</span>
                <h2>
                  <Link to={`/courses/${c.id}`}>{c.title}</Link>
                </h2>
                <small className="muted">
                  {grade.missingAssignments} missing · {grade.pendingAssignments} awaiting grade
                </small>
              </div>
              <div className="grade-total">
                <strong>{grade.percentage == null ? '—' : `${grade.percentage}%`}</strong>
                <span
                  className={`pill ${grade.rawPercentage == null ? 'neutral' : grade.rawPercentage < 70 ? 'warning' : 'positive'}`}
                >
                  {grade.letterGrade ?? 'No current grade'}
                </span>
              </div>
            </div>
            <div className="completion-line">
              <small>
                {done} of {rows.length} assignments submitted
              </small>
              <ProgressBar
                value={done}
                total={rows.length}
                label={`${c.code} assignments submitted`}
              />
            </div>
            <div className="gradebook-list">
              {rows.map((w) => (
                <div className="gradebook-row" key={w.assignment.id}>
                  <div>
                    <Link to={`/assignments/${w.assignment.id}`}>{w.assignment.title}</Link>
                    <small className="muted">
                      {w.submission?.score != null
                        ? w.submission.comment
                          ? 'Instructor feedback available'
                          : 'Score published'
                        : w.stage === 'missing'
                          ? 'Counts as zero until submitted'
                          : 'Excluded from current grade'}
                    </small>
                  </div>
                  <span className={`pill ${stageTone[w.stage]}`}>{stageLabel[w.stage]}</span>
                  <strong>
                    {w.submission?.score != null
                      ? `${w.submission.score} / ${w.assignment.pointsPossible}`
                      : w.stage === 'missing'
                        ? `0 / ${w.assignment.pointsPossible}`
                        : `— / ${w.assignment.pointsPossible}`}
                  </strong>
                  <Link
                    to={`/assignments/${w.assignment.id}`}
                    aria-label={`View ${c.code} ${w.assignment.title}`}
                  >
                    View →
                  </Link>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
