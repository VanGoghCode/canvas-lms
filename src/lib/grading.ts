import type { Assignment, Submission } from '../types';
import { ACADEMIC_DATE, findSubmission, time } from './data';

export const AT_RISK_GRADE_THRESHOLD = 70;

export type CourseGrade = ReturnType<typeof summarizeGrade>;

export function percentageToLetterGrade(percentage: number) {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

/** Points-based grade: missing work counts as zero, ungraded submissions are left out. */
export function summarizeGrade(
  studentId: string,
  assignments: Assignment[],
  submissions: Submission[],
  asOf = ACADEMIC_DATE,
) {
  let earned = 0;
  let possiblePoints = 0;
  let missingAssignments = 0;
  let pendingAssignments = 0;

  for (const assignment of assignments) {
    const submission = findSubmission(
      submissions.filter((s) => time(s.submittedAt) <= asOf.getTime()),
      assignment.id,
      studentId,
    );
    if (!submission && time(assignment.dueDate) > asOf.getTime()) continue;
    if (submission && submission.score == null) {
      pendingAssignments += 1;
      continue;
    }
    if (!submission) missingAssignments += 1;
    possiblePoints += assignment.pointsPossible;
    earned += Math.max(0, Math.min(submission?.score ?? 0, assignment.pointsPossible));
  }

  const rawPercentage = possiblePoints ? (earned / possiblePoints) * 100 : null;
  const percentage = rawPercentage == null ? null : Math.round(rawPercentage * 10) / 10;
  return {
    percentage,
    rawPercentage,
    letterGrade: possiblePoints ? percentageToLetterGrade((earned / possiblePoints) * 100) : null,
    possiblePoints,
    missingAssignments,
    pendingAssignments,
    totalAssignments: assignments.length,
  };
}

/** Grade so far: counts assignments that are already due, or already submitted. */
export function calculateCurrentCourseGrade(
  studentId: string,
  courseId: string,
  assignments: Assignment[],
  submissions: Submission[],
  asOf = ACADEMIC_DATE,
) {
  const counted = assignments.filter(
    (a) =>
      a.courseId === courseId &&
      (time(a.dueDate) <= asOf.getTime() || findSubmission(submissions, a.id, studentId)),
  );
  return summarizeGrade(studentId, counted, submissions, asOf);
}

/** Students whose current grade is below the threshold, with a reason and a next step. */
export function identifyStudentsAtRisk(
  studentIds: string[],
  courseId: string,
  assignments: Assignment[],
  submissions: Submission[],
) {
  return studentIds.flatMap((studentId) => {
    const grade = calculateCurrentCourseGrade(studentId, courseId, assignments, submissions);
    if (grade.rawPercentage == null || grade.rawPercentage >= AT_RISK_GRADE_THRESHOLD) return [];

    const missing = grade.missingAssignments;
    const missingText = missing
      ? ` and ${missing} missing submission${missing === 1 ? '' : 's'}`
      : '';
    return [
      {
        studentId,
        courseId,
        grade,
        explanation:
          `Current grade is ${grade.percentage}% (${grade.letterGrade}), below the ` +
          `${AT_RISK_GRADE_THRESHOLD}% intervention threshold${missingText}.`,
        suggestedAction: missing
          ? 'Contact the student to make a completion plan for missing work and offer office hours.'
          : 'Schedule a check-in and connect the student with tutoring or office hours.',
      },
    ];
  });
}
