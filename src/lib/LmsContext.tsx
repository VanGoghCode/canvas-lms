import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import assignments from '../data/assignments.json';
import courses from '../data/courses.json';
import type { Role, StudentProfile } from '../types';
import {
  applyAction,
  createInitialState,
  parseSavedState,
  STORAGE_KEY,
  type Action,
  type WorkspaceState,
} from './store';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { state: raw ? parseSavedState(raw) : createInitialState(), warning: '' };
  } catch {
    return {
      state: createInitialState(),
      warning:
        'Your saved workspace could not be loaded. Initial course records have been restored; browser storage may be unavailable.',
    };
  }
}

function useLmsState() {
  const [initial] = useState(load);
  const [state, setState] = useState(initial.state);
  const [signedOutManually, setSignedOutManually] = useState(false);
  const current = useRef(state);
  const [storageWarning, setStorageWarning] = useState(initial.warning);
  const commit = (next: WorkspaceState) => {
    current.current = next;
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageWarning('');
    } catch {
      setStorageWarning(
        'Changes are available in this tab, but could not be saved to this browser. Keep this tab open to avoid losing your work.',
      );
    }
  };
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      try {
        const next = event.newValue ? parseSavedState(event.newValue) : createInitialState();
        current.current = next;
        setState(next);
      } catch {
        setStorageWarning(
          'Another tab has an unreadable save. Your current work is still available.',
        );
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const dispatch = (action: Action) => {
    const result = applyAction(current.current, action);
    if (!result.error) commit(result.state);
    return result.error;
  };
  return {
    ...state,
    courses,
    assignments,
    storageWarning,
    signedOutManually,
    resetWorkspace: () => {
      setSignedOutManually(true);
      commit(createInitialState());
    },
    login: (userId: string, role: Role) => {
      setSignedOutManually(false);
      return dispatch({ type: 'login', userId, role });
    },
    logout: () => {
      setSignedOutManually(true);
      return dispatch({ type: 'logout' });
    },
    registerStudent: (profile: StudentProfile) =>
      dispatch({ type: 'register', profile, id: crypto.randomUUID() }),
    updateStudent: (id: string, profile: StudentProfile) =>
      dispatch({ type: 'profile', id, profile }),
    enrollCourse: (courseId: string) =>
      dispatch({ type: 'enroll', courseId, id: crypto.randomUUID() }),
    saveDraft: (assignmentId: string, content: string) =>
      dispatch({ type: 'draft', assignmentId, content }),
    submitAssignment: (assignmentId: string, studentId: string, content: string) =>
      dispatch({ type: 'submit', assignmentId, studentId, content, id: crypto.randomUUID() }),
    gradeSubmission: (submissionId: string, score: number, comment: string) =>
      dispatch({ type: 'grade', submissionId, score, comment }),
  };
}

const LmsContext = createContext<ReturnType<typeof useLmsState> | null>(null);
export function LmsProvider({ children }: { children: ReactNode }) {
  return <LmsContext.Provider value={useLmsState()}>{children}</LmsContext.Provider>;
}
export function useLms() {
  const lms = useContext(LmsContext);
  if (!lms) throw new Error('useLms must be used inside LmsProvider');
  return lms;
}
export const homePath = (role: Role) => (role === 'student' ? '/dashboard' : '/instructor');
