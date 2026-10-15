import { InfoButton } from '../components/InfoButton';
import { Link, Navigate } from 'react-router-dom';
import { StudentProfileForm } from '../components/StudentProfileForm';
import { emptyStudentProfile } from '../lib/data';
import { homePath, useLms } from '../lib/LmsContext';

export function RegisterPage() {
  const { students, session, registerStudent } = useLms();
  if (session) return <Navigate to={homePath(session.role)} replace />; // also runs right after registering

  return (
    <main className="page narrow">
      <header>
        <Link to="/login">← Back to login</Link>
        <h1>Create your student record</h1>
        <p className="muted">
          Name and email are required.{' '}
          <InfoButton title="Creating a student account">
            <p>
              Your student profile is saved in this browser. After registration, browse the course
              catalog and enroll in your first course. You can edit optional profile details later.
            </p>
          </InfoButton>
        </p>
      </header>
      <StudentProfileForm
        initialValue={emptyStudentProfile}
        submitLabel="Create student account"
        emailExists={(email) => students.some((s) => s.email.toLowerCase() === email.toLowerCase())}
        onSubmit={registerStudent}
      />
    </main>
  );
}
