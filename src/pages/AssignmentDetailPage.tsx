import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDate, getAssignmentById, getCourseById, getSubmission } from '../lib/data';
import { useLms } from '../lib/LmsContext';

export function AssignmentDetailPage() {
  const { id } = useParams();
  const { assignments, courses, submissions, session, submitAssignment } = useLms();
  const assignment = id ? getAssignmentById(assignments, id) : undefined;
  const course = assignment ? getCourseById(courses, assignment.courseId) : undefined;
  const existing = assignment && session ? getSubmission(submissions, assignment.id, session.userId) : undefined;
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { setContent(existing?.content ?? ''); setSaved(false); }, [existing?.id, assignment?.id]);

  if (!assignment || !course) return <div className="page"><h1>Assignment not found</h1><Link to="/courses">Back to courses</Link></div>;

  const canSubmit = session?.role === 'student';
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!session || !content.trim()) return;
    submitAssignment(assignment.id, session.userId, content.trim());
    setSaved(true);
  };

  return (
    <div className="page narrow">
      <header className="page-header">
        <Link className="back-link" to={`/courses/${course.id}`}>← {course.code}</Link>
        <h1>{assignment.title}</h1>
        <div className="assignment-meta"><span>Due {formatDate(assignment.dueDate)}</span><span>{assignment.pointsPossible} points</span></div>
      </header>
      <section className="card prose"><h2>Instructions</h2><p>{assignment.description}</p></section>
      {canSubmit ? (
        <section className="card">
          <div className="section-heading"><h2>Your submission</h2>{existing && <span>{existing.score == null ? 'Submitted · awaiting grade' : `Score: ${existing.score}/${assignment.pointsPossible}`}</span>}</div>
          {existing?.score != null && existing.comment && (
            <div className="instructor-feedback"><strong>Instructor feedback</strong><p>{existing.comment}</p></div>
          )}
          <form onSubmit={handleSubmit}>
            <label>Submission text<textarea rows={10} value={content} onChange={(e) => { setContent(e.target.value); setSaved(false); }} placeholder="Type your response here…" /></label>
            <div className="form-actions"><button className="button button-primary" disabled={!content.trim()} type="submit">{existing ? 'Resubmit' : 'Submit assignment'}</button>{saved && <span className="success">Saved in memory for this session.</span>}</div>
          </form>
        </section>
      ) : <section className="card"><p className="muted">Switch to a student role on the login page to submit work.</p></section>}
    </div>
  );
}
