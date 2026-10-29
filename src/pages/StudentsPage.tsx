import { Link } from 'react-router-dom';
import { InfoButton } from '../components/InfoButton';
import { useUrlFilters } from '../lib/filters';
import { ProgressBar } from '../components/WorkspaceVisuals';
import { byId, ACADEMIC_DATE, time } from '../lib/data';
import { calculateCurrentCourseGrade } from '../lib/grading';
import { useWorkspace } from '../lib/workspace';

export function StudentsPage() {
  const { courses, students, enrollments, assignments, submissions } = useWorkspace();
  const { params, setParams, set } = useUrlFilters();
  const query = params.get('q') ?? '';
  const support = params.get('status') === 'support';
  const course = courses.some((c) => c.id === params.get('course')) ? params.get('course')! : '';
  const rows = enrollments
    .filter((e) => courses.some((c) => c.id === e.courseId))
    .map((e) => {
      const student = byId(students, e.studentId)!;
      const subject = byId(courses, e.courseId)!;
      const grade = calculateCurrentCourseGrade(e.studentId, e.courseId, assignments, submissions);
      const due = assignments.filter(
        (a) => a.courseId === e.courseId && time(a.dueDate) <= ACADEMIC_DATE.getTime(),
      );
      const completed = due.filter((a) =>
        submissions.some((s) => s.assignmentId === a.id && s.studentId === e.studentId),
      ).length;
      return { e, student, subject, grade, due, completed };
    })
    .filter(
      (r) =>
        (!course || r.subject.id === course) &&
        (!support || (r.grade.rawPercentage != null && r.grade.rawPercentage < 70)) &&
        `${r.student.name} ${r.student.email}`.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => a.student.name.localeCompare(b.student.name));
  return (
    <div className="page">
      <header>
        <span className="eyebrow">Instructor workspace</span>
        <h1>Students & support</h1>
        <p className="muted">
          Know who is progressing and who may need a check-in.{' '}
          <InfoButton title="Student support">
            <p>
              Only students enrolled in your assigned courses appear here. Support flags use current
              unrounded course grades below 70%, including overdue missing work. A flag suggests a
              conversation; it is not a diagnosis or an automatic sanction. Demographic profile
              fields are not shown or used.
            </p>
          </InfoButton>
        </p>
      </header>
      <section className="card filters">
        <label>
          Search students
          <input
            type="search"
            value={query}
            onChange={(e) => set('q', e.target.value)}
            placeholder="Name or email"
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
          Support status
          <select value={support ? 'support' : ''} onChange={(e) => set('status', e.target.value)}>
            <option value="">All students</option>
            <option value="support">Needs a check-in</option>
          </select>
        </label>
        <button className="button" onClick={() => setParams({})}>
          Reset filters
        </button>
      </section>
      <div className="section-heading">
        <h2>{support ? 'Suggested check-ins' : 'Course roster'}</h2>
        <small className="muted" role="status">
          {rows.length} course enrollments
        </small>
      </div>
      <div className="grid">
        {rows.map((r) => (
          <article className="card stack student-card" key={r.e.id}>
            <div className="section-heading">
              <div className="student-identity">
                <span className="avatar">
                  {r.student.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <div>
                  <h3>{r.student.name}</h3>
                  <small className="muted">
                    {r.subject.code} · {r.student.email}
                  </small>
                </div>
              </div>
              <span
                className={`pill ${r.grade.rawPercentage != null && r.grade.rawPercentage < 70 ? 'warning' : 'neutral'}`}
              >
                {r.grade.percentage == null
                  ? 'No current grade'
                  : `${r.grade.letterGrade} · ${r.grade.percentage}%`}
              </span>
            </div>
            <div className="completion-line">
              <small>
                Due work submitted · {r.completed}/{r.due.length}{' '}
                <InfoButton title={`${r.student.name}: due-work completion`}>
                  <p>
                    Counts responses for assignments whose deadlines have passed, including work
                    waiting for a grade. Future work is excluded. {r.grade.missingAssignments}{' '}
                    missing; {r.grade.pendingAssignments} awaiting grading.
                  </p>
                </InfoButton>
              </small>
              <ProgressBar
                value={r.completed}
                total={r.due.length}
                label={`${r.student.name} ${r.subject.code} due work submitted`}
              />
            </div>
            {r.grade.rawPercentage != null && r.grade.rawPercentage < 70 && (
              <div className="support-hint">
                <strong>
                  {r.grade.missingAssignments
                    ? `${r.grade.missingAssignments} missing assignments`
                    : 'Review learning progress'}
                </strong>
                <InfoButton title={`${r.student.name}: suggested check-in`}>
                  <p>
                    {r.grade.missingAssignments
                      ? 'Help the student prioritize missing work and agree on a completion plan. Late work is still accepted without an automatic penalty.'
                      : 'Review feedback together and offer targeted practice or office hours.'}
                  </p>
                </InfoButton>
              </div>
            )}
            <details>
              <summary>View coursework</summary>
              <div className="student-coursework">
                {assignments
                  .filter((a) => a.courseId === r.subject.id)
                  .map((a) => {
                    const response = submissions.find(
                      (s) => s.assignmentId === a.id && s.studentId === r.student.id,
                    );
                    return (
                      <div key={a.id}>
                        <span>
                          {a.title}
                          <small className="muted">
                            {response
                              ? response.score == null
                                ? 'Awaiting grade'
                                : `${response.score}/${a.pointsPossible} points`
                              : time(a.dueDate) <= ACADEMIC_DATE.getTime()
                                ? 'Missing'
                                : 'Not yet due'}
                          </small>
                        </span>
                        {response ? (
                          <Link to={`/instructor/grade/${a.id}?student=${r.student.id}`}>
                            Review →
                          </Link>
                        ) : (
                          <small className="muted">No response</small>
                        )}
                      </div>
                    );
                  })}
              </div>
            </details>
          </article>
        ))}
      </div>
      {!rows.length && (
        <div className="card empty-state">
          <h2>No students match this view</h2>
          <button className="button" onClick={() => setParams({})}>
            Show all students
          </button>
        </div>
      )}
    </div>
  );
}
