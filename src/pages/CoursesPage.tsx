import { InfoButton } from '../components/InfoButton';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CourseCard } from '../components/CourseCard';
import { byId, canAccessCourse, courseStudentIds } from '../lib/data';
import { calculateCurrentCourseGrade } from '../lib/grading';
import { useLms } from '../lib/LmsContext';

export function CoursesPage() {
  const { courses, students, enrollments, session, enrollCourse, assignments, submissions } =
    useLms();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const visible = courses.filter((c) =>
    canAccessCourse(session!.userId, session!.role, c, enrollments),
  );
  const available = courses.filter(
    (c) =>
      !visible.includes(c) &&
      `${c.code} ${c.title}`.toLowerCase().includes(query.toLowerCase().trim()),
  );
  return (
    <div className="page">
      <header>
        <span className="eyebrow">Coursework</span>
        <h1>My courses</h1>
        <p className="muted">
          {session!.role === 'student'
            ? 'Your space to learn, practice, and make progress.'
            : 'Manage coursework and support your students.'}
        </p>
      </header>
      <div className="grid">
        {!visible.length && (
          <div className="card empty-state wide">
            <h2>Your next chapter starts here</h2>
            <p className="muted">
              Choose a course below to begin. Your assignments and progress will appear here.
            </p>
            <a className="button primary" href="#catalog">
              Browse courses
            </a>
          </div>
        )}
        {visible.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            instructorName={byId(students, course.instructorId)?.name}
            enrollmentCount={
              session!.role === 'instructor'
                ? courseStudentIds(enrollments, course.id).length
                : undefined
            }
            grade={
              session!.role === 'student'
                ? calculateCurrentCourseGrade(session!.userId, course.id, assignments, submissions)
                : undefined
            }
          />
        ))}
      </div>
      {session!.role === 'student' && (
        <section id="catalog" className="stack">
          <div className="section-heading">
            <div>
              <h2>Explore the catalog</h2>
              <p className="muted">Build your learning path with a new course.</p>
            </div>
            <label className="search-field">
              Search courses
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Course name or code"
              />
            </label>
          </div>
          <div className="note">
            Mid-term enrollment includes past-due work.{' '}
            <InfoButton title="Mid-term enrollment">
              <p>
                All six assignments apply when you enroll, including earlier deadlines. Missing
                overdue work counts as zero until submitted. Late work is accepted through September
                5 without an automatic penalty.
              </p>
            </InfoButton>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="grid">
            {available.map((c) => (
              <article className="card catalog-card stack" key={c.id}>
                <span className="eyebrow">{c.code} · 6 assignments</span>
                <h3>
                  {c.title}{' '}
                  <InfoButton title={`${c.code}: course details`}>
                    <p>{c.description}</p>
                    <p>{c.syllabus}</p>
                  </InfoButton>
                </h3>
                <small className="muted">With {byId(students, c.instructorId)?.name}</small>
                <button
                  className="button"
                  onClick={() => {
                    const message = enrollCourse(c.id);
                    setError(message);
                    if (!message) navigate(`/courses/${c.id}`);
                  }}
                >
                  Enroll in {c.code}
                </button>
              </article>
            ))}
          </div>
          {!available.length && (
            <p className="card muted">
              {query
                ? 'No courses match your search. Try a different name or code.'
                : 'You are enrolled in every available course. Your next assignment is waiting.'}{' '}
              <Link to="/dashboard">Go to overview →</Link>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
