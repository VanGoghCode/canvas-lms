import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { StudentProfileForm } from '../components/StudentProfileForm';
import { getStudentById } from '../lib/data';
import { useLms } from '../lib/LmsContext';

export function ProfilePage() {
  const { session, students, updateStudent } = useLms();
  const [saved, setSaved] = useState(false);
  const student = session ? getStudentById(students, session.userId) : undefined;

  if (session?.role !== 'student') return <Navigate to="/instructor" replace />;
  if (!student) return <Navigate to="/login" replace />;

  return (
    <div className="page narrow profile-page">
      <header className="page-header">
        <span className="eyebrow">Student profile</span>
        <h1>Your information</h1>
        <p className="muted">Review and update the personal information associated with your student record.</p>
      </header>
      <StudentProfileForm
        initialValue={{
          name: student.name,
          preferredName: student.preferredName,
          email: student.email,
          dateOfBirth: student.dateOfBirth,
          phone: student.phone,
          mailingAddress: { ...student.mailingAddress },
          demographics: { ...student.demographics, races: [...student.demographics.races] },
        }}
        submitLabel="Save profile"
        emailExists={(email) => students.some(
          (candidate) => candidate.id !== student.id && candidate.email.toLowerCase() === email.toLowerCase(),
        )}
        onSubmit={(profile) => {
          updateStudent(student.id, profile);
          setSaved(true);
        }}
      />
      {saved && <p className="save-confirmation" role="status">Your profile has been updated.</p>}
    </div>
  );
}
