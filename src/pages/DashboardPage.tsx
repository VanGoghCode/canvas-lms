import { Link } from 'react-router-dom';
import { CourseCard } from '../components/CourseCard';
import { InfoButton } from '../components/InfoButton';
import { DeadlineList, ProgressRing } from '../components/WorkspaceVisuals';
import { byId, time } from '../lib/data';
import { calculateCurrentCourseGrade } from '../lib/grading';
import { generateRecommendations, getPacingSuggestion } from '../lib/recommendations';
import { useWorkspace } from '../lib/workspace';

export function DashboardPage() {
  const { session, students, courses, enrollments, assignments, submissions, work } =
    useWorkspace();
  const userId = session!.userId;
  const user = byId(students, userId);
  const missing = work.filter((w) => w.stage === 'missing');
  const pending = work.filter((w) => w.stage === 'pending');
  const graded = work.filter((w) => w.stage === 'graded');
  const outstanding = work.filter((w) => !w.submission);
  const next = outstanding[0];
  const recommendations = generateRecommendations(
    userId,
    courses,
    enrollments,
    assignments,
    submissions,
  );
  const pacing = getPacingSuggestion(userId, enrollments, assignments, submissions);
  const feedback = [...graded]
    .sort((a, b) => time(b.assignment.dueDate) - time(a.assignment.dueDate))
    .slice(0, 3);
  return (
    <div className="page">
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">Student dashboard</span>
          <h1>Welcome back, {user?.preferredName || user?.name.split(' ')[0]}.</h1>
          <p className="muted">Your learning, at a glance.</p>
        </div>
        <Link className="button" to="/schedule">
          View calendar →
        </Link>
      </header>
      <div className="kpis">
        <div>
          <span>Active courses</span>
          <strong>{courses.length.toString().padStart(2, '0')}</strong>
          <Link to="/courses">Explore coursework →</Link>
        </div>
        <div>
          <span>
            Needs attention{' '}
            <InfoButton title="Missing work">
              <p>
                Assignments past their deadline with no submitted response. Drafts do not count as
                submissions. Late work is still accepted until September 5.
              </p>
            </InfoButton>
          </span>
          <strong className={missing.length ? 'warning-text' : ''}>
            {missing.length.toString().padStart(2, '0')}
          </strong>
          <Link to="/work?status=missing">Review missing work →</Link>
        </div>
        <div>
          <span>Awaiting feedback</span>
          <strong>{pending.length.toString().padStart(2, '0')}</strong>
          <Link to="/work?status=pending">View submissions →</Link>
        </div>
        <div>
          <span>Graded assignments</span>
          <strong>{graded.length.toString().padStart(2, '0')}</strong>
          <Link to="/grades">Open gradebook →</Link>
        </div>
      </div>
      <div className="dashboard-columns">
        <section className="card progress-panel">
          <div className="section-heading">
            <h2>
              Coursework progress{' '}
              <InfoButton title="Coursework progress">
                <p>
                  Submitted assignments divided by all assignments in your enrolled courses,
                  including future work. This measures completion, not your grade. Pending and
                  graded responses both count as submitted.
                </p>
              </InfoButton>
            </h2>
            <span className="pill neutral">Mid-term</span>
          </div>
          <div className="progress-overview">
            <ProgressRing
              completed={submissions.length}
              total={assignments.length}
              label="submitted"
            />
            <div className="progress-legend">
              <div>
                <i className="dot graded" />
                <span>Graded</span>
                <strong>{graded.length}</strong>
              </div>
              <div>
                <i className="dot pending" />
                <span>Awaiting grade</span>
                <strong>{pending.length}</strong>
              </div>
              <div>
                <i className="dot missing" />
                <span>Missing</span>
                <strong>{missing.length}</strong>
              </div>
              <div>
                <i className="dot upcoming" />
                <span>Upcoming</span>
                <strong>{outstanding.length - missing.length}</strong>
              </div>
            </div>
          </div>
          <div className="next-action">
            <span className="eyebrow">YOUR NEXT STEP</span>
            <h3>
              {next
                ? next.assignment.title
                : courses.length
                  ? 'You’re up to date.'
                  : 'Choose your first course.'}
            </h3>
            <p className="muted">
              {next
                ? `${next.course.code} · ${next.hasDraft ? 'Draft ready to continue' : next.stage === 'missing' ? 'Past due · late submissions accepted' : 'Ready to start'}`
                : courses.length
                  ? 'Your submitted work is ready for instructor review.'
                  : 'Build your learning path from the course catalog.'}
            </p>
            <Link
              className="button primary"
              to={
                next
                  ? `/assignments/${next.assignment.id}`
                  : courses.length
                    ? '/grades'
                    : '/courses#catalog'
              }
            >
              {next
                ? next.hasDraft
                  ? 'Continue draft →'
                  : 'Open assignment →'
                : courses.length
                  ? 'View your results →'
                  : 'Explore courses →'}
            </Link>
          </div>
        </section>
        <DeadlineList assignments={outstanding.map((w) => w.assignment)} courses={courses} />
      </div>
      <section>
        <div className="section-heading">
          <h2>My courses</h2>
          <Link to="/courses">View all courses →</Link>
        </div>
        <div className="grid">
          {!courses.length && (
            <div className="card empty-state wide">
              <h3>Your learning path starts here</h3>
              <Link className="button" to="/courses#catalog">
                Browse the catalog
              </Link>
            </div>
          )}
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              instructorName={byId(students, course.instructorId)?.name}
              grade={calculateCurrentCourseGrade(userId, course.id, assignments, submissions)}
            />
          ))}
        </div>
      </section>
      <section className="card">
        <div className="section-heading">
          <h2>
            Feedback & results{' '}
            <InfoButton title="Feedback and results">
              <p>
                Your graded assignments, ordered by assignment deadline. Open a result to read the
                full response and any instructor feedback. Grades may be corrected by the
                instructor.
              </p>
            </InfoButton>
          </h2>
          <Link to="/grades">All results →</Link>
        </div>
        {!feedback.length && (
          <div className="empty-state compact">
            <h3>No grades published yet</h3>
            <p className="muted">
              Your results will appear here after your instructor grades your work.
            </p>
          </div>
        )}
        {feedback.map((w) => (
          <Link className="result-row" key={w.assignment.id} to={`/assignments/${w.assignment.id}`}>
            <span className="result-score">
              {w.submission!.score}
              <small>/{w.assignment.pointsPossible}</small>
            </span>
            <span>
              <strong>{w.assignment.title}</strong>
              <small>
                {w.course.code} ·{' '}
                {w.submission!.comment ? 'Written feedback available' : 'Score published'}
              </small>
            </span>
            <span>View →</span>
          </Link>
        ))}
      </section>
      <section>
        <div className="section-heading">
          <h2>
            Your study plan{' '}
            <InfoButton title="Study recommendations">
              <p>
                Suggested activities are selected using course topics and current grade bands. They
                are not hosted lessons or AI-generated advice. Optional activities do not affect
                your grade.
              </p>
            </InfoButton>
          </h2>
        </div>
        <div className="grid three">
          {recommendations.map((r) => (
            <article className="card study-card" key={r.id}>
              <span className="eyebrow">
                {r.courseCode} · {r.estimatedMinutes} MIN
              </span>
              <h3>
                {r.title}{' '}
                <InfoButton title={r.title}>
                  <p>{r.description}</p>
                  <p>{r.reason}</p>
                </InfoButton>
              </h3>
              <span className="pill neutral">
                {r.difficulty === 'remedial' ? 'Foundations' : r.difficulty}
              </span>
            </article>
          ))}
        </div>
        <div className={`pacing-strip ${pacing.status}`}>
          <span className="eyebrow">PACING</span>
          <strong>{pacing.title}</strong>
          <InfoButton title="Your pacing suggestion">
            <p>{pacing.message}</p>
          </InfoButton>
        </div>
      </section>
    </div>
  );
}
