# Repository Guidelines

## Project Structure & Module Organization

This is a CommonJS Node/Express application with static frontend pages.

- `server.js` is the main Express server, API router, static file host, and Smartsheet workflow coordinator.
- `lib/` contains shared backend modules, including Smartsheet API access and config loading.
- `api/` contains serverless-style handlers that reuse shared backend logic.
- `public/` contains browser-facing HTML entry points such as `index.html`, `login.html`, `admin.html`, `admin-pl.html`, and `admin-ptfe.html`.
- `docs/` contains SOP/training documentation and images under `docs/sop_images/`.
- `scripts/` contains one-off operational utilities, such as Smartsheet column migration.
- `data/` is runtime data; `data/defect_columns.json` is ignored and should not be treated as source.

## Build, Test, and Development Commands

- `npm install` installs runtime dependencies from `package-lock.json`.
- `node server.js` starts the portal at `http://localhost:3000` unless `PORT` is set.
- `npm test` is currently a placeholder that exits with an error; do not rely on it as validation until real tests are added.
- `node scripts/migrate-defect-columns.js` runs a one-time Smartsheet migration. Use only after confirming `.env` points at the intended sheet.

## Coding Style & Naming Conventions

Use CommonJS (`require`, `module.exports`) for backend modules. Match the existing JavaScript style: 4-space indentation, semicolons, `camelCase` for functions and local variables, and `UPPER_SNAKE_CASE` for environment-backed constants and column maps. Keep route handlers small where possible and move reusable Smartsheet/config behavior into `lib/`.

Frontend files are plain HTML/CSS/JavaScript. Keep page-specific behavior close to the owning file unless it becomes shared across pages.

## Testing Guidelines

There is no active automated test suite yet. For backend changes, add focused tests before introducing broad refactors, and document any manual verification performed. At minimum, start `node server.js`, exercise affected pages in `public/`, and verify relevant Smartsheet read/write paths with non-production data when possible.

## Commit & Pull Request Guidelines

This checkout does not include local Git history, so no historical convention can be verified. Use short, imperative commit subjects, for example `Fix sequence timing calculation` or `Add admin defect validation`. Pull requests should include a concise summary, manual test notes, linked issue or request context, and screenshots for visible UI changes.

## Security & Configuration Tips

Keep `.env` local and out of commits. Required Smartsheet IDs and tokens are loaded from department-scoped variables such as `DEPT_PL_API_TOKEN`, `DEPT_PL_MASTER_LOG_SHEET_ID`, `DEPT_PTFE_CONFIG_SHEET_ID`, and `DEPT_PI_CONFIG_SHEET_ID`. Review `CORS_ORIGIN` before deployment, and avoid logging token values or sheet payloads containing employee data.
