import { ProgressBar } from '../components/WorkspaceVisuals';
import { calculateCurrentCourseGrade } from '../lib/grading';
import { InfoButton } from '../components/InfoButton';
import { Link, useParams } from 'react-router-dom';
import {
  assignmentStatus,
  byId,
  canAccessCourse,
  courseAssignments,
  findSubmission,
  formatDate,
  statusTone,
} from '../lib/data';
import { useLms } from '../lib/LmsContext';

export function CourseDetailPage() {
  const { id } = useParams();
  const { courses, students, assignments, enrollments, session, submissions } = useLms();
  const course = byId(courses, id);
  if (!course || !canAccessCourse(session!.userId, session!.role, course, enrollments))
    return (
      <div className="page">
        <h1>Course unavailable</h1>
        <p>You must be enrolled in this course or assigned to teach it.</p>
        <Link to="/courses">Back to courses</Link>
      </div>
    );

  const list = courseAssignments(assignments, course.id);
  const isStudent = session!.role === 'student';
  const received = submissions.filter(
    (s) =>
      list.some((a) => a.id === s.assignmentId) && (!isStudent || s.studentId === session!.userId),
  );
  const grade = calculateCurrentCourseGrade(session!.userId, course.id, assignments, submissions);
  const totalPoints = list.reduce((sum, a) => sum + a.pointsPossible, 0);
  return (
    <div className="page">
      <header>
        <Link className="back-link" to="/courses">
          ← My courses
        </Link>
        <span className="eyebrow">{course.code}</span>
        <h1>{course.title}</h1>

        <p className="muted">Instructor: {byId(students, course.instructorId)?.name}</p>
        <p className="muted">{course.description}</p>
        <div className="resource-links">
          <span>
            Course overview{' '}
            <InfoButton title={`${course.code}: overview`}>
              <p>{course.description}</p>
            </InfoButton>
          </span>
          <span>
            Syllabus{' '}
            <InfoButton title={`${course.code}: syllabus`}>
              <p>{course.syllabus}</p>
            </InfoButton>
          </span>
          <span>
            Grading policy{' '}
            <InfoButton title="Course grading policy">
              <p>
                Grades are points-based. Overdue missing work counts as zero; responses awaiting
                grading are excluded. Late work is accepted through September 5, 2026, 23:59 UTC
                without an automatic penalty. Graded work cannot be resubmitted.
              </p>
            </InfoButton>
          </span>
          <Link
            to={
              isStudent ? `/grades?course=${course.id}` : `/instructor/students?course=${course.id}`
            }
          >
            {isStudent ? 'Course gradebook' : 'Course roster'} →
          </Link>
        </div>
      </header>
      <div className="course-overview-strip">
        <div>
          <strong>{list.length}</strong>
          <span>Assignments</span>
        </div>
        <div>
          <strong>{totalPoints}</strong>
          <span>Total course points</span>
        </div>
        <div>
          <strong>
            {isStudent
              ? grade.percentage == null
                ? '—'
                : `${grade.percentage}%`
              : received.length}
          </strong>
          <span>{isStudent ? 'Current progress grade' : 'Responses received'}</span>
        </div>
        <div>
          <strong>{received.filter((s) => s.score == null).length}</strong>
          <span>{isStudent ? 'Awaiting feedback' : 'Need grading'}</span>
        </div>
      </div>
      {isStudent && (
        <div className="card completion-line">
          <small>
            {received.length} of {list.length} assignments submitted
          </small>
          <ProgressBar
            value={received.length}
            total={list.length}
            label={`${course.code} assignments submitted`}
          />
        </div>
      )}
      <section>
        <h2>
          Assignments <small className="muted">{list.length} total</small>
        </h2>
        <div className="table-wrap">
          <table className="data-table assignment-table" aria-label="Course assignments">
            <colgroup>
              <col />
              <col className="date-column" />
              <col className="points-column" />
              {session!.role === 'student' && <col className="status-column" />}
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Assignment</th>
                <th scope="col">Due date (UTC)</th>
                <th scope="col" className="numeric">
                  Points
                </th>
                {session!.role === 'student' && <th scope="col">Status</th>}
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <th scope="row">
                    <Link
                      to={
                        session!.role === 'instructor'
                          ? `/instructor/grade/${a.id}`
                          : `/assignments/${a.id}`
                      }
                    >
                      {a.title}
                    </Link>
                  </th>
                  <td className="muted">{formatDate(a.dueDate)}</td>
                  <td className="numeric">{a.pointsPossible}</td>
                  {session!.role === 'student' && (
                    <td>
                      <span
                        className={`pill ${statusTone(assignmentStatus(a, findSubmission(submissions, a.id, session!.userId)))}`}
                      >
                        {assignmentStatus(a, findSubmission(submissions, a.id, session!.userId))}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
