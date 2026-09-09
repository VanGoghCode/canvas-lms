import type { Assignment, Submission } from '../types';

export const AT_RISK_GRADE_THRESHOLD = 70;

export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface CourseGrade {
  earnedPoints: number;
  possiblePoints: number;
  percentage: number | null;
  letterGrade: LetterGrade | null;
  gradedAssignments: number;
  missingAssignments: number;
  pendingAssignments: number;
  totalAssignments: number;
}

export interface AtRiskStudent {
  studentId: string;
  courseId: string;
  grade: CourseGrade;
  explanation: string;
  suggestedAction: string;
}

export function percentageToLetterGrade(percentage: number): LetterGrade {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

/**
 * Calculates a points-based course grade. Assignments without a submission count
 * as zero; submitted work awaiting a grade is excluded until an instructor scores it.
 */
export function calculateFinalCourseGrade(
  studentId: string,
  courseId: string,
  assignments: Assignment[],
  submissions: Submission[],
): CourseGrade {
  const courseAssignments = assignments.filter((assignment) => assignment.courseId === courseId);
  return summarizeGrade(studentId, courseAssignments, submissions);
}

/**
 * Calculates the student's grade as of a point in time. Future assignments are
 * excluded unless already submitted; overdue missing work counts as zero.
 */
export function calculateCurrentCourseGrade(
  studentId: string,
  courseId: string,
  assignments: Assignment[],
  submissions: Submission[],
  asOf = new Date(),
): CourseGrade {
  const currentAssignments = assignments.filter((assignment) => {
    if (assignment.courseId !== courseId) return false;
    const hasSubmission = submissions.some(
      (submission) => submission.assignmentId === assignment.id && submission.studentId === studentId,
    );
    return hasSubmission || new Date(assignment.dueDate).getTime() <= asOf.getTime();
  });
  return summarizeGrade(studentId, currentAssignments, submissions);
}

function summarizeGrade(
  studentId: string,
  courseAssignments: Assignment[],
  submissions: Submission[],
): CourseGrade {
  let earnedPoints = 0;
  let possiblePoints = 0;
  let gradedAssignments = 0;
  let missingAssignments = 0;
  let pendingAssignments = 0;

  courseAssignments.forEach((assignment) => {
    const submission = submissions.find(
      (item) => item.assignmentId === assignment.id && item.studentId === studentId,
    );

    if (!submission) {
      missingAssignments += 1;
      possiblePoints += assignment.pointsPossible;
      return;
    }

    if (submission.score == null) {
      pendingAssignments += 1;
      return;
    }

    gradedAssignments += 1;
    possiblePoints += assignment.pointsPossible;
    earnedPoints += Math.max(0, Math.min(submission.score, assignment.pointsPossible));
  });

  const percentage = possiblePoints === 0
    ? null
    : Math.round((earnedPoints / possiblePoints) * 1000) / 10;

  return {
    earnedPoints: Math.round(earnedPoints * 10) / 10,
    possiblePoints,
    percentage,
    letterGrade: percentage == null ? null : percentageToLetterGrade(percentage),
    gradedAssignments,
    missingAssignments,
    pendingAssignments,
    totalAssignments: courseAssignments.length,
  };
}

export function identifyStudentsAtRisk(
  studentIds: string[],
  courseId: string,
  assignments: Assignment[],
  submissions: Submission[],
): AtRiskStudent[] {
  return studentIds.flatMap((studentId) => {
    const grade = calculateCurrentCourseGrade(studentId, courseId, assignments, submissions);
    if (grade.percentage == null || grade.percentage >= AT_RISK_GRADE_THRESHOLD) return [];

    const missingDetail = grade.missingAssignments > 0
      ? ` and ${grade.missingAssignments} missing ${grade.missingAssignments === 1 ? 'submission' : 'submissions'}`
      : '';
    const explanation = `Current grade is ${grade.percentage}% (${grade.letterGrade}), below the ${AT_RISK_GRADE_THRESHOLD}% intervention threshold${missingDetail}.`;
    const suggestedAction = grade.missingAssignments > 0
      ? 'Contact the student to make a completion plan for missing work and offer office hours.'
      : 'Schedule a check-in and connect the student with tutoring or office hours.';

    return [{ studentId, courseId, grade, explanation, suggestedAction }];
  });
}
