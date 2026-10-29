import { useEffect, useState } from 'react';
import type { Assignment, Course, Enrollment, Submission } from '../types';
import { ACADEMIC_DATE } from './data';
import { calculateCurrentCourseGrade } from './grading';

type Recommendation = {
  id: string;
  courseCode: string;
  estimatedMinutes: number;
  title: string;
  description: string;
  difficulty: string;
  reason: string;
};
type StudyPlan = {
  recommendations: Recommendation[];
  pacing: { status: string; title: string; message: string };
};

/** Send only the current student's coursework needed to calculate a study plan. */
export function useStudyPlan(
  studentId: string,
  courses: Course[],
  enrollments: Enrollment[],
  assignments: Assignment[],
  submissions: Submission[],
) {
  const ownEnrollments = enrollments.filter((e) => e.studentId === studentId);
  const grades = Object.fromEntries(courses.map((course) => [
    course.id,
    calculateCurrentCourseGrade(studentId, course.id, assignments, submissions),
  ]));
  // Content and feedback stay in browser storage; the service only needs scores and dates.
  const ownSubmissions = submissions.filter((s) => s.studentId === studentId).map((s) => ({
    studentId: s.studentId, assignmentId: s.assignmentId, submittedAt: s.submittedAt, score: s.score,
  }));
  const request = JSON.stringify({ studentId, courses, enrollments: ownEnrollments, assignments,
    submissions: ownSubmissions, grades, asOf: ACADEMIC_DATE.toISOString() });
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setPlan(null);
    setError(false);
    fetch('/api/study-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: request,
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Study plan unavailable');
        return response.json() as Promise<StudyPlan>;
      })
      .then((result) => { if (!controller.signal.aborted) setPlan(result); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [request]);

  return { plan, error };
}
