# Administrative user editing

Verified against the available backend checkout `../M-Team` at `5acc4f9`:

- `docs/documento-de-alcance.md`: ADM-02, ADM-04, ADM-05, ADM-06, USR-04, SOC-01, ENT-02.
- `backend/docs/openapi.yaml`: UpdateUserRequest, UpdateUserStatusRequest, ResetPasswordResponse.
- `backend/src/validator/admin-user-validator.ts`: strict payloads, required values, lengths, date validation and branch limit.
- `backend/src/service/admin-user-service.ts`: role restrictions, duplicate document/email conflicts and administrator identity.
- `backend/src/repository/user-repository.ts`: updates and audit entries persisted together.
- `backend/src/route/admin-user-route.ts`: administrator authorization for every administrative operation.

## Supported operations

| Operation | API | Frontend behavior |
| --- | --- | --- |
| Edit general data, all roles | PATCH /users/:id | First name, last name, document, birth date, email, phone; optional audit reason (500 characters). |
| Edit member profile | Same PATCH | Emergency contact name and phone; empty values may clear the contact. |
| Edit trainer profile | Same PATCH | Specialty and description, both nonempty. |
| Assign trainer branches | PUT /users/:id/trainer-branches | Independent save, maximum 50 selections. Loads all branch pages and preserves existing assignments. Keeps unsaved personal edits. |
| Activate/deactivate/reactivate | PATCH /users/:id/status | Separate confirmation dialog with optional reason. Does not edit membership or medical data. |
| Reset password | POST /users/:id/password-resets | Separate action; server generates temporary password requiring change on next login. Current password is never fetched or edited. |
| Consult history | GET /users/:id/audit-logs | Read-only latest 10 entries; refreshes after successful operations. Displays actor, timestamp and reason. |

Role and status are context, never included in the personal-data payload. Administrators have no invented profile fields. Payments, membership and medical certificates remain consultation data in this form; assigned classes remain read-only. Existing navigation and route permissions are preserved.

## API limitations and pending scope

- ENT-02 photography cannot be completed administratively: the API exposes only PUT /users/me/photo, authenticated as the photo owner. No administrative upload operation or photoUrl update exists. Existing photographs remain visible in the detail; no endpoint was invented.
- ADM-04 audit persistence and USR-04 password-change enforcement are backend responsibilities. The frontend calls the existing operations and refreshes the consultation history; it does not fabricate audit actors or timestamps.
- Browser and component tests use API fixtures. The backend source and contract were inspected, but these tests do not prove connectivity to a deployed backend or real database persistence.

## Verification

- Component tests: all three roles and exact payloads, required values, email/document/date validation, duplicate conflicts, retry, branch errors and independent persistence, password reset errors/success, status confirmation/rejection, audit refresh and duplicate-submit protection.
- Playwright: administrative trainer editing at 1440, 390 and 320 pixels, actual save interaction, horizontal overflow, console health and screenshots saved in the system temporary directory.
- Project checks: ESLint, TypeScript project build, Vite production build and git diff --check.

Final results: 28 component tests passed across the three related test files; 3 Playwright tests passed. ESLint, `tsc -b`, production build and `git diff --check` passed. Related Vitest tests were run with `--maxWorkers=1 --testTimeout=15000` after timeouts under concurrent Windows workloads. Vite retained its large-bundle warning (approximately 945 kB minified). Initial sandbox executions failed with `spawn EPERM`; the final test/build/browser runs succeeded with approved process permissions. Browser plugin was unavailable, so the project Playwright workflow used Edge at `http://127.0.0.1:4173` with fixture API responses.
