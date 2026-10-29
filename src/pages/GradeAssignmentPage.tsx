import { InfoButton } from '../components/InfoButton';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { byId, formatDate, time } from '../lib/data';
import { useLms } from '../lib/LmsContext';
import { MAX_RESPONSE_LENGTH } from '../lib/store';
import type { Assignment, Submission } from '../types';
import seedStudents from '../data/students.json';

/** All submissions for one assignment, each with its own grade form. */
export function GradeAssignmentPage() {
  const { assignmentId } = useParams();
  return <GradingWorkspace key={assignmentId} assignmentId={assignmentId} />;
}
function GradingWorkspace({ assignmentId }: { assignmentId: string | undefined }) {
  const [params] = useSearchParams();
  const [filter, setFilter] = useState('all');
  const [published, setPublished] = useState('');
  const { assignments, courses, students, submissions, enrollments, session, gradeSubmission } =
    useLms();
  const assignment = byId(assignments, assignmentId);
  const course = byId(courses, assignment?.courseId);
  const [query, setQuery] = useState(() =>
    enrollments.some((e) => e.courseId === course?.id && e.studentId === params.get('student'))
      ? (byId(students, params.get('student') ?? undefined)?.name ?? '')
      : '',
  );

  if (!assignment || !course)
    return (
      <div className="page">
        <h1>Assignment not found</h1>
        <Link to="/instructor">Back</Link>
      </div>
    );
  if (course.instructorId !== session!.userId) return <Navigate to="/instructor" replace />; // not your course

  const studentName = (s: Submission) => byId(students, s.studentId)?.name ?? 'Unknown student';
  const received = submissions
    .filter(
      (s) =>
        s.assignmentId === assignment.id &&
        enrollments.some((e) => e.courseId === course.id && e.studentId === s.studentId),
    )
    .sort(
      (a, b) =>
        Number(a.score != null) - Number(b.score != null) ||
        studentName(a).localeCompare(studentName(b)),
    );
  const visible = received.filter(
    (s) =>
      studentName(s).toLowerCase().includes(query.toLowerCase().trim()) &&
      (filter === 'all' || (filter === 'pending' ? s.score == null : s.score != null)),
  );
  const missing = enrollments.filter(
    (e) => e.courseId === course.id && !received.some((s) => s.studentId === e.studentId),
  );

  return (
    <div className="page narrow">
      <header>
        <Link to="/instructor">← Instructor dashboard</Link>
        <span className="eyebrow">{course.code} · Grading</span>
        <h1>{assignment.title}</h1>
        <p className="muted">
          {received.filter((s) => s.score != null).length} of {received.length} submissions graded ·{' '}
          {assignment.pointsPossible} points possible
        </p>
      </header>
      <div className="resource-links">
        <Link to="/instructor/grading">← All grading</Link>
        <span>
          Assignment brief{' '}
          <InfoButton title="Assignment instructions">
            <p>{assignment.description}</p>
            <Link to={`/assignments/${assignment.id}`}>View assignment details →</Link>
          </InfoButton>
        </span>
      </div>
      <section className="card filters">
        <label>
          Find a student
          <input
            type="search"
            placeholder="Student name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Submission status
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All submissions</option>
            <option value="pending">Needs grading</option>
            <option value="graded">Graded</option>
          </select>
        </label>
        <span className="muted">
          {visible.length} of {received.length} responses
        </span>
      </section>
      {published && filter === 'pending' && (
        <div className="note feedback" role="status">
          {published} The response has moved out of Needs grading.
          <button className="text-button" onClick={() => setFilter('graded')}>
            View published grades
          </button>
        </div>
      )}
      {!visible.length && (
        <p className="card muted">
          {received.length
            ? 'No submissions match these filters.'
            : 'No submissions yet. Responses will appear here as students submit their work.'}
        </p>
      )}
      {missing.length > 0 && (
        <details className="policy">
          <summary>Not submitted · {missing.length} students</summary>
          <p>{missing.map((e) => byId(students, e.studentId)?.name).join(', ')}</p>
          <small className="muted">Unsubmitted work counts as zero only after the due date.</small>
        </details>
      )}
      {visible.map((s) => (
        <GradeForm
          key={s.id}
          assignment={assignment}
          submission={s}
          studentName={studentName(s)}
          onSave={(score, comment) => {
            const error = gradeSubmission(s.id, score, comment);
            if (!error) setPublished(`Grade published for ${studentName(s)}.`);
            return error;
          }}
        />
      ))}
    </div>
  );
}

interface GradeFormProps {
  assignment: Assignment;
  submission: Submission;
  studentName: string;
  onSave: (score: number, comment: string) => string | null;
}

function GradeForm({ assignment, submission, studentName, onSave }: GradeFormProps) {
  const earlierAttempts = byId(seedStudents, submission.studentId)?.attempts?.filter(
    (attempt) => attempt.assignmentId === assignment.id,
  ) ?? [];
  const [score, setScore] = useState(submission.score?.toString() ?? '');
  const [comment, setComment] = useState(submission.comment);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setScore(submission.score?.toString() ?? '');
    setComment(submission.comment);
  }, [submission.score, submission.comment]);

  // The browser enforces required + min/max on the score input before this runs.
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const message = score.trim() ? onSave(Number(score), comment) : 'Enter a score.';
    setError(message);
    setSaved(!message);
  };

  return (
    <article className="card stack">
      <h2>
        {studentName}{' '}
        <span className={`pill ${submission.score == null ? 'warning' : ''}`}>
          {submission.score == null ? 'Needs grading' : 'Graded'}
        </span>
      </h2>
      <small className="muted">
        Submitted {formatDate(submission.submittedAt)} UTC ·{' '}
        {time(submission.submittedAt) > time(assignment.dueDate)
          ? 'Late (no automatic penalty)'
          : 'On time'}
      </small>
      <div className="note">
        <strong>Submitted text</strong>
        <p>{submission.content}</p>
      </div>
      {earlierAttempts.length > 0 && (
        <details>
          <summary>Earlier submissions · {earlierAttempts.length}</summary>
          {earlierAttempts.map((attempt) => (
            <p key={attempt.submittedAt} className="muted">
              {formatDate(attempt.submittedAt)} UTC · {attempt.score} / {assignment.pointsPossible} points
            </p>
          ))}
        </details>
      )}

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          Score (out of {assignment.pointsPossible})
          <input
            type="number"
            required
            min="0"
            max={assignment.pointsPossible}
            step="any"
            value={score}
            onChange={(e) => {
              setScore(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        <label>
          Instructor comment <small className="muted">Optional</small>
          <textarea
            maxLength={MAX_RESPONSE_LENGTH}
            rows={4}
            value={comment}
            placeholder="Share specific feedback or next steps…"
            onChange={(e) => {
              setComment(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        <div className="actions">
          <button
            className="button primary"
            type="submit"
            disabled={
              !score.trim() ||
              (Number(score) === submission.score && comment.trim() === submission.comment)
            }
          >
            Save grade
          </button>
          <small className="muted">
            Saving publishes the score and feedback to the student immediately.
          </small>
          {error && (
            <span className="error" role="alert">
              {error}
            </span>
          )}
          {saved && (
            <span className="success" role="status">
              Grade published. The student can now see your feedback.
            </span>
          )}
        </div>
      </form>
    </article>
  );
}
