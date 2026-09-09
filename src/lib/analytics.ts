import type { Assignment, Enrollment, Submission } from '../types';

export type EngagementCohort = 'High engagement' | 'Moderate engagement' | 'Low engagement';

export interface AnalyticsFilters {
  assignmentId: string;
  dateFrom: string;
  dateTo: string;
}

export interface GradeDistributionPoint {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  students: number;
}

export interface AssignmentMetric {
  assignmentId: string;
  assignment: string;
  dueDate: string;
  completionRate: number;
  averageScore: number | null;
  submissions: number;
}

export interface EngagementPoint {
  date: string;
  submissions: number;
  activeStudents: number;
}

export interface CohortMetric {
  cohort: EngagementCohort;
  students: number;
  completionRate: number;
  averageScore: number | null;
}

export interface CourseAnalytics {
  gradeDistribution: GradeDistributionPoint[];
  assignmentMetrics: AssignmentMetric[];
  engagementTimeline: EngagementPoint[];
  cohorts: CohortMetric[];
  overallAverage: number | null;
  overallCompletion: number;
  gradedSubmissions: number;
  totalSubmissions: number;
  onTimeAverage: number | null;
  lateAverage: number | null;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizedScore(submission: Submission, assignment: Assignment) {
  if (submission.score == null || assignment.pointsPossible === 0) return null;
  return Math.max(0, Math.min(100, (submission.score / assignment.pointsPossible) * 100));
}

function average(values: number[]) {
  return values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function inDateRange(value: string, dateFrom: string, dateTo: string) {
  const timestamp = new Date(value).getTime();
  const start = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const end = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
  return timestamp >= start && timestamp <= end;
}

function cohortForCompletion(completionRate: number): EngagementCohort {
  if (completionRate >= 80) return 'High engagement';
  if (completionRate >= 50) return 'Moderate engagement';
  return 'Low engagement';
}

export function buildCourseAnalytics(
  courseId: string,
  filters: AnalyticsFilters,
  assignments: Assignment[],
  submissions: Submission[],
  enrollments: Enrollment[],
): CourseAnalytics {
  const courseAssignments = assignments
    .filter((assignment) => assignment.courseId === courseId)
    .filter((assignment) => !filters.assignmentId || assignment.id === filters.assignmentId)
    .filter((assignment) => inDateRange(assignment.dueDate, filters.dateFrom, filters.dateTo))
    .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime());
  const assignmentIds = new Set(courseAssignments.map((assignment) => assignment.id));
  const assignmentById = new Map(courseAssignments.map((assignment) => [assignment.id, assignment]));
  const studentIds = [...new Set(
    enrollments.filter((enrollment) => enrollment.courseId === courseId).map((enrollment) => enrollment.studentId),
  )];
  const studentIdSet = new Set(studentIds);
  const scopedSubmissions = submissions.filter((submission) =>
    assignmentIds.has(submission.assignmentId)
    && studentIdSet.has(submission.studentId)
    && inDateRange(submission.submittedAt, filters.dateFrom, filters.dateTo),
  );

  const assignmentMetrics = courseAssignments.map((assignment) => {
    const assignmentSubmissions = scopedSubmissions.filter((submission) => submission.assignmentId === assignment.id);
    const scoreValues = assignmentSubmissions.flatMap((submission) => {
      const score = normalizedScore(submission, assignment);
      return score == null ? [] : [score];
    });
    return {
      assignmentId: assignment.id,
      assignment: assignment.title,
      dueDate: assignment.dueDate,
      completionRate: studentIds.length === 0 ? 0 : round((new Set(assignmentSubmissions.map((submission) => submission.studentId)).size / studentIds.length) * 100),
      averageScore: average(scoreValues),
      submissions: assignmentSubmissions.length,
    };
  });

  const gradedScores = scopedSubmissions.flatMap((submission) => {
    const assignment = assignmentById.get(submission.assignmentId);
    const score = assignment ? normalizedScore(submission, assignment) : null;
    return score == null ? [] : [score];
  });
  const studentGrades = studentIds.flatMap((studentId) => {
    let earned = 0;
    let possible = 0;
    courseAssignments.forEach((assignment) => {
      const submission = scopedSubmissions.find(
        (item) => item.studentId === studentId && item.assignmentId === assignment.id,
      );
      if (!submission) {
        possible += assignment.pointsPossible;
        return;
      }
      if (submission.score == null) return;
      possible += assignment.pointsPossible;
      earned += Math.max(0, Math.min(submission.score, assignment.pointsPossible));
    });
    return possible === 0 ? [] : [(earned / possible) * 100];
  });
  const gradeDistribution: GradeDistributionPoint[] = [
    { grade: 'A', students: studentGrades.filter((score) => score >= 90).length },
    { grade: 'B', students: studentGrades.filter((score) => score >= 80 && score < 90).length },
    { grade: 'C', students: studentGrades.filter((score) => score >= 70 && score < 80).length },
    { grade: 'D', students: studentGrades.filter((score) => score >= 60 && score < 70).length },
    { grade: 'F', students: studentGrades.filter((score) => score < 60).length },
  ];

  const engagementByDay = new Map<string, { submissions: number; studentIds: Set<string> }>();
  scopedSubmissions.forEach((submission) => {
    const date = submission.submittedAt.slice(0, 10);
    const entry = engagementByDay.get(date) ?? { submissions: 0, studentIds: new Set<string>() };
    entry.submissions += 1;
    entry.studentIds.add(submission.studentId);
    engagementByDay.set(date, entry);
  });
  const engagementTimeline = [...engagementByDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({
      date,
      submissions: value.submissions,
      activeStudents: value.studentIds.size,
    }));

  const cohortMap = new Map<EngagementCohort, { students: number; completed: number; possible: number; scores: number[] }>();
  studentIds.forEach((studentId) => {
    const studentSubmissions = scopedSubmissions.filter((submission) => submission.studentId === studentId);
    const completedAssignments = new Set(studentSubmissions.map((submission) => submission.assignmentId)).size;
    const completionRate = courseAssignments.length === 0 ? 0 : (completedAssignments / courseAssignments.length) * 100;
    const cohort = cohortForCompletion(completionRate);
    const entry = cohortMap.get(cohort) ?? { students: 0, completed: 0, possible: 0, scores: [] };
    entry.students += 1;
    entry.completed += completedAssignments;
    entry.possible += courseAssignments.length;
    studentSubmissions.forEach((submission) => {
      const assignment = assignmentById.get(submission.assignmentId);
      const score = assignment ? normalizedScore(submission, assignment) : null;
      if (score != null) entry.scores.push(score);
    });
    cohortMap.set(cohort, entry);
  });
  const cohortOrder: EngagementCohort[] = ['High engagement', 'Moderate engagement', 'Low engagement'];
  const cohorts = cohortOrder.flatMap((cohort) => {
    const value = cohortMap.get(cohort);
    if (!value || value.students === 0) return [];
    return [{
      cohort,
      students: value.students,
      completionRate: value.possible === 0 ? 0 : round((value.completed / value.possible) * 100),
      averageScore: average(value.scores),
    }];
  });

  const onTimeScores: number[] = [];
  const lateScores: number[] = [];
  scopedSubmissions.forEach((submission) => {
    const assignment = assignmentById.get(submission.assignmentId);
    if (!assignment) return;
    const score = normalizedScore(submission, assignment);
    if (score == null) return;
    const destination = new Date(submission.submittedAt).getTime() <= new Date(assignment.dueDate).getTime()
      ? onTimeScores
      : lateScores;
    destination.push(score);
  });

  const totalPossibleCompletions = studentIds.length * courseAssignments.length;
  return {
    gradeDistribution,
    assignmentMetrics,
    engagementTimeline,
    cohorts,
    overallAverage: average(studentGrades),
    overallCompletion: totalPossibleCompletions === 0 ? 0 : round((scopedSubmissions.length / totalPossibleCompletions) * 100),
    gradedSubmissions: gradedScores.length,
    totalSubmissions: scopedSubmissions.length,
    onTimeAverage: average(onTimeScores),
    lateAverage: average(lateScores),
  };
}
