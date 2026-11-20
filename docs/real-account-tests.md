# Real-account tests

These were not run. There was no eligible Duet or dot account in this session. Do not paste passwords or tokens into chat. Sign in on the provider’s own site and keep credentials there.

Record the date, what you saw, and cleanup. A failed or skipped check is not a pass.

## 1. Claude Duet, one low-risk task

Do this only after an eligible US Pro, Max, or Ultra account has Duet access.

1. Start Roster Lab on the Mac (`npm run dev`).
2. Create a company, a project, and one employee. Set the provider to Claude Duet. Allow that project. Create a connector credential and store it somewhere private. The app will not show it again.
3. Create a task whose brief only asks for a sentence of text. Assign it and queue it. Expected in Roster Lab: the task is Queued, and the timeline says no provider was notified by the queue action alone.
4. Only if you have confirmed from current Anthropic docs that Duet itself can call a custom remote MCP connector, expose an authenticated HTTPS endpoint as described in `docs/hosting.md` and add that connector on the Claude account. Ask Duet, in its own app, to claim the assigned task and report a result. Do not ask it to send email, pay, or delete anything.
5. Expected only if that connector path works: the same task in Roster Lab shows a result whose label is `mcp_client`, the timeline names the MCP client, and the computer line stays “Not connected” or “Connected, isolation unverified”. It must not say the computer was verified.
6. Actual result on 2026-11-20: **not run**.
7. Cleanup: revoke the credential in Roster Lab and remove the connector in Claude settings.

If Duet cannot see the connector, stop. That is a blocker, not a reason to automate a Claude login.

## 2. Two Duets, two computers

Do not start this unless Anthropic documents a permitted way to have two Duet agents and Harry has authorized both.

For each pair, record:

1. Evidence they are two agent instances, not two channels. Channels share memory, according to the Duet help article read on 2026-11-20.
2. Evidence of two computers from the provider, not two labels in Roster Lab.
3. A harmless random marker written in one private workspace and the attempt to read it from the other without sharing it. Write down the method and what could not be seen.
4. A check that a session, mount, or connector did not leak the marker.
5. Time, source, scope, and whether the note is a provider assertion or something you observed.

Enter that record in the employee’s “Record an isolation check” form. The badge will say Roster Lab did not run the check.

Actual result on 2026-11-20: **not run**. No second Duet was available, and no creation API was found.

## 3. One dot

After a ChatGPT account that actually has a dot:

1. Create a separate employee, provider “OpenAI dot”, and a task with no external write.
2. OpenAI’s documented plugin sign-in is OAuth, or no authentication. This server requires a bearer and does not implement OAuth. Unless the current plugin form accepts the bearer header, the dot cannot complete this path. Do not turn off authentication.
3. If a future build adds the documented OAuth path, subscribe the dot to `task.queued` and queue one task. Expected: a dot run starts and a result returns on that task. Known public bug reports say a dot run may start without the event payload. If that happens, record it as a failed or partial test.
4. Actual result on 2026-11-20: **not run**.

## 4. Two dots, two computers

Same five checks as the Duet pair, using dots. Actual result on 2026-11-20: **not run**. The computers-and-apps article describes one dot’s cloud computer plus computers you connect. It does not document this app creating a second dot.
