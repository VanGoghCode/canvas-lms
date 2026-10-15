import assignments from '../data/assignments.json';
import courses from '../data/courses.json';
import initialEnrollments from '../data/enrollments.json';
import initialStudents from '../data/students.json';
import initialSubmissions from '../data/submissions.json';
import type { Enrollment, Session, Student, StudentProfile, Submission } from '../types';
import {
  canAccessCourse,
  ACADEMIC_DATE,
  emptyStudentProfile,
  TERM_CLOSE,
  time,
  usersForRole,
} from './data';
import { trimAll, validateStudentProfile } from './profile';

export const STORAGE_KEY = 'canvas-lite:v1';
export const MAX_RESPONSE_LENGTH = 20000;
export interface WorkspaceState {
  version: 1;
  session: Session | null;
  students: Student[];
  enrollments: Enrollment[];
  submissions: Submission[];
  drafts: Record<string, string>;
}
export const draftKey = (studentId: string, assignmentId: string) => `${studentId}:${assignmentId}`;

export function createInitialState(): WorkspaceState {
  const instructors = new Set(courses.map((c) => c.instructorId));
  const enrollments = initialEnrollments.filter((e) => !instructors.has(e.studentId));
  return {
    version: 1,
    session: null,
    drafts: {},
    enrollments,
    students: initialStudents.map((s) => ({ ...emptyStudentProfile, ...s })),
    submissions: initialSubmissions
      .filter(
        (s) =>
          time(s.submittedAt) <= ACADEMIC_DATE.getTime() &&
          enrollments.some(
            (e) =>
              e.studentId === s.studentId &&
              e.courseId === assignments.find((a) => a.id === s.assignmentId)?.courseId,
          ),
      )
      .map((s) => ({ ...s, comment: '' })),
  };
}

export type Action =
  | { type: 'login'; userId: string; role: Session['role'] }
  | { type: 'logout' }
  | { type: 'register'; profile: StudentProfile; id: string }
  | { type: 'profile'; id: string; profile: StudentProfile }
  | { type: 'enroll'; courseId: string; id: string }
  | { type: 'draft'; assignmentId: string; content: string }
  | { type: 'submit'; assignmentId: string; studentId: string; content: string; id: string }
  | { type: 'grade'; submissionId: string; score: number; comment: string };

/** Shared validation protects every mutation, including calls outside visible forms. */
export function applyAction(
  state: WorkspaceState,
  action: Action,
): { state: WorkspaceState; error: string | null } {
  const fail = (error: string) => ({ state, error });
  const ok = (next: WorkspaceState) => ({ state: next, error: null });
  const session = state.session;
  if (action.type === 'logout') return ok({ ...state, session: null });
  if (action.type === 'login') {
    if (!usersForRole(state.students, courses, action.role).some((s) => s.id === action.userId))
      return fail('Choose an available account.');
    return ok({ ...state, session: { userId: action.userId, role: action.role } });
  }
  if (action.type === 'register' || action.type === 'profile') {
    if (
      action.type === 'register'
        ? Boolean(session)
        : session?.role !== 'student' || session.userId !== action.id
    )
      return fail('This profile cannot be changed from this account.');
    const profile = trimAll(action.profile);
    const errors = validateStudentProfile(profile, (email) =>
      state.students.some(
        (s) =>
          (action.type === 'register' || s.id !== action.id) &&
          s.email.toLowerCase() === email.toLowerCase(),
      ),
    );
    if (Object.keys(errors).length) return fail(Object.values(errors)[0]!);
    const student = {
      ...profile,
      email: profile.email.toLowerCase(),
      id: action.id,
      genderIdentityDetails:
        profile.genderIdentity === 'self-described' ? profile.genderIdentityDetails : '',
    };
    return ok({
      ...state,
      students:
        action.type === 'register'
          ? [...state.students, student]
          : state.students.map((s) => (s.id === action.id ? student : s)),
      session: action.type === 'register' ? { userId: action.id, role: 'student' } : session,
    });
  }
  if (action.type === 'enroll') {
    if (session?.role !== 'student' || !courses.some((c) => c.id === action.courseId))
      return fail('Choose an available course as a student.');
    if (
      state.enrollments.some(
        (e) => e.courseId === action.courseId && e.studentId === session.userId,
      )
    )
      return fail('You are already enrolled in this course.');
    return ok({
      ...state,
      enrollments: [
        ...state.enrollments,
        { id: action.id, courseId: action.courseId, studentId: session.userId },
      ],
    });
  }
  if (action.type === 'grade') {
    const submission = state.submissions.find((s) => s.id === action.submissionId);
    const assignment = assignments.find((a) => a.id === submission?.assignmentId);
    const course = courses.find((c) => c.id === assignment?.courseId);
    if (
      !submission ||
      !assignment ||
      session?.role !== 'instructor' ||
      course?.instructorId !== session.userId ||
      !state.enrollments.some(
        (e) => e.courseId === course.id && e.studentId === submission.studentId,
      )
    )
      return fail('You cannot grade this submission.');
    if (
      !Number.isFinite(action.score) ||
      action.score < 0 ||
      action.score > assignment.pointsPossible
    )
      return fail(`Enter a score between 0 and ${assignment.pointsPossible}.`);
    if (action.comment.length > MAX_RESPONSE_LENGTH) return fail('Feedback is too long.');
    return ok({
      ...state,
      submissions: state.submissions.map((s) =>
        s.id === submission.id ? { ...s, score: action.score, comment: action.comment.trim() } : s,
      ),
    });
  }
  const assignment = assignments.find((a) => a.id === action.assignmentId);
  const course = courses.find((c) => c.id === assignment?.courseId);
  if (
    session?.role !== 'student' ||
    !course ||
    !canAccessCourse(session.userId, 'student', course, state.enrollments) ||
    (action.type === 'submit' && action.studentId !== session.userId)
  )
    return fail('You must be enrolled to submit this assignment.');
  const existing = state.submissions.find(
    (s) => s.assignmentId === action.assignmentId && s.studentId === session.userId,
  );
  if (existing?.score != null || ACADEMIC_DATE > TERM_CLOSE)
    return fail('This assignment is closed for changes.');
  if (action.content.length > MAX_RESPONSE_LENGTH)
    return fail(`Use ${MAX_RESPONSE_LENGTH.toLocaleString()} characters or fewer.`);
  const key = draftKey(session.userId, action.assignmentId);
  if (action.type === 'draft')
    return ok({ ...state, drafts: { ...state.drafts, [key]: action.content } });
  if (!action.content.trim()) return fail('Write a response before submitting.');
  const next: Submission = {
    id: existing?.id ?? action.id,
    assignmentId: action.assignmentId,
    studentId: session.userId,
    content: action.content.trim(),
    submittedAt: ACADEMIC_DATE.toISOString(),
    score: null,
    comment: '',
  };
  const drafts = { ...state.drafts };
  delete drafts[key];
  return ok({
    ...state,
    drafts,
    submissions: existing
      ? state.submissions.map((s) => (s.id === existing.id ? next : s))
      : [...state.submissions, next],
  });
}

/** Reject incompatible saves as a unit instead of loading broken references. */
export function parseSavedState(raw: string): WorkspaceState {
  const state: WorkspaceState = JSON.parse(raw);
  const assert = (value: unknown): void => {
    if (!value) throw new Error('Invalid workspace save');
  };
  assert(
    state &&
      state.version === 1 &&
      Array.isArray(state.students) &&
      Array.isArray(state.enrollments) &&
      Array.isArray(state.submissions) &&
      state.drafts &&
      typeof state.drafts === 'object' &&
      !Array.isArray(state.drafts),
  );
  const unique = (items: { id: string }[]) =>
    items.every((s) => typeof s.id === 'string' && s.id.length) &&
    new Set(items.map((s) => s.id)).size === items.length;
  assert(unique(state.students) && unique(state.enrollments) && unique(state.submissions));
  for (const s of state.students) {
    assert(
      Object.keys(emptyStudentProfile).every((k) =>
        k === 'races'
          ? Array.isArray(s.races) && s.races.every((r) => typeof r === 'string')
          : typeof s[k as keyof StudentProfile] === 'string',
      ),
    );
    assert(!Object.keys(validateStudentProfile(s)).length);
  }
  assert(new Set(state.students.map((s) => s.email.toLowerCase())).size === state.students.length);
  assert(initialStudents.every((s) => state.students.some((saved) => saved.id === s.id)));
  const learnerIds = new Set(usersForRole(state.students, courses, 'student').map((s) => s.id));
  assert(
    new Set(state.enrollments.map((e) => `${e.studentId}:${e.courseId}`)).size ===
      state.enrollments.length,
  );
  for (const e of state.enrollments)
    assert(learnerIds.has(e.studentId) && courses.some((c) => c.id === e.courseId));
  assert(
    new Set(state.submissions.map((s) => draftKey(s.studentId, s.assignmentId))).size ===
      state.submissions.length,
  );
  for (const s of state.submissions) {
    const assignment = assignments.find((a) => a.id === s.assignmentId);
    assert(
      assignment &&
        state.enrollments.some(
          (e) => e.studentId === s.studentId && e.courseId === assignment.courseId,
        ),
    );
    assert(
      typeof s.content === 'string' &&
        s.content.trim() &&
        s.content.length <= MAX_RESPONSE_LENGTH &&
        typeof s.comment === 'string' &&
        s.comment.length <= MAX_RESPONSE_LENGTH,
    );
    assert(
      typeof s.submittedAt === 'string' &&
        Number.isFinite(time(s.submittedAt)) &&
        time(s.submittedAt) <= ACADEMIC_DATE.getTime(),
    );
    assert(
      s.score === null ||
        (typeof s.score === 'number' &&
          Number.isFinite(s.score) &&
          s.score >= 0 &&
          s.score <= assignment!.pointsPossible),
    );
  }
  for (const [key, content] of Object.entries(state.drafts)) {
    assert(typeof content === 'string' && content.length <= MAX_RESPONSE_LENGTH);
    assert(
      state.enrollments.some((e) =>
        assignments.some((a) => a.courseId === e.courseId && draftKey(e.studentId, a.id) === key),
      ),
    );
  }
  assert(
    state.session === null ||
      (state.session &&
        ['student', 'instructor'].includes(state.session.role) &&
        usersForRole(state.students, courses, state.session.role).some(
          (s) => s.id === state.session!.userId,
        )),
  );
  return state;
}
