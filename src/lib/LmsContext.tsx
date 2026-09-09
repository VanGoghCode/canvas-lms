import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import studentsData from '../data/students.json';
import coursesData from '../data/courses.json';
import enrollmentsData from '../data/enrollments.json';
import assignmentsData from '../data/assignments.json';
import submissionsData from '../data/submissions.json';
import type {
  Assignment,
  Course,
  Enrollment,
  Role,
  Session,
  Student,
  StudentProfile,
  Submission,
} from '../types';

interface SeedStudent {
  id: string;
  name: string;
  email: string;
}

function normalizeSeedStudent(student: SeedStudent): Student {
  return {
    id: student.id,
    name: student.name,
    preferredName: '',
    email: student.email,
    dateOfBirth: '',
    phone: '',
    mailingAddress: {
      addressLine1: '',
      addressLine2: '',
      city: '',
      stateProvince: '',
      postalCode: '',
      country: '',
    },
    demographics: {
      genderIdentity: '',
      genderIdentityDetails: '',
      ethnicity: '',
      races: [],
    },
  };
}

interface LmsContextValue {
  students: Student[];
  courses: Course[];
  enrollments: Enrollment[];
  assignments: Assignment[];
  submissions: Submission[];
  session: Session | null;
  login: (userId: string, role: Role) => void;
  logout: () => void;
  registerStudent: (profile: StudentProfile) => Student;
  updateStudent: (studentId: string, profile: StudentProfile) => void;
  submitAssignment: (assignmentId: string, studentId: string, content: string) => void;
  gradeSubmission: (submissionId: string, score: number, comment: string) => void;
}

const LmsContext = createContext<LmsContextValue | undefined>(undefined);

export function LmsProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [students, setStudents] = useState<Student[]>(() =>
    (studentsData as SeedStudent[]).map(normalizeSeedStudent),
  );
  const [submissions, setSubmissions] = useState<Submission[]>(() =>
    (submissionsData as Omit<Submission, 'comment'>[]).map((submission) => ({
      ...submission,
      comment: '',
    })),
  );

  const value = useMemo<LmsContextValue>(() => ({
    students,
    courses: coursesData as Course[],
    enrollments: enrollmentsData as Enrollment[],
    assignments: assignmentsData as Assignment[],
    submissions,
    session,
    login: (userId, role) => setSession({ userId, role }),
    logout: () => setSession(null),
    registerStudent: (profile) => {
      const student = { ...profile, id: `student-${Date.now()}` };
      setStudents((current) => [...current, student]);
      setSession({ userId: student.id, role: 'student' });
      return student;
    },
    updateStudent: (studentId, profile) => {
      setStudents((current) => current.map((student) =>
        student.id === studentId ? { ...profile, id: studentId } : student,
      ));
    },
    submitAssignment: (assignmentId, studentId, content) => {
      setSubmissions((current) => {
        const existing = current.find(
          (item) => item.assignmentId === assignmentId && item.studentId === studentId,
        );
        if (existing) {
          return current.map((item) =>
            item.id === existing.id
              ? { ...item, content, submittedAt: new Date().toISOString(), score: null, comment: '' }
              : item,
          );
        }
        return [
          ...current,
          {
            id: `session-${Date.now()}`,
            assignmentId,
            studentId,
            content,
            submittedAt: new Date().toISOString(),
            score: null,
            comment: '',
          },
        ];
      });
    },
    gradeSubmission: (submissionId, score, comment) => {
      setSubmissions((current) => current.map((submission) =>
        submission.id === submissionId
          ? { ...submission, score, comment: comment.trim() }
          : submission,
      ));
    },
  }), [session, students, submissions]);

  return <LmsContext.Provider value={value}>{children}</LmsContext.Provider>;
}

export function useLms() {
  const context = useContext(LmsContext);
  if (!context) throw new Error('useLms must be used inside LmsProvider');
  return context;
}
