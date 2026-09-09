import type { Assignment, Course, Enrollment, Student, Submission } from '../types';

export function getStudentById(students: Student[], id: string) {
  return students.find((student) => student.id === id);
}

export function getCourseById(courses: Course[], id: string) {
  return courses.find((course) => course.id === id);
}

export function getAssignmentById(assignments: Assignment[], id: string) {
  return assignments.find((assignment) => assignment.id === id);
}

export function getCourseEnrollments(enrollments: Enrollment[], courseId: string) {
  return enrollments.filter((enrollment) => enrollment.courseId === courseId);
}

export function getStudentCourses(
  studentId: string,
  courses: Course[],
  enrollments: Enrollment[],
) {
  const courseIds = new Set(
    enrollments
      .filter((enrollment) => enrollment.studentId === studentId)
      .map((enrollment) => enrollment.courseId),
  );
  return courses.filter((course) => courseIds.has(course.id));
}

export function getCourseAssignments(assignments: Assignment[], courseId: string) {
  return assignments
    .filter((assignment) => assignment.courseId === courseId)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}

export function getSubmission(
  submissions: Submission[],
  assignmentId: string,
  studentId: string,
) {
  return submissions.find(
    (submission) => submission.assignmentId === assignmentId && submission.studentId === studentId,
  );
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value));
}
