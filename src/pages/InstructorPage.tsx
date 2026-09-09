import { Link, Navigate } from 'react-router-dom';
import { getCourseAssignments, getCourseEnrollments, getStudentById } from '../lib/data';
import { AT_RISK_GRADE_THRESHOLD, identifyStudentsAtRisk } from '../lib/grading';
import { useLms } from '../lib/LmsContext';

export function InstructorPage() {
  const { session, courses, enrollments, students, assignments, submissions } = useLms();
  if (!session) return null;
  if (session.role !== 'instructor') return <Navigate to="/dashboard" replace />;

  const ownedCourses = courses.filter((course) => course.instructorId === session.userId);
  const atRiskStudents = ownedCourses.flatMap((course) => {
    const studentIds = getCourseEnrollments(enrollments, course.id).map((enrollment) => enrollment.studentId);
    return identifyStudentsAtRisk(studentIds, course.id, assignments, submissions);
  }).sort((left, right) => (left.grade.percentage ?? 0) - (right.grade.percentage ?? 0));

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Instructor workspace</span>
        <h1>Courses, grading & intervention</h1>
        <p className="muted">Review submissions, record feedback, and identify students who may need support.</p>
      </header>

      {ownedCourses.length === 0 ? (
        <div className="card empty-state">
          <h2>No assigned courses</h2>
          <p className="muted">This demo user is not assigned as an instructor. Log in as Ava Patel, Liam Johnson, Maya Chen, or Noah Williams to view a roster.</p>
        </div>
      ) : (
        <>
          <section className="intervention-panel" aria-labelledby="intervention-heading">
            <div className="intervention-heading">
              <div>
                <span className="eyebrow">Early intervention</span>
                <h2 id="intervention-heading">Students needing support</h2>
              </div>
              <span className="threshold-label">Below {AT_RISK_GRADE_THRESHOLD}%</span>
            </div>
            {atRiskStudents.length === 0 ? (
              <p className="intervention-empty">No students are currently below the intervention threshold.</p>
            ) : (
              <div className="risk-list">
                {atRiskStudents.map((risk) => {
                  const student = getStudentById(students, risk.studentId);
                  const course = courses.find((item) => item.id === risk.courseId);
                  return (
                    <article className="risk-item" key={`${risk.courseId}-${risk.studentId}`}>
                      <div className="risk-student">
                        <div>
                          <strong>{student?.name ?? 'Unknown student'}</strong>
                          <span>{course?.code}</span>
                        </div>
                        <span className="risk-grade">{risk.grade.letterGrade} · {risk.grade.percentage}%</span>
                      </div>
                      <p>{risk.explanation}</p>
                      <p className="suggested-action"><strong>Suggested action:</strong> {risk.suggestedAction}</p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {ownedCourses.map((course) => {
            const roster = getCourseEnrollments(enrollments, course.id)
              .map((enrollment) => getStudentById(students, enrollment.studentId))
              .filter(Boolean);
            const courseAssignments = getCourseAssignments(assignments, course.id);

            return (
              <section className="card instructor-course" key={course.id}>
                <div className="section-heading">
                  <div><span className="eyebrow">{course.code}</span><h2><Link to={`/courses/${course.id}`}>{course.title}</Link></h2></div>
                  <span>{roster.length} students</span>
                </div>

                <div>
                  <h3 className="subsection-title">Assignment grading</h3>
                  <div className="instructor-assignment-list">
                    {courseAssignments.map((assignment) => {
                      const assignmentSubmissions = submissions.filter((submission) => submission.assignmentId === assignment.id);
                      const graded = assignmentSubmissions.filter((submission) => submission.score != null).length;
                      return (
                        <Link className="instructor-assignment-row" to={`/instructor/grade/${assignment.id}`} key={assignment.id}>
                          <div><strong>{assignment.title}</strong><span>{graded}/{assignmentSubmissions.length} graded</span></div>
                          <span>Grade submissions →</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="subsection-title">Course roster</h3>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Student</th><th>Email</th></tr></thead>
                      <tbody>{roster.map((student) => student && <tr key={student.id}><td>{student.name}</td><td>{student.email}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
