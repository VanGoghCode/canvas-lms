// Rule-based study suggestions (no AI): resources come from data/resources.json.
import resources from '../data/resources.json';
import type { Assignment, Course, Enrollment, Submission } from '../types';
import { ACADEMIC_DATE, findSubmission, studentCourses, time } from './data';
import { calculateCurrentCourseGrade } from './grading';

type Band = 'struggling' | 'developing' | 'thriving';
type Resource = (typeof resources)[number];
type CoursePerformance = ReturnType<typeof coursePerformance>;

// Resource difficulties that suit each grade band.
const DIFFICULTIES: Record<Band, string[]> = {
  struggling: ['remedial', 'core'],
  developing: ['core'],
  thriving: ['advanced', 'enrichment'],
};

// An assignment's topic is the first one whose keyword appears in its title or description.
const TOPIC_KEYWORDS: [string, string[]][] = [
  ['foundations', ['foundation', 'checkpoint', 'fundamental']],
  ['practice', ['practice', 'exercise', 'drill']],
  ['project', ['project', 'prototype', 'build']],
  ['analysis', ['analysis', 'analyze', 'reflection', 'evaluate']],
  ['application', ['applied', 'application', 'challenge']],
  ['synthesis', ['synthesis', 'final', 'integrate']],
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Top `limit` resources across the student's courses, best match first. */
export function generateRecommendations(
  studentId: string,
  courses: Course[],
  enrollments: Enrollment[],
  assignments: Assignment[],
  submissions: Submission[],
  limit = 3,
  asOf = ACADEMIC_DATE,
) {
  const performances = studentCourses(studentId, courses, enrollments).map((course) =>
    coursePerformance(studentId, course, assignments, submissions, asOf),
  );

  if (!performances.length) {
    return resources
      .filter((r) => r.courseIds.includes('*'))
      .slice(0, limit)
      .map((r) => ({
        ...r,
        courseCode: 'All courses',
        reason: 'Build a useful learning routine while your course activity gets underway.',
      }));
  }

  return resources
    .flatMap((resource) => {
      // Pick the course this resource helps most.
      const best = performances
        .filter(
          (p) =>
            (resource.courseIds.includes(p.course.id) || resource.courseIds.includes('*')) &&
            DIFFICULTIES[p.band].includes(resource.difficulty),
        )
        .map((p) => ({ p, score: matchScore(resource, p) }))
        .sort((a, b) => b.score - a.score || a.p.course.id.localeCompare(b.p.course.id))[0];
      return best
        ? [{ score: best.score, recommendation: toRecommendation(resource, best.p) }]
        : [];
    })
    .sort((a, b) => b.score - a.score || a.recommendation.id.localeCompare(b.recommendation.id))
    .slice(0, limit)
    .map((item) => item.recommendation);
}

function coursePerformance(
  studentId: string,
  course: Course,
  assignments: Assignment[],
  submissions: Submission[],
  asOf: Date,
) {
  const grade = calculateCurrentCourseGrade(studentId, course.id, assignments, submissions, asOf);
  const ownAssignments = assignments.filter((a) => a.courseId === course.id);
  const submitted = (a: Assignment) => findSubmission(submissions, a.id, studentId);
  const ratio = (a: Assignment) =>
    a.pointsPossible ? submitted(a)!.score! / a.pointsPossible : Infinity;

  // Weakest assignment: first overdue missing one, else lowest score, else the first one.
  const weakest =
    ownAssignments.find((a) => time(a.dueDate) <= asOf.getTime() && !submitted(a)) ??
    ownAssignments
      .filter((a) => submitted(a)?.score != null)
      .sort((a, b) => ratio(a) - ratio(b))[0] ??
    ownAssignments[0];
  const text = weakest ? `${weakest.title} ${weakest.description}`.toLowerCase() : '';
  const percentage = grade.rawPercentage ?? 80;

  return {
    course,
    band: (percentage < 70 ? 'struggling' : percentage >= 90 ? 'thriving' : 'developing') as Band,
    weakestTopic:
      TOPIC_KEYWORDS.find(([, words]) => words.some((w) => text.includes(w)))?.[0] ?? 'foundations',
    hasMissingWork: grade.missingAssignments > 0,
    hasGrade: grade.percentage != null,
  };
}

function matchScore(resource: Resource, p: CoursePerformance) {
  let score = resource.courseIds.includes(p.course.id) ? 8 : 2;
  if (resource.topics.includes(p.weakestTopic)) score += 5;
  if (p.band === 'struggling' && resource.topics.includes('study-skills')) score += 4;
  if (p.hasMissingWork && resource.id === 'study-plan-reset') score += 5;
  return score;
}

function toRecommendation(resource: Resource, p: CoursePerformance) {
  const code = p.course.code;
  const reasons: Record<Band, string> = {
    struggling: `Build confidence in ${p.weakestTopic} for ${code}.`,
    developing: `Target your weakest area in ${code}: ${p.weakestTopic}.`,
    thriving: `Extend your strong performance in ${code}.`,
  };
  return {
    ...resource,
    courseCode: resource.courseIds.includes('*') ? 'All courses' : code,
    reason: p.hasGrade
      ? reasons[p.band]
      : `Get started with core material for ${code}; no current grade is available yet.`,
  };
}

/** One pacing tip from the student's submission history; the first matching rule wins. */
export function getPacingSuggestion(
  studentId: string,
  enrollments: Enrollment[],
  assignments: Assignment[],
  submissions: Submission[],
  asOf = ACADEMIC_DATE,
) {
  const courseIds = [
    ...new Set(enrollments.filter((e) => e.studentId === studentId).map((e) => e.courseId)),
  ];
  if (!courseIds.length)
    return {
      status: 'maintain',
      title: 'Register for coursework first',
      message:
        'You have no enrolled courses yet. Browse the course catalog to enroll. Your study plan will update as you submit work.',
    };
  const mine = new Map(
    assignments.filter((a) => courseIds.includes(a.courseId)).map((a) => [a.id, a]),
  );
  const done = submissions
    .filter(
      (s) =>
        s.studentId === studentId &&
        mine.has(s.assignmentId) &&
        time(s.submittedAt) <= asOf.getTime(),
    )
    .sort((a, b) => time(a.submittedAt) - time(b.submittedAt));

  if (!done.length) {
    return {
      status: 'adjust',
      title: 'Start with a steady weekly rhythm',
      message:
        'No submission pattern is available yet. For the rest of the term, schedule two short work blocks per course each week and begin the next assignment at least three days before it is due.',
    };
  }

  const overdue = [...mine.values()].filter(
    (a) => time(a.dueDate) < asOf.getTime() && !done.some((s) => s.assignmentId === a.id),
  ).length;
  const lateRate =
    done.filter((s) => time(s.submittedAt) > time(mine.get(s.assignmentId)!.dueDate)).length /
    done.length;
  const grades = courseIds
    .map(
      (id) =>
        calculateCurrentCourseGrade(studentId, id, assignments, submissions, asOf).rawPercentage,
    )
    .filter((p): p is number => p != null);
  const averageGrade = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null;
  const averageGapDays =
    (time(done[done.length - 1].submittedAt) - time(done[0].submittedAt)) /
    Math.max(1, done.length - 1) /
    DAY_MS;

  if (overdue > 0 || lateRate >= 0.3 || (averageGrade != null && averageGrade < 70)) {
    const reason =
      overdue > 0
        ? `${overdue} overdue ${overdue === 1 ? 'assignment needs' : 'assignments need'} attention`
        : lateRate >= 0.3
          ? 'recent work is often arriving after the deadline'
          : 'your current grades are below 70%';
    return {
      status: 'adjust',
      title: 'Lighten the weekly crunch',
      message: `Adjust your workload because ${reason}. For the rest of the term, move one study block earlier in the week and focus on one high-impact task at a time before adding extra work.`,
    };
  }
  if (done.length >= 3 && averageGapDays < 2) {
    return {
      status: 'adjust',
      title: 'Spread work more evenly',
      message:
        'Your submissions are clustered close together. For the rest of the term, distribute work across the week and leave a separate review block before each deadline.',
    };
  }
  if (averageGrade != null && averageGrade >= 90 && lateRate < 0.1) {
    return {
      status: 'stretch',
      title: 'Keep your pace and add one stretch block',
      message:
        'Your current grades are strong and most submissions are on time. If your workload feels manageable, consider one optional weekly block for advanced material.',
    };
  }
  return {
    status: 'maintain',
    title: 'Maintain a consistent pace',
    message:
      'Most of your work has arrived on time. For the rest of the term, keep your current weekly cadence and use one short review session to target the weakest topic highlighted in your recommendations.',
  };
}
