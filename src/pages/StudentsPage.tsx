import { Link } from 'react-router-dom';
import seedStudents from '../data/students.json';
import seedEnrollments from '../data/enrollments.json';
import allCourses from '../data/courses.json';
import { InfoButton } from '../components/InfoButton';
import { useUrlFilters } from '../lib/filters';
import { ProgressBar } from '../components/WorkspaceVisuals';
import { AcademicHistory } from '../components/AcademicHistory';
import { MetricChart } from '../components/MetricChart';
import { byId, ACADEMIC_DATE, time } from '../lib/data';
import { calculateCurrentCourseGrade } from '../lib/grading';
import { supportAssessment } from '../lib/support';
import { useWorkspace } from '../lib/workspace';

export function StudentsPage() {
  const { courses, students, enrollments, assignments, submissions, supportSubmissions } = useWorkspace();
  const { params, setParams, set } = useUrlFilters();
  const query = params.get('q') ?? '';
  const support = params.get('status') === 'support';
  const course = courses.some((c) => c.id === params.get('course')) ? params.get('course')! : '';
  const rows = enrollments
    .filter((e) => courses.some((c) => c.id === e.courseId))
    .map((e) => {
      const student = byId(students, e.studentId)!;
      const seedProfile = byId(seedStudents, e.studentId);
      const otherCourses = seedEnrollments
        .filter((enrollment) => enrollment.studentId === e.studentId && enrollment.courseId !== e.courseId)
        .map((enrollment) => byId(allCourses, enrollment.courseId))
        .filter((other) => other != null);
      const subject = byId(courses, e.courseId)!;
      const grade = calculateCurrentCourseGrade(e.studentId, e.courseId, assignments, submissions);
      const assessment = supportAssessment(e.studentId, e.courseId, assignments, supportSubmissions);
      const due = assignments.filter(
        (a) => a.courseId === e.courseId && time(a.dueDate) <= ACADEMIC_DATE.getTime(),
      );
      const completed = due.filter((a) =>
        submissions.some((s) => s.assignmentId === a.id && s.studentId === e.studentId),
      ).length;
      return { e, student, seedProfile, otherCourses, subject, grade, assessment, due, completed };
    })
    .filter(
      (r) =>
        (!course || r.subject.id === course) &&
        (!support || (r.assessment.needsSupport && r.assessment.completed > 0)) &&
        `${r.student.name} ${r.student.email}`.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => a.student.name.localeCompare(b.student.name));
  const checkIns = rows.filter((r) => r.assessment.needsSupport).length;
  const submitted = rows.reduce((total, r) => total + r.completed, 0);
  const due = rows.reduce((total, r) => total + r.due.length, 0);
  const gradeBands = ['A', 'B', 'C', 'D', 'F'].map((letter) => ({
    label: letter,
    values: [rows.filter((r) => r.grade.letterGrade === letter).length],
  }));
  gradeBands.push({ label: 'No current grade', values: [rows.filter((r) => r.grade.letterGrade == null).length] });
  return (
    <div className="page">
      <header>
        <span className="eyebrow">Instructor workspace</span>
        <h1>Students & support</h1>
        <p className="muted">
          Know who is progressing and who may need a check-in.{' '}
          <InfoButton title="Student support">
            <p>
              Only students enrolled in your assigned courses appear here. Review students who may
              need a check-in. Some bundled profile details appear in the roster.
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
          At-risk status
          <select value={support ? 'support' : ''} onChange={(e) => set('status', e.target.value)}>
            <option value="">All students</option>
            <option value="support">At risk · needs a check-in</option>
          </select>
        </label>
        <button className="button" onClick={() => setParams({})}>
          Reset filters
        </button>
      </section>
      <section aria-labelledby="roster-overview-heading" className="roster-overview">
        <div className="section-heading">
          <div>
            <h2 id="roster-overview-heading">Roster overview</h2>
            <p className="muted">Based on the {rows.length} course enrollments in this view. A student in more than one course is counted once per course.</p>
          </div>
        </div>
        {rows.length > 0 ? (
          <div className="roster-charts">
            <div className="risk-overview">
              <MetricChart
                title="At-risk students"
                description="Enrollments by the support indicator shown on each card."
                series={['Enrollments']}
                rows={[
                  { label: 'At risk', values: [checkIns] },
                  { label: 'Not flagged', values: [rows.length - checkIns] },
                ]}
                unit=""
                max={rows.length}
              />
              {!support && <button className="button" onClick={() => set('status', 'support')}>View at-risk students →</button>}
            </div>
            <MetricChart
              title="Current grades"
              description="Enrollments grouped by their current course grade."
              series={['Enrollments']}
              rows={gradeBands}
              unit=""
              max={rows.length}
            />
            <MetricChart
              title="Due work"
              description="Past-due assignments across these enrollments, including work awaiting a grade."
              series={['Assignments']}
              rows={[
                { label: 'Submitted', values: [submitted] },
                { label: 'Not submitted', values: [due - submitted] },
              ]}
              unit=""
              max={Math.max(1, due)}
            />
          </div>
        ) : <p className="muted">No enrollments match these filters.</p>}
      </section>
      <div className="section-heading">
        <h2>{support ? 'At-risk students' : 'Course roster'}</h2>
        <small className="muted" role="status">
          {rows.length} course enrollments
        </small>
      </div>
      <div className="student-roster">
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
            <small>
              <span aria-hidden="true" className={`support-dot ${r.assessment.needsSupport ? 'alert' : 'clear'}`} />{' '}
              {r.assessment.needsSupport ? 'Needs a check-in' : 'No check-in suggested'}
            </small>
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
            {r.assessment.needsSupport && (
              <div className="support-hint">
                <strong>Likely to struggle in this course</strong>
              </div>
            )}
            {Boolean(r.seedProfile?.history.length) && (
              <details>
                <summary>Previous years</summary>
                <AcademicHistory studentId={r.student.id} instructor />
              </details>
            )}
            {r.seedProfile && (
              <details>
                <summary>Profile and enrollment details</summary>
                <p className="muted">
                  Gender: {r.seedProfile.genderIdentity || 'Not provided'} · Ethnicity: {r.seedProfile.ethnicity || 'Not provided'} · Race: {r.seedProfile.races.join(', ') || 'Not provided'}
                </p>
                {r.otherCourses.length > 0 && (
                  <p className="muted">Other enrollments: {r.otherCourses.map((other) => other.code).join(', ')}</p>
                )}
              </details>
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
