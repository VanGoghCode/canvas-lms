import { useEffect, useState } from 'react';
import type { Assignment, Enrollment, Submission } from '../types';
import seedStudents from '../data/students.json';
import { ACADEMIC_DATE } from './data';

export interface AnalyticsFilters {
  assignmentId: string;
  dateFrom: string;
  dateTo: string;
}
export interface CourseAnalytics {
  overallAverage: number | null;
  overallCompletion: number | null;
  totalSubmissions: number;
  gradedSubmissions: number;
  onTimeAverage: number | null;
  lateAverage: number | null;
  gradeDistribution: { grade: string; students: number }[];
  assignmentMetrics: { assignmentId: string; assignment: string; completionRate: number; averageScore: number | null }[];
  engagementTimeline: { date: string; submissions: number; activeStudents: number }[];
  cohorts: { cohort: string; students: number; completionRate: number; averageScore: number | null }[];
  demographicGroups: { category: string; group: string; supportRate: number }[];
  history: { courses: number; flagged: number; passing: number; below70: number; flaggedPassing: number; unflaggedBelow70: number };
  outcomes: { students: number; completed: number; employed: number; groups: { group: string; flaggedCompleted: number | null; unflaggedNotCompleted: number | null }[]; records: { id: string; name: string; race: string; flagged: boolean; completion: string; followUp: string; followUpDate: string }[] };
}

/** Request only the courses shown by the instructor workspace, without response text or feedback. */
export function useCourseAnalytics(
  selections: { courseId: string; filters: AnalyticsFilters }[],
  assignments: Assignment[],
  submissions: Submission[],
  enrollments: Enrollment[],
) {
  const requests = selections.map(({ courseId, filters }) => {
    const courseAssignments = assignments.filter((a) => a.courseId === courseId);
    const ids = new Set(courseAssignments.map((a) => a.id));
    const courseEnrollments = enrollments.filter((e) => e.courseId === courseId);
    const students = new Set(courseEnrollments.map((e) => e.studentId));
    const attempts = seedStudents.filter((s) => students.has(s.id)).flatMap((student) =>
      (student.attempts ?? []).filter((attempt) => ids.has(attempt.assignmentId) &&
        submissions.some((s) => s.studentId === student.id && s.assignmentId === attempt.assignmentId))
        .map((attempt) => ({ ...attempt, studentId: student.id })),
    );
    return {
      courseId, filters, assignments: courseAssignments, enrollments: courseEnrollments,
      demographics: seedStudents.filter((s) => students.has(s.id)).map((s) => ({
        id: s.id, genderIdentity: s.genderIdentity, ethnicity: s.ethnicity, race: s.races[0] ?? '',
        history: s.history,
      })),
      alumni: seedStudents.filter((s) => s.alumni && s.courseIds?.includes(courseId) && s.outcome && Date.parse(s.outcome.followUpDate) <= Date.now()).map((s) => ({
        id: s.id, name: s.name, race: s.races[0] ?? '', history: s.history, outcome: s.outcome,
      })),
      submissions: [...attempts, ...submissions.filter((s) => ids.has(s.assignmentId) && students.has(s.studentId))
        .map((s) => ({ studentId: s.studentId, assignmentId: s.assignmentId, submittedAt: s.submittedAt, score: s.score }))],
      asOf: ACADEMIC_DATE.toISOString(),
    };
  });
  const request = JSON.stringify(requests);
  const [state, setState] = useState<{ request: string; data: CourseAnalytics[] | null; error: boolean }>({
    request: '', data: null, error: false,
  });

  useEffect(() => {
    if (request === '[]') return;
    const controller = new AbortController();
    fetch('/api/analytics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: request, signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Analytics unavailable');
        return response.json() as Promise<CourseAnalytics[]>;
      })
      .then((data) => { if (!controller.signal.aborted) setState({ request, data, error: false }); })
      .catch(() => { if (!controller.signal.aborted) setState({ request, data: null, error: true }); });
    return () => controller.abort();
  }, [request]);

  if (request === '[]') return { data: [] as CourseAnalytics[], error: false };
  return state.request === request ? state : { data: null, error: false };
}
