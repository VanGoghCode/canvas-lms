import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useLms } from '../lib/LmsContext';
import type { Role } from '../types';

export function LoginPage() {
  const { students, session, login } = useLms();
  const [userId, setUserId] = useState(students[0]?.id ?? '');
  const [role, setRole] = useState<Role>('student');
  const navigate = useNavigate();

  if (session) return <Navigate to={session.role === 'student' ? '/dashboard' : '/instructor'} replace />;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    login(userId, role);
    navigate(role === 'student' ? '/dashboard' : '/instructor');
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div>
          <span className="eyebrow">Local demo</span>
          <h1>Canvas Lite</h1>
          <p className="muted">Choose any demo user and role. No password is required.</p>
        </div>
        <label>
          User
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>Role</legend>
          <div className="segmented">
            {(['student','instructor'] as Role[]).map((item) => (
              <label key={item} className={role === item ? 'selected' : ''}>
                <input type="radio" value={item} checked={role === item} onChange={() => setRole(item)} />
                {item[0].toUpperCase() + item.slice(1)}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="button button-primary" type="submit">Enter demo</button>
        <p className="form-footer">New student? <Link to="/register">Create an account</Link></p>
        <p className="hint">Tip: Ava Patel, Liam Johnson, Maya Chen, and Noah Williams each own one instructor course.</p>
      </form>
    </main>
  );
}
