import { Link, Navigate, useNavigate } from 'react-router-dom';
import { emptyStudentProfile, StudentProfileForm } from '../components/StudentProfileForm';
import { useLms } from '../lib/LmsContext';

export function RegisterPage() {
  const { students, session, registerStudent } = useLms();
  const navigate = useNavigate();

  if (session) {
    return <Navigate to={session.role === 'student' ? '/dashboard' : '/instructor'} replace />;
  }

  return (
    <main className="registration-page">
      <div className="registration-container">
        <header className="registration-header">
          <Link className="brand-link" to="/login">Canvas Lite</Link>
          <span className="eyebrow">Student registration</span>
          <h1>Create your student record</h1>
          <p className="muted">Provide the information the university needs to create your enrollment record.</p>
        </header>
        <StudentProfileForm
          initialValue={emptyStudentProfile}
          submitLabel="Create student account"
          emailExists={(email) => students.some((student) => student.email.toLowerCase() === email.toLowerCase())}
          onSubmit={(profile) => {
            registerStudent(profile);
            navigate('/dashboard');
          }}
        />
        <p className="form-footer">Already have a demo account? <Link to="/login">Return to login</Link></p>
      </div>
    </main>
  );
}
