import { Link } from 'react-router-dom';
import { InfoButton } from '../components/InfoButton';
import {
  DeadlineList,
  GradeDistribution,
  ProgressRing,
  ProgressBar,
} from '../components/WorkspaceVisuals';
import { useCourseAnalytics } from '../lib/analytics';
import { byId, courseStudentIds, time } from '../lib/data';
import { identifyStudentsAtRisk } from '../lib/grading';
import { useWorkspace } from '../lib/workspace';

export function InstructorPage() {
  const { session, students, courses, assignments, submissions, enrollments, grading } =
    useWorkspace();
  const user = byId(students, session!.userId);
  const pending = submissions.filter((s) => s.score == null).length;
  const roster = new Set(
    enrollments.filter((e) => courses.some((c) => c.id === e.courseId)).map((e) => e.studentId),
  );
  const risk = courses.flatMap((c) =>
    identifyStudentsAtRisk(courseStudentIds(enrollments, c.id), c.id, assignments, submissions),
  );
  const { data: courseAnalytics, error: analyticsError } = useCourseAnalytics(
    courses.map((course) => ({ courseId: course.id, filters: { assignmentId: '', dateFrom: '', dateTo: '' } })),
    assignments, submissions, enrollments,
  );
  const analytics = courseAnalytics?.map((data, index) => ({ course: courses[index], data })) ?? [];
  const distribution = ['A', 'B', 'C', 'D', 'F'].map((letter) =>
    analytics.reduce(
      (sum, a) => sum + (a.data.gradeDistribution.find((g) => g.grade === letter)?.students ?? 0),
      0,
    ),
  );
  const queue = [...grading]
    .sort(
      (a, b) => b.pending - a.pending || time(a.assignment.dueDate) - time(b.assignment.dueDate),
    )
    .slice(0, 6);
  return (
    <div className="page">
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">Instructor dashboard</span>
          <h1>Instructor dashboard</h1>
          <p className="muted">
            Welcome back, {user?.preferredName || user?.name.split(' ')[0]}.
          </p>
        </div>
        <Link className="button primary" to="/instructor/grading?status=pending">
          Review grading queue →
        </Link>
      </header>
      <div className="kpis">
        <div>
          <span>Teaching</span>
          <strong>{courses.length}</strong>
          <Link to="/courses">Open courses →</Link>
        </div>
        <div>
          <span>Enrolled students</span>
          <strong>{roster.size}</strong>
          <Link to="/instructor/students">View roster →</Link>
        </div>
        <div>
          <span>Needs grading</span>
          <strong>{pending}</strong>
          <Link to="/instructor/grading?status=pending">Review responses →</Link>
        </div>
        <div>
          <span>
            Support check-ins{' '}
            <InfoButton title="Support check-ins">
              <p>
                Course enrollments with a current grade below 70%. A student enrolled in more than
                one of your courses can have more than one flag. This is a support signal, not an
                academic sanction.
              </p>
            </InfoButton>
          </span>
          <strong className={risk.length ? 'warning-text' : ''}>{risk.length}</strong>
          <Link to="/instructor/students?status=support">See support needs →</Link>
        </div>
      </div>
      <div className="dashboard-columns">
        <section className="card">
          <div className="section-heading">
            <h2>
              Grading progress{' '}
              <InfoButton title="Grading progress">
                <p>
                  Published grades divided by all received responses in your courses. Unsubmitted
                  work is not part of this denominator. New submissions automatically update the
                  queue.
                </p>
              </InfoButton>
            </h2>
            <span className="pill neutral">{submissions.length} responses</span>
          </div>
          <div className="progress-overview">
            <ProgressRing
              completed={submissions.length - pending}
              total={submissions.length}
              label="graded"
            />
            <div className="progress-legend">
              <div>
                <i className="dot graded" />
                <span>Published</span>
                <strong>{submissions.length - pending}</strong>
              </div>
              <div>
                <i className="dot pending" />
                <span>Awaiting review</span>
                <strong>{pending}</strong>
              </div>
            </div>
          </div>
          <div className="next-action">
            <span className="eyebrow">GRADING FOCUS</span>
            <h3>
              {pending ? `${pending} responses are ready for you` : 'You’re up to date on grading'}
            </h3>
            <Link className="text-button" to="/instructor/grading">
              {pending ? 'Open your queue' : 'Review published grades'} →
            </Link>
          </div>
        </section>
        <section className="card stack">
          <div className="section-heading">
            <h2>
              Current grade distribution{' '}
              <InfoButton title="Current grade distribution">
                <p>
                  Course enrollments grouped by points-based progress grade. Missing overdue work
                  counts as zero; pending grading is excluded. Enrollments without a current grade
                  are omitted. A student may appear once per course.
                </p>
              </InfoButton>
            </h2>
          </div>
          {analyticsError ? (
            <p role="alert">Course analytics are unavailable. Check that the local application server is running.</p>
          ) : !courseAnalytics ? (
            <p role="status">Loading course analytics…</p>
          ) : <GradeDistribution counts={distribution} />}
          <div className="section-heading">
            {courseAnalytics && <small className="muted">
              {distribution.reduce((a, b) => a + b, 0)} enrollments with a grade
            </small>}
            <Link to="/instructor/analytics">Full analytics →</Link>
          </div>
        </section>
      </div>
      <section>
        <div className="section-heading">
          <h2>
            Course health{' '}
            <InfoButton title="Course health">
              <p>
                Average grade is the mean of available student progress grades. Due-work completion
                measures received work for assignments whose deadlines have passed. These are
                separate measures; a high submission rate does not guarantee high scores.
              </p>
            </InfoButton>
          </h2>
          <Link to="/courses">Manage coursework →</Link>
        </div>
        {analyticsError && <p role="alert">Course analytics are unavailable. Check that the local application server is running.</p>}
        {!courseAnalytics && !analyticsError && <p role="status">Loading course analytics…</p>}
        <div className="grid course-health-grid">
          {analytics.map(({ course, data }) => (
            <article className="card stack" key={course.id}>
              <span className="eyebrow">
                {course.code} · {courseStudentIds(enrollments, course.id).length} students
              </span>
              <h3>
                <Link to={`/courses/${course.id}`}>{course.title}</Link>
              </h3>
              <div className="course-health-metrics">
                <div>
                  <strong>{data.overallAverage == null ? '—' : `${data.overallAverage}%`}</strong>
                  <small>Average progress grade</small>
                </div>
                <div>
                  <strong>
                    {data.overallCompletion == null ? '—' : `${data.overallCompletion}%`}
                  </strong>
                  <small>Due-work completion</small>
                </div>
              </div>
              <ProgressBar
                value={data.overallCompletion ?? 0}
                total={100}
                label={`${course.code} due-work completion percent`}
              />
              <Link className="text-button" to={`/instructor/students?course=${course.id}`}>
                Open course roster →
              </Link>
            </article>
          ))}
        </div>
        {!courses.length && (
          <p className="card muted">No courses are assigned to this instructor.</p>
        )}
      </section>
      <div className="dashboard-columns">
        <section className="card">
          <div className="section-heading">
            <h2>Assignment grading</h2>
            <Link to="/instructor/grading">All assignments →</Link>
          </div>
          <div className="dashboard-queue">
            {queue.map((g) => (
              <Link
                key={g.assignment.id}
                to={`/instructor/grade/${g.assignment.id}`}
                aria-label={`Grade submissions for ${g.assignment.title}`}
              >
                <span>
                  <strong>{g.assignment.title}</strong>
                  <small>
                    {g.course.code} · {g.received}/{g.enrolled} received
                  </small>
                </span>
                <span className={`pill ${g.pending ? 'warning' : 'neutral'}`}>
                  {g.pending ? `${g.pending} to grade` : g.received ? 'Graded' : 'No responses'}
                </span>
                <span>→</span>
              </Link>
            ))}
          </div>
        </section>
        <DeadlineList assignments={assignments} courses={courses} instructor />
      </div>
      <section className="card">
        <div className="section-heading">
          <h2>
            Student support{' '}
            <InfoButton title="Support priorities">
              <p>
                Review missing assignments and instructor feedback before deciding on support. Use
                your institution’s communication channels to follow up with students.
              </p>
            </InfoButton>
          </h2>
          <Link to="/instructor/students?status=support">View check-ins →</Link>
        </div>
        <div className="support-summary">
          <div>
            <strong>{risk.filter((r) => r.grade.missingAssignments > 0).length}</strong>
            <span>Flagged enrollments with missing work</span>
          </div>
          <div>
            <strong>{risk.filter((r) => r.grade.missingAssignments === 0).length}</strong>
            <span>Flagged enrollments with all due work submitted</span>
          </div>
        </div>
      </section>
    </div>
  );
}
