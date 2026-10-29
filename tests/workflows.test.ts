import { describe, expect, it } from 'vitest';
import assignments from '../src/data/assignments.json';
import courses from '../src/data/courses.json';
import {
  applyAction,
  createInitialState,
  draftKey,
  MAX_RESPONSE_LENGTH,
  parseSavedState,
  type Action,
  type WorkspaceState,
} from '../src/lib/store';
import { ACADEMIC_DATE, emptyStudentProfile, time } from '../src/lib/data';
import { summarizeGrade, identifyStudentsAtRisk } from '../src/lib/grading';
import { validateStudentProfile } from '../src/lib/profile';
import type { Assignment, Submission } from '../src/types';

const profile = { ...emptyStudentProfile, name: ' Test Learner ', email: ' TEST@EXAMPLE.COM ' };
const act = (state: WorkspaceState, action: Action) => {
  const result = applyAction(state, action);
  expect(result.error).toBeNull();
  return result.state;
};
const learner = () => act(createInitialState(), { type: 'register', id: 'new', profile });
const enrolled = () => act(learner(), { type: 'enroll', courseId: 'c101', id: 'new-e' });
const submit = (state: WorkspaceState) =>
  act(state, {
    type: 'submit',
    assignmentId: 'a105',
    studentId: 'new',
    content: ' A response ',
    id: 'new-s',
  });
const login = (state: WorkspaceState, userId = 's01') =>
  act(state, { type: 'login', userId, role: 'instructor' });
const assignment = (
  id: string,
  pointsPossible: number,
  dueDate = '2026-08-01T23:59',
): Assignment => ({ id, courseId: 'c101', title: id, description: '', pointsPossible, dueDate });
const submission = (assignmentId: string, score: number | null): Submission => ({
  id: assignmentId,
  assignmentId,
  studentId: 'new',
  score,
  content: 'response',
  comment: '',
  submittedAt: '2026-08-02T12:00:00Z',
});

describe('complete coursework workflow', () => {
  it('registers, enrolls, drafts, submits, grades, reloads, and locks graded work', () => {
    let state = enrolled();
    expect(state.students.at(-1)?.email).toBe('test@example.com');
    state = act(state, { type: 'draft', assignmentId: 'a105', content: 'Draft response' });
    state = parseSavedState(JSON.stringify(state));
    expect(state.drafts[draftKey('new', 'a105')]).toBe('Draft response');
    state = submit(state);
    expect(state.drafts[draftKey('new', 'a105')]).toBeUndefined();
    expect(state.submissions.at(-1)?.content).toBe('A response');
    state = login(state);
    state = act(state, {
      type: 'grade',
      submissionId: 'new-s',
      score: 92.5,
      comment: ' Well reasoned. ',
    });
    state = act(state, { type: 'logout' });
    state = act(state, { type: 'login', userId: 'new', role: 'student' });
    state = parseSavedState(JSON.stringify(state));
    expect(state.submissions.at(-1)).toMatchObject({ score: 92.5, comment: 'Well reasoned.' });
    expect(
      applyAction(state, {
        type: 'submit',
        assignmentId: 'a105',
        studentId: 'new',
        content: 'erase grade',
        id: 'another',
      }).error,
    ).toBeTruthy();
  });
  it('replaces an ungraded response without creating duplicate submissions', () => {
    let state = submit(enrolled());
    const count = state.submissions.length;
    state = act(state, {
      type: 'submit',
      assignmentId: 'a105',
      studentId: 'new',
      content: 'Revised',
      id: 'unused',
    });
    expect(state.submissions).toHaveLength(count);
    expect(state.submissions.at(-1)).toMatchObject({
      id: 'new-s',
      content: 'Revised',
      score: null,
    });
  });
  it('accepts late work without an automatic penalty, and permits grade corrections including zero', () => {
    let state = act(enrolled(), {
      type: 'submit',
      assignmentId: 'a101',
      studentId: 'new',
      content: 'Late response',
      id: 'late',
    });
    expect(time(state.submissions.at(-1)!.submittedAt)).toBeGreaterThan(
      time(assignments[0].dueDate),
    );
    state = act(login(state), { type: 'grade', submissionId: 'late', score: 25, comment: '' });
    state = act(state, { type: 'grade', submissionId: 'late', score: 0, comment: 'Corrected' });
    expect(state.submissions.at(-1)?.score).toBe(0);
  });
});

describe('validation and access', () => {
  it('excludes instructor enrollments and submissions after the snapshot', () => {
    const state = createInitialState();
    expect(
      state.enrollments.every((e) => !courses.some((c) => c.instructorId === e.studentId)),
    ).toBe(true);
    expect(state.submissions.every((s) => time(s.submittedAt) <= ACADEMIC_DATE.getTime())).toBe(
      true,
    );
    expect(parseSavedState(JSON.stringify(state))).toEqual(state);
  });
  it('rejects duplicate emails, invalid profiles, duplicate enrollments, and role spoofing', () => {
    let state = learner();
    expect(
      applyAction(state, { type: 'login', userId: 'new', role: 'instructor' }).error,
    ).toBeTruthy();
    expect(applyAction(state, { type: 'profile', id: 's05', profile }).error).toBeTruthy();
    state = act(state, { type: 'logout' });
    expect(applyAction(state, { type: 'register', id: 'another', profile }).error).toContain(
      'already exists',
    );
    expect(
      applyAction(state, { type: 'register', id: 'another', profile: { ...profile, email: 'bad' } })
        .error,
    ).toContain('valid email');
    state = enrolled();
    expect(
      applyAction(state, { type: 'enroll', courseId: 'c101', id: 'duplicate' }).error,
    ).toContain('already enrolled');
  });
  it('rejects unenrolled submissions and impersonating another student', () => {
    const action: Action = {
      type: 'submit',
      assignmentId: 'a105',
      studentId: 'new',
      content: 'response',
      id: 's',
    };
    expect(applyAction(learner(), action).error).toBeTruthy();
    expect(applyAction(enrolled(), { ...action, studentId: 's05' }).error).toBeTruthy();
    expect(applyAction(enrolled(), { ...action, content: '   ' }).error).toBeTruthy();
    expect(
      applyAction(enrolled(), { ...action, content: 'a'.repeat(MAX_RESPONSE_LENGTH + 1) }).error,
    ).toBeTruthy();
  });
  it('rejects grading by students or instructors outside the course', () => {
    const state = submit(enrolled());
    const action: Action = { type: 'grade', submissionId: 'new-s', score: 95, comment: '' };
    expect(applyAction(state, action).error).toBeTruthy();
    expect(applyAction(login(state, 's02'), action).error).toBeTruthy();
  });
  it.each([NaN, Infinity, -1, 101])('rejects score %s', (score) => {
    expect(
      applyAction(login(submit(enrolled())), {
        type: 'grade',
        submissionId: 'new-s',
        score,
        comment: '',
      }).error,
    ).toBeTruthy();
  });
  it('validates calendar dates in UTC and exclusive profile options', () => {
    expect(
      validateStudentProfile({ ...profile, dateOfBirth: '2026-02-30' }).dateOfBirth,
    ).toBeTruthy();
    expect(
      validateStudentProfile({ ...profile, dateOfBirth: '2026-08-16' }).dateOfBirth,
    ).toBeTruthy();
    expect(
      validateStudentProfile({ ...profile, dateOfBirth: '2004-02-29' }).dateOfBirth,
    ).toBeUndefined();
    expect(
      validateStudentProfile({ ...profile, races: ['white', 'prefer-not-to-answer'] }).races,
    ).toBeTruthy();
  });
  it('rejects damaged, incompatible, or inconsistent browser saves', () => {
    expect(() => parseSavedState('{')).toThrow();
    expect(() => parseSavedState(JSON.stringify({ ...enrolled(), version: 0 }))).toThrow();
    expect(() =>
      parseSavedState(
        JSON.stringify({ ...enrolled(), session: { userId: 'new', role: 'instructor' } }),
      ),
    ).toThrow();
    const state = submit(enrolled());
    state.submissions.push({ ...state.submissions.at(-1)!, id: 'duplicate' });
    expect(() => parseSavedState(JSON.stringify(state))).toThrow();
  });
});

describe('grades and analytics', () => {
  it('uses points weighting, counts overdue zeros, and excludes pending and future work', () => {
    const list = [
      assignment('a', 25),
      assignment('b', 100),
      assignment('missing', 50),
      assignment('pending', 50),
      assignment('future', 100, '2026-08-22T23:59'),
    ];
    const grade = summarizeGrade('new', list, [
      submission('a', 25),
      submission('b', 50),
      submission('pending', null),
    ]);
    expect(grade.rawPercentage).toBeCloseTo((75 / 175) * 100);
    expect(grade).toMatchObject({
      possiblePoints: 175,
      missingAssignments: 1,
      pendingAssignments: 1,
      letterGrade: 'F',
    });
  });
  it('does not label students with no counted work as failing', () => {
    const list = [assignment('future', 100, '2026-08-22T23:59')];
    expect(summarizeGrade('new', list, []).rawPercentage).toBeNull();
    expect(identifyStudentsAtRisk(['new'], 'c101', list, [])).toEqual([]);
  });
  it('uses unrounded values at letter and support thresholds', () => {
    expect(summarizeGrade('new', [assignment('a', 100)], [submission('a', 69.99)])).toMatchObject({
      percentage: 70,
      letterGrade: 'D',
    });
    expect(
      identifyStudentsAtRisk(['new'], 'c101', [assignment('a', 100)], [submission('a', 69.99)]),
    ).toHaveLength(1);
  });

});
