# PC automatic full report (no Cloud Run deployment)

Uses the administrator's existing browser on an always-on company PC. No paid cloud renderer, Docker service or new external-request permission is needed. This is not configured on the user's PC yet.

After deploying:
1. Open Apps Script, select `setupMyMachinePCReport`, and run once. Copy its connection key from the execution log; keep it private and do not send it in chat.
2. Open the existing `admin.html` address with `?autoReport=pc` appended.
3. Enter the key into the PC automatic report panel and click 자동 발송 시작.
4. Leave this window open and preferably visible, with the PC awake and online. Closing/reloading the page stops automatic checking; reopen and start again. Background browser throttling, sleep or network loss may delay delivery. The key is kept only in page memory, not saved in local storage or URLs.

Every 10 seconds after the prior check finishes, this page asks for completion. After all assigned machines are registered (including substitute inspectors), it renders the same daily administrator report with the shared manual image/PDF builder. Any failed photo load aborts the capture. Recipient selection stays on the server. A locked send rechecks the latest record/settings/recipient revision and completion marker before delivery. Successful delivery records the new full-report marker; older list-only mail does not suppress the full report. No public business report or snapshot is committed.

The existing automatic missing reminders continue. Once registration is complete they stop and wait for the PC report instead of sending the old participant list. Completion before 09:00 is supported. Detection has a polling delay of approximately 10 seconds plus rendering time, longer if the browser is throttled. This is not an instantaneous server push.

Validation: `node --test report-renderer/test.mjs`. Actual browser image/PDF visual verification and real email delivery are still required. Local Chromium installation failed; no visual acceptance claimed. Monday holiday shifting remains separate unfinished work. Mail batch sending retains the existing partial-delivery retry limitation.
