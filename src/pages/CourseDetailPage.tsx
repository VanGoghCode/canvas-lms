import { Link, useParams } from 'react-router-dom';
import { AssignmentList } from '../components/AssignmentList';
import { getCourseAssignments, getCourseById, getStudentById } from '../lib/data';
import { useLms } from '../lib/LmsContext';

export function CourseDetailPage() {
  const { id } = useParams();
  const { courses, students, assignments } = useLms();
  const course = id ? getCourseById(courses, id) : undefined;
  if (!course) return <div className="page"><h1>Course not found</h1><Link to="/courses">Back to courses</Link></div>;

  const courseAssignments = getCourseAssignments(assignments, course.id);
  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">{course.code}</span>
        <h1>{course.title}</h1>
        <p>{course.description}</p>
        <p className="muted">Instructor: {getStudentById(students, course.instructorId)?.name}</p>
      </header>
      <section><div className="section-heading"><h2>Assignments</h2><span>{courseAssignments.length} total</span></div><AssignmentList assignments={courseAssignments} /></section>
      <section className="card prose"><h2>Syllabus</h2><p>{course.syllabus}</p></section>
    </div>
  );
}
