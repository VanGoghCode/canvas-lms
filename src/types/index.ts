export type Role = 'student' | 'instructor';

export type GenderIdentity =
  | 'woman'
  | 'man'
  | 'nonbinary'
  | 'self-described'
  | 'prefer-not-to-answer';

export type Ethnicity =
  | 'hispanic-or-latino'
  | 'not-hispanic-or-latino'
  | 'prefer-not-to-answer';

export type Race =
  | 'american-indian-or-alaska-native'
  | 'asian'
  | 'black-or-african-american'
  | 'native-hawaiian-or-pacific-islander'
  | 'white'
  | 'prefer-not-to-answer';

export interface MailingAddress {
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
}

export interface StudentDemographics {
  genderIdentity: GenderIdentity | '';
  genderIdentityDetails: string;
  ethnicity: Ethnicity | '';
  races: Race[];
}

export interface Student {
  id: string;
  name: string;
  preferredName: string;
  email: string;
  dateOfBirth: string;
  phone: string;
  mailingAddress: MailingAddress;
  demographics: StudentDemographics;
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
  score: number | null;
  comment: string;
}

export interface Session {
  userId: string;
  role: Role;
}
