# Canvas Learning

Canvas Learning is a learning management application built with React, TypeScript, Vite, and a local Python service. Students can enroll in courses and submit work; instructors can grade submissions and review course analytics.

## Clone and run

Install Git, Node.js 22.12 or later (Node.js 24 is recommended), and Python 3.10 or later. Ensure `git`, `node`, `npm`, and `python` are available in your terminal. On Windows, select **Add Python to PATH** when installing Python. No Python packages or database are required.

```sh
git clone https://github.com/VanGoghCode/canvas-lms.git
cd canvas-lms
node --version
npm --version
python --version
npm ci
npm run dev
```

If your system provides `python3` but not `python` (common on macOS and Linux), create and activate a virtual environment before running `npm ci` and `npm run dev`:

```sh
python3 -m venv .venv
source .venv/bin/activate
```

`npm run dev` starts both Vite and the local Python service. Open the URL printed by Vite, usually [http://localhost:5173/](http://localhost:5173/). Keep the terminal open while using the app; press **Ctrl+C** to stop it. The Python service uses `127.0.0.1:8765`. If the port is already in use, stop the other process using it and run `npm run dev` again.

Select **Student → Emma Garcia** or **Instructor → Ava Patel** on the sign-in screen. You can also register a student account. No password is required.

Use the **Menu** button to open or close the workspace sidebar. On a narrow screen the menu starts closed and closes after you choose a page.

To try the complete coursework flow, register a student, enroll in **CS 210**, and submit **Applied Challenge**. Switch to instructor Ava Patel to grade it, then switch back to the student to see the score and feedback. **Restore workspace data** resets the local records and signs out.

For a production build and local preview, run `npm run build` followed by `npm run preview`; open the URL printed in the terminal.

## Bundled records

The repository includes the records in `src/data/`: 4 courses, 30 accounts (4 instructors and 26 students), 24 assignments, and 20 study resources. The initial workspace also includes 63 student enrollments and 196 submissions selected from the bundled records at the academic reference date, so grades and analytics have data to display. Profile details in the bundled student records are fictional.

The JSON files act like related database tables: `students.json` and `instructors.json` contain the respective accounts, while `courses.json`, `enrollments.json`, `assignments.json`, and `submissions.json` contain the shared course and coursework records. IDs connect the records; student and instructor views use the same workspace data. The files seed a workspace, after which changes are stored in the browser rather than written back to the JSON files.

Bundled current students have selected fictional course summaries for 2023 through 2025; the current term represents year four. A separate earlier cohort in the same student data file includes four years of records, 2025 program status, and a 2026 follow-up. Instructor analytics displays these historical records separately from current course activity. Some bundled submissions also have earlier attempts; these are visible in the instructor grading view. Newly registered students have no bundled history, and saved workspace data stays in the browser.

Choose Emma Garcia for a student workspace or Ava Patel for the CS 210 instructor workspace. Liam Johnson teaches WEB 240, Maya Chen teaches DS 150, and Noah Williams teaches UX 180. Existing browser data takes precedence; use **Restore workspace data** when you want the initial records again. This clears local changes and signs out.

## Find your way around

| Area | Where to look |
| --- | --- |
| Routes, role guards, and app entry point | `src/main.tsx` |
| Student and instructor screens | `src/pages/` |
| Shared interface elements | `src/components/` |
| Actions, validation, and initial state | `src/lib/store.ts` |
| Browser persistence and shared state | `src/lib/LmsContext.tsx` |
| Shared course, date, and access helpers | `src/lib/data.ts` |
| URL-based page filters | `src/lib/filters.ts` |
| Grades and instructor analytics | `src/lib/grading.ts`, `backend/analytics.py`, `src/lib/analytics.ts` |
| Previous course summaries | `src/data/students.json`, `src/components/AcademicHistory.tsx` |
| Study suggestions and pacing rules (Python) | `backend/study_plan.py` |
| Local service and Vite launcher (Python) | `backend/server.py` |
| Study-plan request and workspace summaries | `src/lib/recommendations.ts`, `src/lib/workspace.ts` |
| Profile validation and shared types | `src/lib/profile.ts`, `src/types.ts` |
| Bundled courses, people, assignments, and submissions | `src/data/` |
| Styles | `src/styles.css` |
| Logic and workflow tests | `tests/workflows.test.ts`, `tests/test_analytics.py`, `tests/test_study_plan.py` |

A typical action starts in a page, calls the shared state provider, and is validated and applied in `store.ts`. The provider saves the resulting state in browser storage.

## Data and rules

- Account selection and role checks happen in the browser; they are not secure authentication. Workspace changes persist in browser storage on the same origin and are not synchronized to a server or other devices. Tabs on the same origin receive storage updates.
- The local Python service calculates study suggestions and course analytics from the current workspace’s coursework and scores. Analytics also uses fictional demographic details from the bundled student records for group summaries. It does not store workspace data; assignment response text, instructor feedback, and user-entered profile details are not sent to it. The rest of the app remains available if the service is unavailable, while study suggestions and analytics show a warning.
- The bundled term uses a fixed academic reference date of **August 15, 2026, 12:00 UTC**. Dates without a timezone are interpreted as UTC. The snapshot does not advance with the computer clock.
- Students see their enrolled courses and their own work. Instructors see and grade their assigned courses. New students enroll through the catalog; joining a course includes assignments with past deadlines.
- Students can save drafts and submit text responses. Ungraded submissions can be revised; graded responses are locked. Instructors can publish or correct scores and feedback. Late work is accepted until September 5, 2026, 23:59 UTC, without an automatic penalty.
- Current grades use points earned divided by counted points possible. Overdue missing work counts as zero; future missing work and ungraded submissions are excluded. Instructor support views use coursework information to identify students who may need a check-in.
- Analytics date filters select assignment due dates in UTC. Completion counts submitted work, including work awaiting a grade. Study suggestions use local rules and bundled resources.
- If stored data is invalid, the app restores initial records with a notice. If storage is unavailable, changes remain in the open tab and the app displays a warning.

## Checks

```sh
npm test       # TypeScript and Python tests
npm run build  # TypeScript checks and production build
npm run check  # Both commands
```
