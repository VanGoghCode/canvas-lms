import { useLms } from './LmsContext';
import { canAccessCourse, ACADEMIC_DATE, findSubmission, time } from './data';
import { draftKey } from './store';
import type { Assignment, Submission } from '../types';

export type WorkStage = 'missing' | 'upcoming' | 'pending' | 'graded';
export function workStage(assignment: Assignment, submission?: Submission): WorkStage {
  if (submission?.score != null) return 'graded';
  if (submission) return 'pending';
  return time(assignment.dueDate) <= ACADEMIC_DATE.getTime() ? 'missing' : 'upcoming';
}
export const stageLabel: Record<WorkStage, string> = {
  missing: 'Missing',
  upcoming: 'Upcoming',
  pending: 'Awaiting grade',
  graded: 'Graded',
};
export const stageTone: Record<WorkStage, string> = {
  missing: 'warning',
  upcoming: 'neutral',
  pending: 'blue',
  graded: 'positive',
};

/** One access-scoped view used by dashboards, planner, gradebook, and schedule. */
export function useWorkspace() {
  const lms = useLms();
  const session = lms.session!;
  const courses = lms.courses.filter((c) =>
    canAccessCourse(session.userId, session.role, c, lms.enrollments),
  );
  const assignments = lms.assignments
    .filter((a) => courses.some((c) => c.id === a.courseId))
    .sort((a, b) => time(a.dueDate) - time(b.dueDate));
  const submissions = lms.submissions.filter(
    (s) =>
      assignments.some(
        (a) =>
          a.id === s.assignmentId &&
          lms.enrollments.some((e) => e.courseId === a.courseId && e.studentId === s.studentId),
      ) &&
      (session.role === 'instructor' || s.studentId === session.userId),
  );
  const work = assignments.map((assignment) => {
    const submission = findSubmission(submissions, assignment.id, session.userId);
    return {
      assignment,
      course: courses.find((c) => c.id === assignment.courseId)!,
      submission,
      stage: workStage(assignment, submission),
      hasDraft: Boolean(lms.drafts[draftKey(session.userId, assignment.id)]?.trim()),
    };
  });
  const grading = assignments.map((assignment) => {
    const received = submissions.filter((s) => s.assignmentId === assignment.id);
    const enrolled = lms.enrollments.filter((e) => e.courseId === assignment.courseId).length;
    const pending = received.filter((s) => s.score == null).length;
    return {
      assignment,
      course: courses.find((c) => c.id === assignment.courseId)!,
      received: received.length,
      graded: received.length - pending,
      pending,
      enrolled,
      missing: time(assignment.dueDate) <= ACADEMIC_DATE.getTime() ? enrolled - received.length : 0,
    };
  });
  return { ...lms, courses, assignments, submissions, work, grading };
}
