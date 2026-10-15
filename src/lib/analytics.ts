import type { Assignment, Enrollment, Submission } from '../types';
import { ACADEMIC_DATE, courseAssignments, courseStudentIds, time } from './data';
import { summarizeGrade } from './grading';

export interface AnalyticsFilters {
  assignmentId: string; // '' = all assignments
  dateFrom: string; // '' = no lower bound
  dateTo: string; // '' = no upper bound
}

export type CourseAnalytics = ReturnType<typeof buildCourseAnalytics>;

// Engagement cohorts by completion: high ≥ 80%, moderate ≥ 50%, low below that.
const COHORTS = ['High engagement', 'Moderate engagement', 'Low engagement'];

const round = (value: number) => Math.round(value * 10) / 10;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const average = (values: number[]) => (values.length ? round(sum(values) / values.length) : null);
const percent = (part: number, whole: number) => (whole ? round((part / whole) * 100) : 0);

/** Every number on the analytics page, built from one filtered set of submissions. */
export function buildCourseAnalytics(
  courseId: string,
  filters: AnalyticsFilters,
  assignments: Assignment[],
  submissions: Submission[],
  enrollments: Enrollment[],
) {
  const from = filters.dateFrom ? time(`${filters.dateFrom}T00:00:00`) : -Infinity;
  const to = filters.dateTo ? time(`${filters.dateTo}T23:59:59.999`) : Infinity;
  const inRange = (date: string) => time(date) >= from && time(date) <= to;

  const scopedAssignments = courseAssignments(assignments, courseId).filter(
    (a) => (!filters.assignmentId || a.id === filters.assignmentId) && inRange(a.dueDate),
  );
  const assignmentById = new Map(scopedAssignments.map((a) => [a.id, a]));
  const studentIds = [...new Set(courseStudentIds(enrollments, courseId))];
  const scoped = submissions.filter(
    (s) =>
      assignmentById.has(s.assignmentId) &&
      studentIds.includes(s.studentId) &&
      time(s.submittedAt) <= ACADEMIC_DATE.getTime(),
  );
  const dueAssignments = scopedAssignments.filter(
    (a) => time(a.dueDate) <= ACADEMIC_DATE.getTime(),
  );
  const dueIds = new Set(dueAssignments.map((a) => a.id));

  const isLate = (s: Submission) =>
    time(s.submittedAt) > time(assignmentById.get(s.assignmentId)!.dueDate);
  // Graded submissions as 0–100 percentages.
  const scores = (items: Submission[]) =>
    items.flatMap((s) => {
      const points = assignmentById.get(s.assignmentId)!.pointsPossible;
      return s.score == null || !points
        ? []
        : [Math.max(0, Math.min(100, (s.score / points) * 100))];
    });

  const students = studentIds.map((studentId) => {
    const items = scoped.filter((s) => s.studentId === studentId);
    const completed = new Set(
      items.filter((s) => dueIds.has(s.assignmentId)).map((s) => s.assignmentId),
    ).size;
    const completion = dueAssignments.length ? (completed / dueAssignments.length) * 100 : 0;
    const grade = summarizeGrade(studentId, scopedAssignments, items);
    return {
      completed,
      scores: scores(items),
      grade: grade.rawPercentage,
      letterGrade: grade.letterGrade,
      cohort: dueAssignments.length ? COHORTS[completion >= 80 ? 0 : completion >= 50 ? 1 : 2] : '',
    };
  });
  const grades = students.flatMap((s) => (s.grade == null ? [] : [s.grade]));
  const days = [
    ...new Set(scoped.map((s) => new Date(time(s.submittedAt)).toISOString().slice(0, 10))),
  ].sort();

  return {
    overallAverage: average(grades),
    overallCompletion:
      dueAssignments.length && studentIds.length
        ? percent(
            scoped.filter((s) => dueIds.has(s.assignmentId)).length,
            studentIds.length * dueAssignments.length,
          )
        : null,
    totalSubmissions: scoped.length,
    gradedSubmissions: scores(scoped).length,
    onTimeAverage: average(scores(scoped.filter((s) => !isLate(s)))),
    lateAverage: average(scores(scoped.filter(isLate))),

    gradeDistribution: ['A', 'B', 'C', 'D', 'F'].map((grade) => ({
      grade,
      students: students.filter((s) => s.letterGrade === grade).length,
    })),

    assignmentMetrics: scopedAssignments.map((assignment) => {
      const items = scoped.filter((s) => s.assignmentId === assignment.id);
      return {
        assignmentId: assignment.id,
        assignment: assignment.title,
        completionRate: percent(new Set(items.map((s) => s.studentId)).size, studentIds.length),
        averageScore: average(scores(items)),
      };
    }),

    engagementTimeline: days.map((date) => {
      const items = scoped.filter((s) =>
        new Date(time(s.submittedAt)).toISOString().startsWith(date),
      );
      return {
        date,
        submissions: items.length,
        activeStudents: new Set(items.map((s) => s.studentId)).size,
      };
    }),

    cohorts: COHORTS.flatMap((cohort) => {
      const members = students.filter((s) => s.cohort === cohort);
      if (!members.length) return [];
      return [
        {
          cohort,
          students: members.length,
          completionRate: percent(
            sum(members.map((m) => m.completed)),
            members.length * dueAssignments.length,
          ),
          averageScore: average(members.flatMap((m) => m.scores)),
        },
      ];
    }),
  };
}
