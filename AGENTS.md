# Canvas Learning

Canvas Learning is a maintained learning management application for student coursework and instructor review. Treat it as a real product, with complete workflows, clear language, accessible interfaces, and consistent behavior.

## Product direction

- Present the application as Canvas Learning. Do not describe the repository or interface as a demo, prototype, sandbox, or testing project.
- Bundled course records and the local Python service for analytics and study suggestions are intentional. Do not introduce external authentication or remote services unless requested.
- Keep architecture documentation accurate: account selection is local, role checks are client-side, and browser storage is not server synchronization or secure authentication.
- Use task-oriented product copy. Explain storage or academic-date limitations where relevant, without claiming capabilities that do not exist.
- Preserve the configured academic reference date and bundled term unless a task explicitly changes scheduling behavior.
- Keep the existing browser storage key compatible so returning users retain their work.

## Repository identity

- Repository and npm package: canvas-lms. Product name: Canvas Learning.
- Keep paths relative to the repository so the checkout can be moved or renamed.

## Development

- React, TypeScript, and Vite for the interface in src/; Python for the local service in backend/.
- src/data/ contains bundled records. src/lib/store.ts validates state and actions; src/lib/LmsContext.tsx manages browser persistence.
- Follow existing accessibility patterns, role-scoped workflows, responsive layouts, and validation.
- Run npm test and npm run build for changes.
- Preserve unrelated work already present in the working tree. Do not commit unless asked.
