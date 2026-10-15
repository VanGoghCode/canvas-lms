import { useState } from 'react';
import { StudentProfileForm } from '../components/StudentProfileForm';
import { byId } from '../lib/data';
import { useLms } from '../lib/LmsContext';

export function ProfilePage() {
  const { session, students, updateStudent } = useLms();
  const [saved, setSaved] = useState(false);
  const student = byId(students, session?.userId);
  if (!student) return null;

  return (
    <div className="page narrow">
      <header>
        <span className="eyebrow">Student profile</span>
        <h1>Your information</h1>
      </header>
      <StudentProfileForm
        initialValue={student}
        submitLabel="Save profile"
        emailExists={(email) =>
          students.some((s) => s.id !== student.id && s.email.toLowerCase() === email.toLowerCase())
        }
        onChange={() => setSaved(false)}
        onSubmit={(profile) => {
          const error = updateStudent(student.id, profile);
          setSaved(!error);
          return error;
        }}
      />
      {saved && (
        <p className="toast" role="status">
          Your profile has been updated.
        </p>
      )}
    </div>
  );
}
