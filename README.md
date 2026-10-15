# Canvas Learning

Canvas Learning is a learning management application built with React, TypeScript, and Vite. Students can register, enroll, draft and submit work, and read published feedback. Instructors can review their own classes, grade work, and explore course analytics. The application runs entirely in the browser, with bundled course records and local persistence.

## Run locally

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

## Coursework workflow

1. Choose **Student → Emma Garcia**, or create a student account with a name and unique email.
2. For a new account, open **My courses**, browse the catalog, and **Enroll in CS 210**.
3. Open **Applied Challenge**. Write a response, navigate away or refresh, and return to your saved draft. Choose **Submit assignment** when ready. Ungraded work can be revised.
4. Choose **Switch account / Log out**, then **Instructor → Ava Patel**.
5. Open **Applied Challenge** from Assignment grading. Search for your student, enter a score from 0 to 100 and optional feedback, then **Save grade**.
6. Switch back to the student. The assignment shows the published score and feedback, and the graded response is read-only. Course progress and instructor analytics update from the same data.
7. Use **Restore workspace data** to restore the initial course records. The confirmation explains what will be cleared; cancelling keeps your work.

Other instructors: **Liam Johnson** (WEB 240), **Maya Chen** (DS 150), **Noah Williams** (UX 180). Each sees only their assigned course. Students see only their enrolled coursework; the catalog lets them join other courses.

## Role workspaces

| Role       | Page              | Purpose                                                                                                          |
| ---------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Student    | Dashboard         | Completion ring, status counts, next action, upcoming deadlines, course progress, results, and study suggestions |
| Student    | Assignments       | Searchable planner with missing, upcoming, pending, graded, and draft views; filters persist in the URL          |
| Student    | Grades & feedback | Course-by-course progress grades, submission completion, assignment scores, and links to feedback                |
| Instructor | Dashboard         | Grading progress, grade distribution, course health, assignment review links, and support summaries              |
| Instructor | Grading queue     | Assignments prioritized by pending responses, with course, search, and queue-status filters                      |
| Instructor | Students          | Course roster, due-work completion, support filters, and direct links to each student's submitted work           |
| Both       | Calendar          | Monthly UTC assignment deadlines, course filter, day selection, and an agenda linking to relevant coursework     |

The shared **i** button opens course descriptions, grading policies, metric definitions, and study advice. It works with mouse, touch, and keyboard; Escape or the close button dismisses it and restores focus. Core statuses, action consequences, feedback, and full assignment requirements stay visible. Draft guidance distinguishes private edits from the response an instructor can see. Planner counts follow the course and search filters, and filtered links survive sign-in.

Dashboard metrics use the same access-scoped data as the detail pages. Student completion includes all published coursework; instructor grading completion includes only received responses. Their information buttons explain the denominators. The calendar shows deadlines, not invented class meetings or announcements.

## Data and persistence

- The academic reference date is fixed at **August 15, 2026, 12:00 UTC**. Due dates, submission timestamps, progress grades, and suggestions use this snapshot. Dates without a timezone are interpreted as UTC.
- Versioned browser storage preserves identities, session, enrollments, assignment drafts, submissions, scores, and feedback through refreshes and account switches. Data stays in this browser and origin; it is not shared with a server or another device.
- Tabs on the same origin receive storage updates, including account changes. Workspace data is local to the browser; there is no server synchronization.
- Invalid or incompatible saved data restores the initial workspace with a visible notice. If storage is unavailable or full, changes remain in the open tab and a warning explains the limitation.
- Reset restores the initial course records and signs out. Account selection does not authenticate identity.
- Bundled records contain 30 identities (4 instructors and 26 students), 4 courses, and 24 assignments. Legacy instructor enrollments and submissions after the snapshot are excluded.
- New students enroll explicitly. Joining a mid-term course includes all six assignments, including past deadlines. The catalog explains this before enrollment; late work is accepted.
- Drafts are private to a student and assignment and do not count as submitted. Submitting removes the corresponding draft. Responses and feedback are limited to 20,000 characters.

## Coursework and grading rules

| Topic         | Behavior                                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access        | Students see their enrolled courses and their own work. Instructors see and grade only their assigned classes. Routes and action handlers both check access.                                 |
| Submission    | Text responses only. Empty responses are rejected. Early and late submissions are accepted until September 5, 2026, 23:59 UTC.                                                               |
| Revisions     | Ungraded work can be replaced; the latest submission timestamp determines lateness. Graded work is locked. Attempt history is not stored.                                                    |
| Current grade | Graded points earned divided by counted points possible. Overdue missing work counts as zero. Future missing work and pending grades are excluded. No counted points means no current grade. |
| Weighting     | Points-based: a 100-point assignment has four times the weight of a 25-point assignment.                                                                                                     |
| Letter grades | A ≥ 90%, B ≥ 80%, C ≥ 70%, D ≥ 60%, otherwise F. Letters and support flags use unrounded grades; display percentages round to one decimal.                                                   |
| Late work     | No automatic penalty. A revision after the deadline is marked late.                                                                                                                          |
| Grading       | Only the assigned instructor can publish a finite score from 0 through points possible. Feedback is optional. Instructors can correct published grades.                                      |
| Support       | Current course grades below 70% prompt a suggested check-in. This is a support signal, not a diagnosis or sanction.                                                                          |

Role and course checks govern navigation and local actions. They are client-side rules, not a security boundary. Account selection requires no password; server authentication and notification delivery are outside the current architecture.

## Analytics and study suggestions

- Date filters select assignment **due dates**, inclusively in UTC. Late submissions for selected assignments remain included. Reversed ranges show an actionable validation message.
- Average progress grade is the mean of available student grades. Students with no grade are excluded.
- Due-work completion counts submitted assignments whose deadlines have passed, including work awaiting grading. No due work means no completion percentage or cohort.
- Assignment completion includes early submissions. Average assignment scores include only graded work.
- Completion cohorts use unrounded rates: high ≥ 80%, moderate ≥ 50%, low < 50%.
- Activity charts count each student's latest recorded submission per assignment, not all revision attempts or study time. Comparisons are descriptive, not causal claims.
- Study suggestions use explicit grade-band and topic rules. Students without grades get core material. Suggested activities are not hosted content or AI output.

## Validation

```sh
npm test                         # Domain, validation, persistence, and analytics tests
npm run build                    # TypeScript checks and production bundle
npx playwright install chromium # One-time browser setup
npm run test:e2e                  # Desktop and mobile browser journeys + axe accessibility checks
npm run check                    # Unit tests, build, then browser tests
npm audit                        # Dependency advisory check
```

Browser tests cover role dashboards, planner and gradebook filters, calendar navigation, grading queues, roster-to-response links, information dialog keyboard behavior, registration and enrollment; draft recovery; submission and revision; grading and feedback; profile validation and persistence; deep links and access guards; analytics filters; corrupt or unavailable storage; and reset/cancel behavior. Each test uses an isolated browser context. Screenshots are generated under `test-results/previews/`; failed tests retain traces and screenshots. Browser tests start a local Vite server on port 4175 and reuse one already running there.

## Code map

| Path                            | Responsibility                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `src/main.tsx`                  | Routes, role guards, deep-link recovery, and missing-page handling              |
| `src/lib/store.ts`              | Pure validated mutations, initial records, save validation, and draft ownership |
| `src/lib/LmsContext.tsx`        | Shared application state, persistence, storage recovery, and tab updates        |
| `src/lib/profile.ts`            | Shared profile validation and normalization                                     |
| `src/lib/data.ts`               | UTC date handling, lookups, statuses, and course access                         |
| `src/lib/grading.ts`            | Points-based progress grades and support flags                                  |
| `src/lib/analytics.ts`          | Instructor metrics, filters, and cohorts                                        |
| `src/lib/recommendations.ts`    | Rule-based study suggestions and pacing                                         |
| `src/pages/`, `src/components/` | Student and instructor interfaces                                               |
| `src/styles.css`                | Responsive design, focus states, tables, and forms                              |
| `tests/`, `e2e/`                | Logic regression tests and browser journeys                                     |

## Optional weekly report

```sh
python scripts/weekly_report.py --as-of 2026-08-15
```

Requires Python 3.10+. Reads bundled JSON (not browser edits) and writes CSV to `reports/`. Reports include the entire selected UTC day, whereas the browser snapshot is noon. Reports additionally flag completion below 70%; the browser support panel flags course grades below 70%. Thresholds are defined at the top of the script.

## Architecture and scope

No backend, real authentication, file uploads, assignment authoring, enrollment capacity rules, excused assignments, extensions, notification delivery, plagiarism checks, or submission audit trail. The academic reference date keeps the bundled term and its grading calculations consistent; it does not advance with wall-clock time.
