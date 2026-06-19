# Test And Acceptance Plan

## Test Strategy

Testing must prove behavior under failure, not only the happy path. Every submission path is tested across browser, API, database, worker, and Smartsheet boundaries.

## Automated Test Layers

### Unit Tests

- Field validation and normalization.
- Department calculations.
- Submission ID handling.
- Retry classification and backoff.
- Smartsheet payload mapping.
- Workspace ownership and sign-out rules.

### Database Tests

- Migrations on an empty database.
- Unique submission constraint.
- Submission and outbox atomic transaction.
- Worker leasing and expired lease recovery.
- Audit records for administrative actions.
- Compatibility with the previous application release where required.

### API Integration Tests

- Authentication and authorization.
- Create and replay identical submission IDs.
- Validation response details.
- Concurrent duplicate requests.
- Workspace version conflicts.
- Supervisor retry and resolution authorization.

### Worker Integration Tests

- Successful Smartsheet delivery.
- HTTP timeout after remote acceptance.
- Rate limiting.
- Temporary and permanent API errors.
- Process restart during delivery.
- Existing remote submission ID detection.
- Transition to `needs_review` after configured failures.

### Browser Tests

- Department routing after login.
- Required-field validation.
- Multiple clicks on Submit.
- Refresh before and after submission.
- Retry after timeout.
- Shared-workstation associate switching.
- Sign-out blocking and successful sign-out.
- Tablet and desktop viewport layout.

## Required Failure Scenarios

Every department must pass these scenarios before cutover:

| Scenario | Expected Result |
| --- | --- |
| Browser loses response after database commit | Retry returns existing submission; no duplicate |
| Smartsheet is offline | Database save succeeds; status remains pending |
| Worker restarts | Pending outbox work resumes |
| Server restarts after database commit | Submission remains safe and queryable |
| Submit is clicked repeatedly | One logical submission is created |
| Two tabs edit one workspace | Stale update is rejected or explicitly resolved |
| Associate A leaves open work | Associate B cannot inherit or submit it |
| Smartsheet accepts but response times out | Worker finds submission ID before retrying insert |
| Database is unavailable | Portal clearly reports that work was not saved |
| Validation fails | Specific fields and corrections are shown |

## Test Data Rules

- Automated tests use generated associates, lots, items, and submission IDs.
- Production credentials and sheets are not used by automated tests.
- Test records are visibly marked and removable through documented cleanup.
- Employee-sensitive production data is not copied into fixtures.

## User Acceptance Testing

Each department uses a written script covering its normal daily workflow and known edge cases. UAT requires:

- At least one associate representative.
- Department lead or supervisor.
- Technical observer.
- Test date, release commit, device, browser, and result.
- Screenshots or record IDs for failures.
- Written approval or a list of blocking defects.

## Severity

- **Critical:** data loss, duplicate production records, security exposure, or unusable department workflow.
- **High:** wrong calculations, cross-associate data, failed recovery, or common workflow blocked.
- **Medium:** workaround exists but behavior is confusing or inefficient.
- **Low:** cosmetic or minor usability issue with no data impact.

No critical or high defect may remain open at production cutover.

## Release Evidence

Attach or link the following to the pull request or release record:

- Automated test output.
- Migration test result.
- Browser test result.
- Failure-injection result.
- UAT sign-off.
- Smartsheet reconciliation result.
- Backup confirmation.
- Deployment and rollback checklist.

