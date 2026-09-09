import resourcesData from '../data/resources.json';
import type { Assignment, Course, Enrollment, Submission } from '../types';
import { calculateCurrentCourseGrade } from './grading';

export type ResourceDifficulty = 'remedial' | 'core' | 'advanced' | 'enrichment';
export type PerformanceBand = 'struggling' | 'developing' | 'thriving';

export interface LearningResource {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  difficulty: ResourceDifficulty;
  topics: string[];
  courseIds: string[];
}

export interface StudentRecommendation extends LearningResource {
  courseCode: string;
  reason: string;
}

export interface PacingSuggestion {
  status: 'adjust' | 'maintain' | 'stretch';
  title: string;
  message: string;
}

interface CoursePerformance {
  course: Course;
  percentage: number | null;
  band: PerformanceBand;
  weakestTopic: string;
  hasMissingWork: boolean;
}

export const learningResources = resourcesData as LearningResource[];

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function getPerformanceBand(percentage: number | null): PerformanceBand {
  if (percentage == null || percentage < 70) return 'struggling';
  if (percentage >= 90) return 'thriving';
  return 'developing';
}

export function generateRecommendations(
  studentId: string,
  courses: Course[],
  enrollments: Enrollment[],
  assignments: Assignment[],
  submissions: Submission[],
  limit = 3,
  asOf = new Date(),
): StudentRecommendation[] {
  const courseIds = new Set(
    enrollments
      .filter((enrollment) => enrollment.studentId === studentId)
      .map((enrollment) => enrollment.courseId),
  );
  const performances = courses
    .filter((course) => courseIds.has(course.id))
    .map((course) => getCoursePerformance(studentId, course, assignments, submissions, asOf));

  if (limit <= 0) return [];
  if (performances.length === 0) {
    return learningResources
      .filter((resource) => resource.courseIds.includes('*'))
      .slice(0, limit)
      .map((resource) => ({
        ...resource,
        courseCode: 'All courses',
        reason: 'Build a useful learning routine while your course activity gets underway.',
      }));
  }

  return learningResources
    .flatMap((resource) => {
      const matchingPerformances = performances.filter(
        (performance) => (
          resource.courseIds.includes(performance.course.id) || resource.courseIds.includes('*')
        ) && isDifficultyMatch(resource.difficulty, performance.band),
      );
      if (matchingPerformances.length === 0) return [];

      const bestMatch = matchingPerformances
        .map((performance) => ({
          performance,
          score: scoreResource(resource, performance),
        }))
        .sort((a, b) => b.score - a.score || a.performance.course.id.localeCompare(b.performance.course.id))[0];

      return [{
        ...resource,
        score: bestMatch.score,
        recommendation: toRecommendation(resource, bestMatch.performance),
      }];
    })
    .sort((a, b) => b.score - a.score || a.recommendation.id.localeCompare(b.recommendation.id))
    .slice(0, limit)
    .map(({ recommendation }) => recommendation);
}

export function getPacingSuggestion(
  studentId: string,
  courses: Course[],
  enrollments: Enrollment[],
  assignments: Assignment[],
  submissions: Submission[],
  asOf = new Date(),
): PacingSuggestion {
  const courseIds = new Set(
    enrollments
      .filter((enrollment) => enrollment.studentId === studentId)
      .map((enrollment) => enrollment.courseId),
  );
  const relevantAssignments = assignments.filter((assignment) => courseIds.has(assignment.courseId));
  const relevantAssignmentIds = new Set(relevantAssignments.map((assignment) => assignment.id));
  const studentSubmissions = submissions
    .filter((submission) => submission.studentId === studentId && relevantAssignmentIds.has(submission.assignmentId))
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
  const submittedAssignmentIds = new Set(studentSubmissions.map((submission) => submission.assignmentId));
  const overdueCount = relevantAssignments.filter(
    (assignment) => new Date(assignment.dueDate).getTime() < asOf.getTime()
      && !submittedAssignmentIds.has(assignment.id),
  ).length;
  const lateCount = studentSubmissions.filter((submission) => {
    const assignment = relevantAssignments.find((item) => item.id === submission.assignmentId);
    return assignment != null
      && new Date(submission.submittedAt).getTime() > new Date(assignment.dueDate).getTime();
  }).length;
  const lateRate = studentSubmissions.length === 0 ? 0 : lateCount / studentSubmissions.length;
  const courseGrades = [...courseIds]
    .map((courseId) => calculateCurrentCourseGrade(studentId, courseId, assignments, submissions, asOf).percentage)
    .filter((percentage): percentage is number => percentage != null);
  const averageGrade = courseGrades.length === 0
    ? null
    : courseGrades.reduce((total, percentage) => total + percentage, 0) / courseGrades.length;
  const averageGapDays = getAverageSubmissionGap(studentSubmissions);

  if (studentSubmissions.length === 0) {
    return {
      status: 'adjust',
      title: 'Start with a steady weekly rhythm',
      message: 'No submission pattern is available yet. For the rest of the term, schedule two short work blocks per course each week and begin the next assignment at least three days before it is due.',
    };
  }

  if (overdueCount > 0 || lateRate >= 0.3 || (averageGrade != null && averageGrade < 70)) {
    const reason = overdueCount > 0
      ? `${overdueCount} overdue ${overdueCount === 1 ? 'assignment needs' : 'assignments need'} attention`
      : lateRate >= 0.3
        ? 'recent work is often arriving after the deadline'
        : 'current grades show that the existing pace is not leaving enough time for mastery';
    return {
      status: 'adjust',
      title: 'Lighten the weekly crunch',
      message: `Adjust your workload because ${reason}. For the rest of the term, move one study block earlier in the week and focus on one high-impact task at a time before adding extra work.`,
    };
  }

  if (averageGapDays != null && averageGapDays < 2 && studentSubmissions.length >= 3) {
    return {
      status: 'adjust',
      title: 'Spread work more evenly',
      message: 'Your submissions are clustered close together. For the rest of the term, distribute work across the week and leave a separate review block before each deadline.',
    };
  }

  if (averageGrade != null && averageGrade >= 90 && lateRate < 0.1) {
    return {
      status: 'stretch',
      title: 'Keep your pace and add one stretch block',
      message: 'Your strong grades and on-time pattern suggest your current workload is sustainable. Keep that rhythm for the rest of the term and reserve one optional weekly block for advanced material.',
    };
  }

  return {
    status: 'maintain',
    title: 'Maintain a consistent pace',
    message: 'Your submission history supports a steady workload. For the rest of the term, keep your current weekly cadence and use one short review session to target the weakest topic highlighted in your recommendations.',
  };
}

function getCoursePerformance(
  studentId: string,
  course: Course,
  assignments: Assignment[],
  submissions: Submission[],
  asOf: Date,
): CoursePerformance {
  const courseAssignments = assignments.filter((assignment) => assignment.courseId === course.id);
  const relevantSubmissions = submissions.filter((submission) => submission.studentId === studentId);
  const grade = calculateCurrentCourseGrade(studentId, course.id, assignments, submissions, asOf);
  const missingAssignments = courseAssignments.filter(
    (assignment) => new Date(assignment.dueDate).getTime() <= asOf.getTime()
      && !relevantSubmissions.some((submission) => submission.assignmentId === assignment.id),
  );
  const gradedAssignments = courseAssignments.flatMap((assignment) => {
    const submission = relevantSubmissions.find((item) => item.assignmentId === assignment.id);
    if (submission?.score == null) return [];
    return [{
      assignment,
      percentage: assignment.pointsPossible === 0 ? 100 : submission.score / assignment.pointsPossible,
    }];
  });
  const weakestAssignment = missingAssignments[0]
    ?? gradedAssignments.sort((a, b) => a.percentage - b.percentage)[0]?.assignment
    ?? courseAssignments[0];

  return {
    course,
    percentage: grade.percentage,
    band: getPerformanceBand(grade.percentage),
    weakestTopic: weakestAssignment == null ? 'foundations' : inferTopic(weakestAssignment),
    hasMissingWork: grade.missingAssignments > 0,
  };
}

function scoreResource(resource: LearningResource, performance: CoursePerformance) {
  let score = resource.courseIds.includes(performance.course.id) ? 8 : 2;
  score += 8;
  if (resource.topics.includes(performance.weakestTopic)) score += 5;
  if (performance.band === 'struggling' && resource.topics.includes('study-skills')) score += 4;
  if (performance.hasMissingWork && resource.id === 'study-plan-reset') score += 5;
  return score;
}

function isDifficultyMatch(difficulty: ResourceDifficulty, band: PerformanceBand) {
  const preferredDifficulties: Record<PerformanceBand, ResourceDifficulty[]> = {
    struggling: ['remedial', 'core'],
    developing: ['core'],
    thriving: ['advanced', 'enrichment'],
  };
  return preferredDifficulties[band].includes(difficulty);
}

function toRecommendation(
  resource: LearningResource,
  performance: CoursePerformance,
): StudentRecommendation {
  const courseCode = resource.courseIds.includes('*') ? 'All courses' : performance.course.code;
  const reason = performance.band === 'struggling'
    ? `Build confidence in ${formatTopic(performance.weakestTopic)} for ${performance.course.code}.`
    : performance.band === 'thriving'
      ? `Extend your strong performance in ${performance.course.code}.`
      : `Target your weakest area in ${performance.course.code}: ${formatTopic(performance.weakestTopic)}.`;
  return { ...resource, courseCode, reason };
}

function inferTopic(assignment: Assignment) {
  const text = `${assignment.title} ${assignment.description}`.toLowerCase();
  const topicKeywords = [
    ['foundations', ['foundation', 'checkpoint', 'fundamental']],
    ['practice', ['practice', 'exercise', 'drill']],
    ['project', ['project', 'prototype', 'build']],
    ['analysis', ['analysis', 'analyze', 'reflection', 'evaluate']],
    ['application', ['applied', 'application', 'challenge']],
    ['synthesis', ['synthesis', 'final', 'integrate']],
  ] as const;
  return topicKeywords.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))?.[0]
    ?? 'foundations';
}

function formatTopic(topic: string) {
  return topic.replace(/-/g, ' ');
}

function getAverageSubmissionGap(submissions: Submission[]) {
  if (submissions.length < 2) return null;
  const gaps = submissions.slice(1).map((submission, index) => (
    new Date(submission.submittedAt).getTime() - new Date(submissions[index].submittedAt).getTime()
  ) / DAY_IN_MS);
  return gaps.reduce((total, gap) => total + gap, 0) / gaps.length;
}
