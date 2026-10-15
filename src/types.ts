// Data models. Seed records live in src/data/*.json.

export type Role = 'student' | 'instructor';

// Shared profile shape for workspace accounts; course instructorIds determine teaching roles.
export interface Student {
  id: string;
  name: string;
  preferredName: string;
  email: string;
  dateOfBirth: string;
  phone: string;
  // Mailing address
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  // Demographics
  genderIdentity: string;
  genderIdentityDetails: string;
  ethnicity: string;
  races: string[];
}

export type StudentProfile = Omit<Student, 'id'>;

export interface Course {
  id: string;
  code: string;
  title: string;
  instructorId: string;
  description: string;
  syllabus: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueDate: string;
  pointsPossible: number;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  content: string;
  submittedAt: string;
  score: number | null; // null = submitted, not graded yet
  comment: string;
}

export interface Session {
  userId: string;
  role: Role;
}
