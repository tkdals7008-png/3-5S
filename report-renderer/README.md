# Automatic full report — deployment pending

This branch is not ready for production until the renderer has been deployed and a real browser/PDF acceptance check has passed. Existing production remains unchanged.

The renderer opens the same administrator report, selects the inspection date and daily report mode, and calls the same image/PDF builder used by manual mail. Browser POST requests are blocked. Recipient email addresses are never sent to the renderer. An incomplete photo load fails the render. Apps Script sends the existing rich email format and only records successful completion after attachment checks. A new completion marker permits the full report after an older list-only email.

## Required deployment

An authorized Google Cloud project with billing and Cloud Run/Artifact Registry access is required. No such project credentials are currently connected.

1. Build from repository root with `docker build -f report-renderer/Dockerfile -t IMAGE .` and push to the project's Artifact Registry.
2. Deploy IMAGE to Cloud Run with memory at least 2 GiB, concurrency 1, request timeout 240 seconds. Configure `MM_RENDER_TOKEN` from Secret Manager with a random token of at least 32 characters. The endpoint may be publicly reachable but every render request requires this token. Do not place the token in source, command history, report records, or logs.
3. Set Apps Script properties `MM_REPORT_RENDER_URL` to the HTTPS service URL plus `/render`, and `MM_REPORT_RENDER_TOKEN` to the same secret. Authorize the new external-request scope before deploying Apps Script.
4. Validate a synthetic report first: Korean text, all photos, full inline image, every PDF page, exact match with manual report. Then verify a real date with administrator approval. Do not store business snapshots or reports in this public repository or public Actions artifacts.
5. Merge/deploy only after these checks. Check sent mail includes the PDF and body image. The old list-only marker is intentionally ignored, so the first check may send today's full report to all active configured recipients.

Run `node --test report-renderer/test.mjs` for scheduling/retry checks. Actual browser/PDF visual verification remains required; local Chromium installation failed in this workspace. No report generation has been visually verified yet.

## Current limits

Monday public holiday shifting is separate unfinished work and is not implemented by this branch. Mail batch delivery is not transactional: if a later batch fails, an earlier batch can receive a duplicate on retry (existing manual delivery limitation). Renderer credentials, production connection, and actual email delivery are not completed by committing this branch.
