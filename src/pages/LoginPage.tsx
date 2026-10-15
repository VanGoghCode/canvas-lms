import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { homePath, useLms } from '../lib/LmsContext';
import { usersForRole } from '../lib/data';
import { Icon } from '../components/Icon';
import type { Role } from '../types';

export function LoginPage() {
  const { students, courses, session, login, storageWarning } = useLms();
  const location = useLocation();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [error, setError] = useState<string | null>(null);
  const users = usersForRole(students, courses, role);
  const selectedUserId = users.some((user) => user.id === userId) ? userId : (users[0]?.id ?? '');
  const requested = location.state?.from;
  const destination =
    typeof requested === 'string' &&
    /^\/(courses|assignments|dashboard|profile|instructor|work|grades|schedule)([/?#]|$)/.test(
      requested,
    )
      ? requested
      : session
        ? homePath(session.role)
        : '/dashboard';
  if (session) return <Navigate to={destination} replace />;
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(login(selectedUserId, role));
  };
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="book" />
          </span>
          Canvas <span className="brand-lite">Learning</span>
        </div>
        <div className="auth-message">
          <span className="eyebrow">A LITTLE STRUCTURE. A LOT OF POSSIBILITY.</span>
          <h1>
            A clearer path
            <br />
            to learning.
          </h1>
          <p>
            Your courses, your progress, and your next step.
            <br />
            All together in one thoughtful workspace.
          </p>
          <div className="auth-preview">
            <span className="eyebrow">YOUR LEARNING JOURNEY</span>
            <div>
              <span className="step-dot">1</span>Find your course
              <Icon name="check" />
            </div>
            <div>
              <span className="step-dot">2</span>Make meaningful progress
              <Icon name="check" />
            </div>
            <div>
              <span className="step-dot">3</span>Get feedback. Keep growing.
              <Icon name="arrow" />
            </div>
          </div>
        </div>
        <small>Canvas Learning · Learning management</small>
      </section>
      <section className="auth-form-area">
        <form className="stack login" onSubmit={handleSubmit}>
          <div>
            <span className="pill neutral">Learning workspace</span>
            <h2 className="auth-title">Welcome back</h2>
            <p className="muted">Select your role and account to continue to your workspace.</p>
          </div>
          <fieldset>
            <legend>Your role</legend>
            <div className="segmented">
              {(['student', 'instructor'] as const).map((item) => (
                <label key={item} className={role === item ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="role"
                    checked={role === item}
                    onChange={() => {
                      setRole(item);
                      setUserId('');
                      setError(null);
                    }}
                  />
                  {item === 'student' ? 'Student' : 'Instructor'}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Account
            <select
              value={selectedUserId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={!users.length}
            >
              {users.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <p className="account-hint">
            {role === 'student'
              ? 'Explore courses, submit assignments, and see your feedback.'
              : `Review submissions, publish grades, and track progress in ${courses.find((c) => c.instructorId === selectedUserId)?.code ?? 'your courses'}.`}
          </p>
          {(error || storageWarning) && (
            <p className="error" role="alert">
              {error || storageWarning}
            </p>
          )}
          <button className="button primary enter-button" type="submit" disabled={!selectedUserId}>
            Enter workspace <Icon name="arrow" />
          </button>
          <p className="auth-register">
            Starting fresh? <Link to="/register">Create a student account</Link>
          </p>
          <div className="auth-footnote">
            Summer term · 2026
            <br />
            Your changes stay saved in this browser.
          </div>
        </form>
      </section>
    </main>
  );
}
