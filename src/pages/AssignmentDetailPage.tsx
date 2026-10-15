import { InfoButton } from '../components/InfoButton';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  assignmentStatus,
  byId,
  canAccessCourse,
  ACADEMIC_DATE,
  findSubmission,
  formatDate,
  statusTone,
  TERM_CLOSE,
  time,
} from '../lib/data';
import { useLms } from '../lib/LmsContext';
import { draftKey, MAX_RESPONSE_LENGTH } from '../lib/store';

export function AssignmentDetailPage() {
  const { id } = useParams();
  return <AssignmentWorkspace key={id} id={id} />;
}
function AssignmentWorkspace({ id }: { id: string | undefined }) {
  const {
    assignments,
    courses,
    submissions,
    enrollments,
    session,
    submitAssignment,
    saveDraft,
    drafts,
    storageWarning,
  } = useLms();
  const assignment = byId(assignments, id);
  const course = byId(courses, assignment?.courseId);
  const existing = assignment && findSubmission(submissions, assignment.id, session!.userId);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (
    !assignment ||
    !course ||
    !canAccessCourse(session!.userId, session!.role, course, enrollments)
  )
    return (
      <div className="page">
        <h1>Assignment unavailable</h1>
        <p>You need to be enrolled in this course or assigned to teach it.</p>
        <Link to="/courses">Back to courses</Link>
      </div>
    );
  const locked = existing?.score != null || ACADEMIC_DATE > TERM_CLOSE;
  const draft = drafts[draftKey(session!.userId, assignment.id)];
  const content = locked ? (existing?.content ?? '') : (draft ?? existing?.content ?? '');
  const status = assignmentStatus(assignment, existing);
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const message = submitAssignment(assignment.id, session!.userId, content);
    setError(message);
    setSaved(!message);
  };
  return (
    <div className="page narrow">
      <header>
        <Link className="back-link" to={`/courses/${course.id}`}>
          ← {course.code} · Assignments
        </Link>
        <h1>{assignment.title}</h1>
        <div className="assignment-meta">
          <span>Due {formatDate(assignment.dueDate)} UTC</span>
          <span>{assignment.pointsPossible} points</span>
          {session!.role === 'student' && (
            <span className={`pill ${statusTone(status)}`}>{status}</span>
          )}
        </div>
      </header>
      <section className="card instructions">
        <span className="eyebrow">THE BRIEF</span>
        <h2>What you’ll work on</h2>
        <p>{assignment.description}</p>
        <div className="resource-links">
          <span className="pill neutral">Text response</span>
          <span className="pill neutral">{assignment.pointsPossible} points</span>
        </div>
      </section>
      <div className="policy">
        {time(assignment.dueDate) < ACADEMIC_DATE.getTime()
          ? 'Past due · late work is accepted.'
          : 'Early submissions are welcome.'}{' '}
        <InfoButton title="Deadlines and revisions">
          <p>
            Late work is accepted until {formatDate(TERM_CLOSE.toISOString())} UTC without an
            automatic penalty. You may revise ungraded work; each revision replaces your previous
            response and uses the latest submission time. Graded submissions are locked.
          </p>
        </InfoButton>
      </div>
      {session!.role !== 'student' ? (
        <section className="card stack">
          <h2>Review student work</h2>
          <p className="muted">
            Read responses, publish scores, and share feedback for this assignment.
          </p>
          <Link className="button primary" to={`/instructor/grade/${assignment.id}`}>
            Open grading workspace →
          </Link>
        </section>
      ) : (
        <section className="card stack">
          <div className="section-heading">
            <h2>{locked ? 'Your submitted work' : 'Your response'}</h2>
            {existing?.score != null && (
              <span className="score-display">
                {existing.score}
                <small> / {assignment.pointsPossible} pts</small>
              </span>
            )}
          </div>
          {existing && (
            <p className="muted">
              Submitted {formatDate(existing.submittedAt)} UTC ·{' '}
              {time(existing.submittedAt) > time(assignment.dueDate) ? 'Late' : 'On time'}
            </p>
          )}
          {locked && (
            <p className="muted">
              {existing?.score != null
                ? 'Your grade is published. Contact your instructor if you have questions.'
                : 'The submission window is closed.'}
            </p>
          )}
          {existing?.score != null && (
            <div className="note feedback">
              <strong>Instructor feedback</strong>
              <p>
                {existing.comment || 'Your instructor published a score without written feedback.'}
              </p>
            </div>
          )}
          <form className="stack" onSubmit={handleSubmit}>
            {!locked && (
              <p className="note" id="response-help">
                {existing
                  ? draft !== undefined && content.trim() !== existing.content
                    ? 'You have unpublished changes. Your instructor still sees your last submitted response until you resubmit.'
                    : 'Your response is submitted and awaiting a grade. You can edit it here and resubmit until it is graded.'
                  : 'Your draft is private. Select Submit assignment when you are ready to share it with your instructor.'}
              </p>
            )}
            <label>
              Submission text
              <textarea
                rows={10}
                maxLength={MAX_RESPONSE_LENGTH}
                value={content}
                readOnly={locked}
                aria-describedby={!locked ? 'response-help' : undefined}
                placeholder="Write your response here…"
                onChange={(e) => {
                  setError(saveDraft(assignment.id, e.target.value));
                  setSaved(false);
                }}
              />
            </label>
            <div className="section-heading">
              <small className="muted">
                {!locked && draft !== undefined
                  ? storageWarning
                    ? 'Draft kept in this tab'
                    : 'Draft saved in this browser'
                  : 'Text response'}
              </small>
              <small className="muted">
                {content.length.toLocaleString()} / {MAX_RESPONSE_LENGTH.toLocaleString()}
              </small>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {saved && (
              <div className="note feedback" role="status">
                <strong>Assignment submitted</strong>
                <p>
                  Your instructor can now review your response. Your grade will appear here after it
                  is published.
                </p>
              </div>
            )}
            {!locked && (
              <div className="actions">
                <button
                  className="button primary"
                  disabled={!content.trim() || content.trim() === existing?.content}
                  type="submit"
                >
                  {existing ? 'Resubmit assignment' : 'Submit assignment'}
                </button>
                <span className="muted">
                  {existing
                    ? 'Replaces your previous response'
                    : 'Sends your response to your instructor'}
                </span>
              </div>
            )}
          </form>
        </section>
      )}
      <Link to={`/courses/${course.id}`}>← Back to all assignments</Link>
    </div>
  );
}
