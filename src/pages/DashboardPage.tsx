import { Link } from 'react-router-dom';
import { CourseCard } from '../components/CourseCard';
import { getStudentById, getStudentCourses } from '../lib/data';
import { calculateCurrentCourseGrade } from '../lib/grading';
import { useLms } from '../lib/LmsContext';
import { generateRecommendations, getPacingSuggestion } from '../lib/recommendations';

export function DashboardPage() {
  const { session, students, courses, enrollments, assignments, submissions } = useLms();
  if (!session) return null;

  const user = getStudentById(students, session.userId);
  const enrolledCourses = getStudentCourses(session.userId, courses, enrollments);
  const enrolledCourseIds = new Set(enrolledCourses.map((course) => course.id));
  const upcoming = assignments
    .filter((assignment) => enrolledCourseIds.has(assignment.courseId) && new Date(assignment.dueDate) >= new Date())
    .sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 6);
  const recommendations = generateRecommendations(
    session.userId,
    courses,
    enrollments,
    assignments,
    submissions,
  );
  const pacingSuggestion = getPacingSuggestion(
    session.userId,
    courses,
    enrollments,
    assignments,
    submissions,
  );

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Student dashboard</span>
        <h1>Welcome, {user?.preferredName || user?.name.split(' ')[0]}</h1>
        <p className="muted">Your courses, upcoming work, and current graded averages.</p>
      </header>

      <section>
        <div className="section-heading"><h2>My courses</h2><span>{enrolledCourses.length} courses</span></div>
        <div className="grid">
          {enrolledCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              instructorName={getStudentById(students, course.instructorId)?.name ?? 'Unknown'}
              grade={calculateCurrentCourseGrade(session.userId, course.id, assignments, submissions)}
            />
          ))}
        </div>
      </section>

      <section className="card recommendation-card" aria-labelledby="recommendation-heading">
        <header className="recommendation-heading">
          <div>
            <span className="eyebrow">Personalized learning</span>
            <h2 id="recommendation-heading">Recommended for you</h2>
          </div>
          <span className="recommendation-refresh">Updates with your grades</span>
        </header>

        <div className="recommendation-list">
          {recommendations.map((recommendation) => (
            <article className="recommendation-item" key={recommendation.id}>
              <div className="recommendation-meta">
                <span>{recommendation.courseCode}</span>
                <span>{recommendation.difficulty}</span>
              </div>
              <h3>{recommendation.title}</h3>
              <p>{recommendation.description}</p>
              <footer>
                <span>{recommendation.reason}</span>
                <strong>{recommendation.estimatedMinutes} min</strong>
              </footer>
            </article>
          ))}
        </div>

        <aside className={`pacing-suggestion ${pacingSuggestion.status}`}>
          <div className="pacing-icon" aria-hidden="true">↗</div>
          <div>
            <span className="eyebrow">Pacing suggestion</span>
            <h3>{pacingSuggestion.title}</h3>
            <p>{pacingSuggestion.message}</p>
          </div>
        </aside>
      </section>

      <section>
        <div className="section-heading"><h2>Upcoming assignments</h2><span>Next {upcoming.length}</span></div>
        <div className="list">
          {upcoming.map((assignment) => {
            const course = courses.find((item) => item.id === assignment.courseId);
            return (
              <Link className="list-row" to={`/assignments/${assignment.id}`} key={assignment.id}>
                <div><strong>{assignment.title}</strong><span className="muted">{course?.code} · {new Date(assignment.dueDate).toLocaleDateString()}</span></div>
                <span>{assignment.pointsPossible} pts</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
