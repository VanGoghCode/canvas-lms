import type { Assignment, Submission } from '../types';
import seedStudents from '../data/students.json';
import { ACADEMIC_DATE, time } from './data';
import { calculateCurrentCourseGrade } from './grading';

export function supportAssessment(
  studentId: string,
  courseId: string,
  assignments: Assignment[],
  submissions: Submission[],
) {
  const grade = calculateCurrentCourseGrade(studentId, courseId, assignments, submissions);
  const profile = seedStudents.find((student) => student.id === studentId);
  const due = assignments.filter(
    (a) => a.courseId === courseId && time(profile ? a.dueDate.slice(0, 10) : a.dueDate) <= ACADEMIC_DATE.getTime(),
  );
  const completed = due.filter((a) =>
    submissions.some((s) => s.studentId === studentId && s.assignmentId === a.id),
  ).length;
  if (profile) {
    const work = assignments.filter((a) => a.courseId === courseId).flatMap((assignment) => {
      const comparableIds = assignments.filter((a) => a.title === assignment.title).map((a) => a.id);
      const response = submissions.find((s) => s.studentId === studentId && comparableIds.includes(s.assignmentId));
      if (!response || response.score === 0) return [];
      const attempt = profile.attempts?.find((item) => item.assignmentId === assignment.id);
      return [(attempt?.score ?? response.score ?? 0) / assignment.pointsPossible * 100];
    });
    const average = work.length ? work.reduce((sum, value) => sum + value, 0) / work.length : null;
    const previousFlags = profile.history.filter((record) => record.supportFlag).length;
    return {
      needsSupport: (average != null && Math.round(average) <= 70 + previousFlags * 2) || (due.length > 0 && completed / due.length < 0.5),
      completed,
    };
  }
  return {
    needsSupport:
      (grade.rawPercentage != null && grade.rawPercentage < 70) ||
      (due.length > 0 && completed / due.length < 0.8),
    completed,
  };
}
