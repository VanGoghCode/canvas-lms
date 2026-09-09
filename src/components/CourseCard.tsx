import { Link } from 'react-router-dom';
import type { CourseGrade } from '../lib/grading';
import type { Course } from '../types';

interface Props {
  course: Course;
  instructorName: string;
  enrollmentCount?: number;
  grade?: CourseGrade;
}

export function CourseCard({ course, instructorName, enrollmentCount, grade }: Props) {
  return (
    <article className="card course-card">
      <div>
        <span className="eyebrow">{course.code}</span>
        <h3><Link to={`/courses/${course.id}`}>{course.title}</Link></h3>
        <p className="muted">Instructor: {instructorName}</p>
      </div>
      <div className="course-meta">
        {enrollmentCount != null && <span>{enrollmentCount} enrolled</span>}
        {grade?.percentage != null && (
          <span className="grade-pill" aria-label={`Current grade ${grade.letterGrade}, ${grade.percentage}%`}>
            {grade.letterGrade} · {grade.percentage}%
          </span>
        )}
      </div>
    </article>
  );
}
