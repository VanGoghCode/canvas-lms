# Canvas Lite LMS Demo

A minimal Canvas-style learning management system built for local demos. It uses React, TypeScript, Vite, React Router, and plain CSS. There is no backend, database, authentication service, or network dependency at runtime.

## Features

- Mock login with any seeded user and a student/instructor role toggle
- Student dashboard with enrolled courses, upcoming assignments, and calculated grades
- Course catalog with instructors and enrollment counts
- Course detail pages with syllabus and assignments
- Assignment detail pages with in-memory text submission/resubmission
- Instructor view with assigned courses and rosters
- Static JSON seed data: 30 students, 4 courses, 24 assignments, and ~80% submission coverage

## Project structure

```text
src/
  components/   Reusable UI and route shell components
  data/         Static JSON seed data
  lib/          Context state and data access helpers
  pages/        Route-level page components
  types/        TypeScript data model interfaces
```

## Setup

Requires Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Then open the localhost URL printed by Vite (usually `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

## Weekly administrative report

Install the Python dependency and generate a report from the seeded LMS data:

```bash
python3 -m pip install -r requirements.txt
python3 scripts/weekly_report.py
```

The command prints the week's key findings and creates a timestamped CSV under
`reports/`. To reproduce a report for a specific date, pass
`--as-of YYYY-MM-DD`. Administrators can adjust the plain-language reporting
thresholds near the top of `scripts/weekly_report.py`.

## Demo notes

- All seed data is imported from JSON under `src/data/`.
- The React context owns mutable submission state. Changes persist only until the browser tab reloads.
- Grades are calculated from assignments that currently have a numeric score; ungraded or resubmitted work is excluded from the average.
- Ava Patel, Liam Johnson, Maya Chen, and Noah Williams are the seeded instructors for the four courses. Other users can still choose the instructor role, but their instructor page will show no assigned courses.

## Extending the app

The data access helpers in `src/lib/data.ts` intentionally keep query logic out of page components. If you later add a real API, you can replace the context data source while preserving most component and page interfaces. Good next additions include assignment creation, grading, announcements, persistent auth, API adapters, and tests.
