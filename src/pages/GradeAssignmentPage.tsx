import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { formatDate, getAssignmentById, getCourseById, getStudentById } from '../lib/data';
import { useLms } from '../lib/LmsContext';
import type { Assignment, Student, Submission } from '../types';

interface SubmissionGraderProps {
  assignment: Assignment;
  student?: Student;
  submission: Submission;
  onSave: (score: number, comment: string) => void;
}

function SubmissionGrader({ assignment, student, submission, onSave }: SubmissionGraderProps) {
  const [score, setScore] = useState(submission.score?.toString() ?? '');
  const [comment, setComment] = useState(submission.comment);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const numericScore = Number(score);
    if (score.trim() === '' || !Number.isFinite(numericScore)) {
      setError('Enter a numeric score.');
      setSaved(false);
      return;
    }
    if (numericScore < 0 || numericScore > assignment.pointsPossible) {
      setError(`Score must be between 0 and ${assignment.pointsPossible}.`);
      setSaved(false);
      return;
    }

    onSave(numericScore, comment);
    setError('');
    setSaved(true);
  };

  return (
    <article className="card grading-card">
      <header className="grading-card-header">
        <div>
          <h2>{student?.name ?? 'Unknown student'}</h2>
          <span className="muted">Submitted {formatDate(submission.submittedAt)}</span>
        </div>
        <span className={submission.score == null ? 'status-pill pending' : 'status-pill graded'}>
          {submission.score == null ? 'Needs grading' : 'Graded'}
        </span>
      </header>

      <div className="submission-content">
        <strong>Submitted text</strong>
        <p>{submission.content}</p>
      </div>

      <form className="grading-form" onSubmit={handleSubmit} noValidate>
        <label className="field score-field" htmlFor={`score-${submission.id}`}>
          <span>Score <span className="required-mark" aria-hidden="true">*</span></span>
          <div className="score-input-wrap">
            <input
              id={`score-${submission.id}`}
              type="number"
              min="0"
              max={assignment.pointsPossible}
              step="0.1"
              required
              value={score}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `score-error-${submission.id}` : undefined}
              onChange={(event) => {
                setScore(event.target.value);
                setError('');
                setSaved(false);
              }}
            />
            <span>/ {assignment.pointsPossible}</span>
          </div>
          {error && <span className="field-error" id={`score-error-${submission.id}`} role="alert">{error}</span>}
        </label>

        <label className="field" htmlFor={`comment-${submission.id}`}>
          <span>Instructor comment <span className="optional-label">Optional</span></span>
          <textarea
            id={`comment-${submission.id}`}
            rows={4}
            value={comment}
            placeholder="Share specific feedback or next steps…"
            onChange={(event) => {
              setComment(event.target.value);
              setSaved(false);
            }}
          />
        </label>

        <div className="form-actions">
          <button className="button button-primary" type="submit">Save grade</button>
          {saved && <span className="success" role="status">Grade saved.</span>}
        </div>
      </form>
    </article>
  );
}

export function GradeAssignmentPage() {
  const { assignmentId } = useParams();
  const { assignments, courses, students, submissions, session, gradeSubmission } = useLms();
  const assignment = assignmentId ? getAssignmentById(assignments, assignmentId) : undefined;
  const course = assignment ? getCourseById(courses, assignment.courseId) : undefined;

  if (session?.role !== 'instructor') return <Navigate to="/dashboard" replace />;
  if (!assignment || !course) {
    return <div className="page"><h1>Assignment not found</h1><Link to="/instructor">Back to instructor dashboard</Link></div>;
  }
  if (course.instructorId !== session.userId) return <Navigate to="/instructor" replace />;

  const assignmentSubmissions = submissions
    .filter((submission) => submission.assignmentId === assignment.id)
    .sort((left, right) => {
      const leftName = getStudentById(students, left.studentId)?.name ?? '';
      const rightName = getStudentById(students, right.studentId)?.name ?? '';
      return leftName.localeCompare(rightName);
    });
  const gradedCount = assignmentSubmissions.filter((submission) => submission.score != null).length;

  return (
    <div className="page narrow grading-page">
      <header className="page-header">
        <Link className="back-link" to="/instructor">← Instructor dashboard</Link>
        <span className="eyebrow">{course.code} · Grading</span>
        <h1>{assignment.title}</h1>
        <p className="muted">{gradedCount} of {assignmentSubmissions.length} submissions graded · {assignment.pointsPossible} points possible</p>
      </header>

      {assignmentSubmissions.length === 0 ? (
        <div className="card empty-state">
          <h2>No submissions yet</h2>
          <p className="muted">Student submissions will appear here when they are received.</p>
        </div>
      ) : assignmentSubmissions.map((submission) => (
        <SubmissionGrader
          key={submission.id}
          assignment={assignment}
          student={getStudentById(students, submission.studentId)}
          submission={submission}
          onSave={(score, comment) => gradeSubmission(submission.id, score, comment)}
        />
      ))}
    </div>
  );
}
