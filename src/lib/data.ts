// Small lookups shared by pages and business rules.
import type {
  Assignment,
  Course,
  Enrollment,
  Role,
  Student,
  StudentProfile,
  Submission,
} from '../types';

// A reproducible mid-term snapshot, independent of the computer's clock.
export const ACADEMIC_DATE = new Date('2026-08-15T12:00:00Z');
export const TERM_CLOSE = new Date('2026-09-05T23:59:00Z');

export function canAccessCourse(
  userId: string,
  role: Role,
  course: Course,
  enrollments: Enrollment[],
) {
  return role === 'instructor'
    ? course.instructorId === userId
    : enrollments.some((e) => e.studentId === userId && e.courseId === course.id);
}

export function assignmentStatus(assignment: Assignment, submission?: Submission) {
  if (submission?.score != null) return 'Graded';
  if (submission)
    return time(submission.submittedAt) > time(assignment.dueDate)
      ? 'Late · awaiting grade'
      : 'Awaiting grade';
  return time(assignment.dueDate) <= ACADEMIC_DATE.getTime() ? 'Missing' : 'Not submitted';
}

export const emptyStudentProfile: StudentProfile = {
  name: '',
  preferredName: '',
  email: '',
  dateOfBirth: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateProvince: '',
  postalCode: '',
  country: '',
  genderIdentity: '',
  genderIdentityDetails: '',
  ethnicity: '',
  races: [],
};

export function byId<T extends { id: string }>(items: T[], id: string | undefined) {
  return items.find((item) => item.id === id);
}

/** Seed users assigned to teach a course belong in the instructor login list. */
export function usersForRole(users: Student[], courses: Course[], role: Role) {
  const instructorIds = new Set(courses.map((course) => course.instructorId));
  return users.filter((user) => instructorIds.has(user.id) === (role === 'instructor'));
}

export function studentCourses(studentId: string, courses: Course[], enrollments: Enrollment[]) {
  return courses.filter((course) =>
    enrollments.some((e) => e.studentId === studentId && e.courseId === course.id),
  );
}

export function courseStudentIds(enrollments: Enrollment[], courseId: string) {
  return enrollments.filter((e) => e.courseId === courseId).map((e) => e.studentId);
}

/** A course's assignments, earliest due date first. */
export function courseAssignments(assignments: Assignment[], courseId: string) {
  return assignments
    .filter((a) => a.courseId === courseId)
    .sort((a, b) => time(a.dueDate) - time(b.dueDate));
}

export function findSubmission(submissions: Submission[], assignmentId: string, studentId: string) {
  return submissions.find((s) => s.assignmentId === assignmentId && s.studentId === studentId);
}

export function time(date: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `${date}T00:00:00Z`
    : /(Z|[+-]\d{2}:\d{2})$/.test(date)
      ? date
      : `${date}Z`;
  return new Date(normalized).getTime();
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(time(value)));
}

export function statusTone(status: string) {
  return status === 'Graded'
    ? 'positive'
    : status.includes('Late') || status === 'Missing'
      ? 'warning'
      : 'neutral';
}
