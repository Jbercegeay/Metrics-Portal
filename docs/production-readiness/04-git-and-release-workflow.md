# Git And Release Workflow

## Purpose

Git history is part of the production control system. Every production change must be traceable to an approved requirement, validated on an isolated branch, and recoverable through a known release or rollback commit.

## Permanent Branches

### main

- `main` represents the latest approved, deployable production baseline.
- Direct feature development on `main` is not allowed.
- `main` should be protected in GitHub when repository settings permit.
- Changes reach `main` through reviewed pull requests or an explicitly documented emergency hotfix process.
- The production server pulls only approved commits from `main` or an approved release tag.

Do not create permanent department branches. PL, PTFE, and PI should not drift into three long-lived code histories.

## Working Branches

Create one branch per bounded work package from an up-to-date `main`:

```powershell
git switch main
git pull --ff-only origin main
git switch -c codex/<short-work-package-name>
```

Examples:

```text
codex/postgres-foundation
codex/submission-outbox
codex/pl-page-extraction
codex/pl-server-workspaces
codex/supervisor-submission-status
codex/hotfix-pl-submit-timeout
```

Branch names describe the deliverable, not the developer. Avoid branches that combine an entire roadmap phase when the phase can be reviewed as smaller complete slices.

## When To Create A New Branch

Create a new branch when:

- Starting a new roadmap work package.
- Beginning a database migration.
- Changing a department workflow.
- Fixing a production defect.
- Updating deployment or recovery automation.
- Making a documentation change tied to an implementation decision.

Continue on the existing branch only when the new work is required to satisfy that branch's original acceptance criteria. Unrelated improvements belong in a new branch.

## Commit Rules

- Make focused commits that leave the branch understandable and testable.
- Use imperative subjects such as `Add submission outbox migration` or `Move PL workspaces to server`.
- Never commit `.env`, tokens, passwords, database dumps, production exports, or employee-sensitive logs.
- Include migrations, tests, documentation, and changelog updates with the behavior they support.
- Update `Memory.md` in the same branch and commit with current status, validation, deployment state, and next action.
- Do not mix formatting-only changes with functional changes unless required by the edited code.

Before committing:

```powershell
git status --short
git diff --check
git diff
```

## Pull Request Requirements

Every planned production change should use a pull request containing:

- Roadmap phase and work package.
- Problem and implementation summary.
- Files and departments affected.
- Database migration details.
- Smartsheet schema or mapping impact.
- Automated test results.
- Manual test results and screenshots for visible changes.
- Security and data-integrity considerations.
- Deployment steps.
- Rollback steps.
- Known limitations or follow-up work.

Large branches should open as draft pull requests early. A draft may receive feedback but is not eligible to merge.

## Required Checks Before Merge

- Branch is current with `main` and conflicts are resolved intentionally.
- Automated test suite passes.
- Migration applies successfully to a clean test database.
- Migration compatibility with the currently deployed application is documented.
- Department-specific manual tests pass.
- Timeout, retry, and duplicate scenarios pass when submission behavior changes.
- No secrets or production data are present in the diff.
- Documentation and changelog are updated.
- Required business and technical approval is recorded.

## When To Merge

Merge only when the work package is complete and all acceptance criteria are proven. Do not merge code merely because development is paused or because most of the feature works.

Preferred merge policy:

- Use a pull request merge commit for major work packages where preserving branch context is useful.
- Squash small corrective branches when intermediate commits add no useful history.
- Delete the remote working branch after merge.
- Never force-push `main`.

## Database Migration Merge Rules

- Every schema change uses a new versioned migration.
- A migration merged to `main` must be safe for the documented deployment order.
- Prefer expand-and-contract changes: add compatible schema first, deploy code using it, then remove old schema in a later release.
- Never edit or renumber a migration already applied to production.
- Destructive migrations require a verified backup, explicit approval, and tested rollback or forward-repair plan.

## Release And Deployment Flow

1. Merge approved pull requests into `main`.
2. Confirm CI passes on the merge commit.
3. Create an annotated release tag such as `v1.3.0`.
4. Record release notes and deployment instructions.
5. Back up the production database before migrations.
6. Pull the exact approved commit or tag on the server.
7. Install locked dependencies when changed.
8. Apply migrations.
9. Restart the application and worker through PM2.
10. Run health checks and department smoke tests.
11. Monitor logs, queue depth, and synchronization failures.
12. Record who deployed, when, which commit, and the result.

Do not deploy an uncommitted server working tree or a commit that exists only locally.

## Rollback Rules

- Application rollback returns to the previously approved tag or commit.
- Database rollback follows the migration-specific plan; do not assume application rollback automatically reverses schema changes.
- Prefer forward repair when data has already been written using the new schema.
- Keep compatibility with the previous application version through the release observation window whenever practical.
- Record the reason, decision owner, commands used, and resulting system state.

## Hotfix Workflow

Use a hotfix only for an active production incident involving data integrity, availability, security, or a blocked production workflow.

1. Create `codex/hotfix-<description>` from current production `main`.
2. Make the smallest safe correction.
3. Add a regression test when feasible.
4. Perform focused review and validation.
5. Merge through a pull request, or document why emergency approval was used.
6. Tag and deploy the corrected `main` commit.
7. Complete the missing documentation or broader test work immediately after service is restored.

Hotfixes must not remain only on the production server. The GitHub history must match production.

## Branch Completion Checklist

- [ ] Acceptance criteria satisfied.
- [ ] Automated and manual tests recorded.
- [ ] Database and Smartsheet impacts documented.
- [ ] Changelog updated when production-facing.
- [ ] Deployment and rollback steps verified.
- [ ] `Memory.md` updated for the completed work and next action.
- [ ] Pull request approved.
- [ ] Merge commit or squash commit identified.
- [ ] Production tag created when released.
- [ ] Working branch deleted after merge.
