import { InfoButton } from './InfoButton';
import { Link } from 'react-router-dom';
import type { CourseGrade } from '../lib/grading';
import type { Course } from '../types';

interface Props {
  course: Course;
  instructorName?: string;
  enrollmentCount?: number;
  grade?: CourseGrade;
}

export function CourseCard({ course, instructorName, enrollmentCount, grade }: Props) {
  return (
    <article className={`card course-card course-${course.id}`}>
      <div>
        <div className="section-heading">
          <span className="eyebrow">{course.code}</span>
          <InfoButton title={`${course.code}: course overview`}>
            <p>{course.description}</p>
          </InfoButton>
        </div>
        <h3>
          <Link to={`/courses/${course.id}`}>{course.title}</Link>
        </h3>
        <p className="muted">Instructor: {instructorName ?? 'Unknown'}</p>
      </div>
      <div className="muted">
        {enrollmentCount != null && <span>{enrollmentCount} enrolled</span>}
        {grade?.percentage != null && (
          <span className={`pill ${grade.rawPercentage! < 70 ? 'warning' : 'positive'}`}>
            {grade.letterGrade} · {grade.percentage}%
          </span>
        )}
        {grade && grade.percentage == null && (
          <span className="pill neutral">No current grade</span>
        )}
        {grade && (
          <small>
            {grade.missingAssignments} missing · {grade.pendingAssignments} awaiting grade
          </small>
        )}
        <Link
          className="course-open"
          to={`/courses/${course.id}`}
          aria-label={`Open ${course.code}`}
        >
          Open course →
        </Link>
      </div>
    </article>
  );
}
