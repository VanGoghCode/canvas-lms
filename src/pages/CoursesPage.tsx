import { CourseCard } from '../components/CourseCard';
import { getCourseEnrollments, getStudentById } from '../lib/data';
import { useLms } from '../lib/LmsContext';

export function CoursesPage() {
  const { courses, students, enrollments } = useLms();
  return (
    <div className="page">
      <header className="page-header"><span className="eyebrow">Catalog</span><h1>Courses</h1><p className="muted">All demo courses and current enrollment counts.</p></header>
      <div className="grid">
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            instructorName={getStudentById(students, course.instructorId)?.name ?? 'Unknown'}
            enrollmentCount={getCourseEnrollments(enrollments, course.id).length}
          />
        ))}
      </div>
    </div>
  );
}
