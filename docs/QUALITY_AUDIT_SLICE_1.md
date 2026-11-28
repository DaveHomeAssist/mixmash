# Quality audit, slice 1: Pitch Riot (plan only)

Status: plan, not run. Nothing here has been executed. Running it waits on a
go ahead after the reporting pilot is merged.

## Why Pitch Riot

The same game as the reporting pilot, so the first player reports and the first
audit findings can be compared row for row in one backlog. It is one page with
no server, it has a `?debug` hook (`window.__pitch`) that can drive a match
without playing it by hand, and nobody else is changing it right now.

## What the audit checks

Each check has an id. A finding names the check it came from.

| Id | Check | How | Fails when |
| --- | --- | --- | --- |
| PITCH-LOAD | Clean load | Open `/pitch/` in Chromium and WebKit, record console errors, failed and 4xx/5xx same origin requests | Any error or failed request |
| PITCH-FLOW | Full match flow | Menu, kickoff, first half, halftime show, second half, full time, rematch, quit to menu, driven through `window.__pitch` | A state is skipped, repeats, or the score or clock is wrong after a transition |
| PITCH-PAUSE | Pause and resume | `P`, `Escape`, the pause pill, Resume and Quit, in play and at halftime | Play continues while paused, or a key double toggles |
| PITCH-KEYS | Keyboard map | Every key in `KEYMAP` moves, sprints or shoots; keys release on blur | A key sticks, or the page scrolls on Space or arrows |
| PITCH-TOUCH | Touch play | 390x844 and 844x390 with touch emulation: stick, Sprint, Shoot, pause pill | A control is missing, under 44 px, or does nothing |
| PITCH-LAYOUT | Layout | 390x844, 768x1024, 1280x800, 1920x1080: no horizontal scroll, overlays fit, text not clipped | Overflow, clipping or overlap |
| PITCH-A11Y | Overlay access | Focus order and visible focus in menu, pause, full time and the report form; buttons have names; contrast of overlay text | Focus lost or trapped, unnamed control, contrast under 4.5:1 |
| PITCH-AUDIO | Audio and mute | Mute toggles and persists across reload; music resumes in place after unmute | State lost on reload, or sound while muted |
| PITCH-PREFS | Stored audio settings | The saved audio settings (the only thing Pitch Riot stores) survive reload; a corrupt or missing stored value falls back to defaults without errors | Error, or broken audio settings after a bad value |
| PITCH-PWA | Offline | After one online visit, reload offline with the service worker on | Page fails to load offline |
| PITCH-PERF | Frame time | 30 seconds of simulated play at 1280x800, median and 95th percentile frame time | 95th percentile over 33 ms on the CI box |
| PITCH-REPORT | Report form | The pilot's own acceptance list in `docs/QUALITY_REPORTING.md` | Any item fails |

Out of scope for slice 1: game balance, art direction, other games, real
devices (emulation only, said so on every finding), and anything that needs
the live Worker.

## How findings enter the backlog

Findings use the same contract as player reports, so triage sees one shape.

1. The audit run writes `findings.json`: one object per finding, built and
   checked with `validateReport()` from `src/kit/report-schema.mjs`, with
   `source: "claude-audit"` (or `codex-audit`, `manual-test`).
2. Field use:
   - `summary`: the problem in one sentence, starting with the check id, for example `PITCH-TOUCH: shoot button is 36 px tall at 390x844`.
   - `steps`: exact repro steps, viewport and browser.
   - `impact`: `blocks` when a player cannot continue, `hurts` when play is worse, `minor` otherwise. This sets Severity.
   - `category`: the matching area (`touch`, `controls`, and so on). This sets Area.
   - `revision`: the commit the audit ran against.
   - `context.device`: the emulated browser and device, marked emulated.
   - `reportId`: a stable id made from game, check id and a short description, so a rerun on the same problem matches the existing row instead of adding a duplicate.
3. Rows are written with `toNotionProperties()` so the mapping is the one the
   Worker uses. Filing goes through the Notion connector in a session that is
   allowed to write to the backlog, not through the public Worker, which
   refuses audit sources by design.
4. Screenshots are attached to the Notion row as files. The Screenshot field is
   used only for an https link.
5. The run summary (checks run, passed, failed, skipped, revision) goes in the
   pull request or session log, not in the backlog.

## Done when

- Every check above has run once against one named commit, or is listed as skipped with the reason.
- Every failure is one backlog row with Source set to the audit source and Game **Pitch Riot**.
- A rerun files no duplicate rows.
- The checks that can run unattended are proposed as a smoke for CI, as a separate change.
