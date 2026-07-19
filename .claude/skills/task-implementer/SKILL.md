---
name: task-implementer
description: "Implements one user story end to end from its spec directory (docs/specs/NNN-story-slug/) produced by the requirements-elicitation skill, inside a repo governed by the command-contract harness (just check / just test). Invoke with the story number or slug: /task-implementer 001. Acts as an orchestrator: implements Task 000 (contracts) and STOPS for mandatory human review, then dispatches each remaining task in ascending numeric order to a clean-context subagent that works test-first from the embedded Gherkin scenarios until just check and just test are green in the module. Halts the run on the first blocked task. NEVER commits — the user commits manually. Ends by writing a consolidated handoff report for the whole story. Language-agnostic — speaks only the harness verb vocabulary, never a specific toolchain. Do NOT use for writing specs, requirements, or task decomposition (use requirements-elicitation), and NOT for code review (a separate reviewer consumes this skill's output)."
argument-hint: user-story-number-or-slug
disable-model-invocation: true
---

# Task Implementer Skill

Implements **one user story end to end** from the spec directory produced by the
`requirements-elicitation` skill, inside a repository governed by the command-contract
harness. The main session acts as an **orchestrator**: it never implements tasks itself —
it dispatches each task, in order, to a subagent with a clean context, verifies the result,
and moves on. Human supervision happens at exactly two points inside this skill: the Task 000
contracts review, and the consolidated handoff at the end. Everything in between is autonomous.

This skill is a **guide**: it carries the process. Verification belongs to the harness
**sensors** (`just check`, `just test`, post-edit hook, architecture rules) — this skill
never re-implements them and never works around them.

**Language**: All output artifacts are in English.

---

## Invocation and Resolution

Invoked explicitly by the user (never auto-triggered):

```
/task-implementer 001
/task-implementer appointment-reminders
```

`$ARGUMENTS` is a single unparsed string containing the story number or slug. Resolution:

1. Glob `docs/specs/NNN-*/` matching the number, or `docs/specs/*-<slug>*/` matching the slug
2. Exactly one directory must match — zero or multiple matches: stop and ask
3. The directory must contain `overview.md`, `000-task-contracts.md`, and at least one
   `NNN-task-*.md` — anything missing: stop and report the spec gap

---

## Harness Prerequisites

1. A `Justfile` in the target module exposing at least the verbs `check` and `test`
2. A root `CLAUDE.md` declaring the definition of done
3. A module `CLAUDE.md` with the architecture decision tree and a pointer to the module's exemplar
4. A post-edit hook that runs the scoped `check` and returns errors automatically
5. The ability to dispatch subagents with an isolated context

If any prerequisite is missing, report it and stop. Do not emulate missing harness pieces
ad hoc (e.g., calling the toolchain directly because the Justfile lacks a verb) — that
silently forks the contract between agent and CI.

**Verb vocabulary rule** (binds orchestrator AND subagents): all quality commands go through
`just` verbs. Never invoke linters, compilers, or test runners directly. A missing verb is a
harness gap to report, not to bypass.

---

## Orchestrator Flow

### Step 1 — Load and validate the story

1. Read `overview.md` in full — it is the only story-level context the orchestrator holds
2. Cross-check the Task Index against the files on disk: every indexed task exists, every
   task file is indexed. Mismatch → stop and report
3. Sanity-check the dependency graph against the numbering: if executing in ascending order
   would violate a declared dependency, that is a spec defect → stop and report (never
   reorder on your own)

### Step 2 — Task 000: contracts, then MANDATORY human review

1. Dispatch Task 000 to a subagent (inputs and cycle defined below). Contracts only, zero
   behavior; `just check` green is its definition of done
2. When the subagent returns, present its report and **STOP**. Tell the user the contracts
   are ready for review and wait for explicit approval
3. This stop is unconditional — it applies even when Task 000 declares "no contract changes";
   the declaration itself is what the human verifies
4. Only proceed after explicit approval. Requested changes → re-dispatch Task 000 with the
   feedback, then stop for review again

### Step 3 — Execute remaining tasks in ascending numeric order

For each task `001, 002, ...`:

1. Dispatch to a **fresh subagent with a clean context** — never reuse a previous task's
   subagent, never implement in the orchestrator session. Clean context per task is the point
   of the per-task spec design: no accumulation of prior tasks' reasoning and rationalizations
2. The subagent receives exactly: the path to `overview.md`, the path to its own
   `NNN-task-*.md`, and the module's location. **Nothing else from `docs/specs/`**
3. When the subagent returns, the orchestrator independently verifies: run `just check` and
   `just test` in the affected module(s). A subagent report claiming green is not proof —
   the orchestrator's own run is
4. Verification passes → record the per-task report, proceed to the next task
5. Verification fails or the subagent returns `blocked` → **halt the entire run**
   (stop-on-first-blocker policy). Do not attempt other tasks, even independent ones —
   proceed to Step 4 and report

### Step 4 — Consolidated handoff

Always executed — after the last task or after a halt. Write `handoff.md` in the story's
spec directory (template below), present a short summary to the user, and end. The
consolidated handoff is the input for the review step and for the user's manual QA.

---

## Per-Task Subagent Cycle

Every subagent runs this full cycle for its single task. The orchestrator includes these
instructions in the dispatch.

### Phase 0 — Validation

1. Read `overview.md` and the task file — the complete reading contract; do not open other
   spec files
2. Task file missing required fields (Contract reference, Out of Scope, DoD, scenarios) →
   return `blocked` with the gap
3. Scenarios reference RF/DC IDs absent from the task's Covers and from `overview.md` →
   spec inconsistency, return `blocked`; never pick a side
4. For tasks other than 000: the Task 000 contracts this task references must exist in the
   code → otherwise return `blocked`; never invent contracts

### Phase 1 — Orientation

1. Read the target module's `CLAUDE.md`; locate and read the module's **exemplar** end to end
2. Map each Gherkin scenario in the task file to where its acceptance test will live
3. List the files the task will touch; if the plan already requires touching files declared
   Out of Scope, return `blocked` before writing anything
4. **Precedence**: exemplar over written documentation on conflict; report the conflict

### Phase 2 — Tests First

1. One automated acceptance test per Gherkin scenario in the task file. No scenario without a
   test; no test without a scenario or an explicit justification in the report
2. Test names carry the scenario name and its US/RF IDs (e.g.,
   `"US-001/RF-003: rejects duplicate reminder for the same appointment"`)
3. Use the concrete example values from the scenarios
4. Run `just test`: new tests must be **red for the right reason** — a behavioral failure.
   Compilation errors, broken imports, or fixture crashes are not a valid red; fix those
   first, then confirm behavioral red

### Phase 3 — Implementation

1. Implement the vertical slice following the exemplar's patterns
2. Iterate until `just check` and `just test` are green in the module; treat every post-edit
   hook error as immediate feedback
3. **Forbidden shortcuts to green** (each is a hard violation):
   - Disabling, suppressing, or inline-ignoring lint or architecture rules
   - Skipping, deleting, or commenting out failing tests
   - Weakening assertions or replacing real behavior with mocks so a test passes vacuously
   - Modifying Task 000 contracts because implementation would be easier with a different shape
4. If green is only reachable by changing a contract or the spec → return `blocked`; that is
   a spec/contract defect, not an implementation decision

### Phase 4 — Scope Self-Check

1. Diff the session against the task's declared scope; every touched file must be justified.
   Accidental out-of-scope changes: revert. Genuinely necessary ones: keep and flag as a
   **deviation** with justification
2. Confirm no conflict with the "Parallelizable with" declaration
3. Re-run `just check` and `just test` after any revert

### Phase 5 — Per-Task Report

Return the report to the orchestrator:

```markdown
## Task NNN — [Title]
- **Status**: complete | complete-with-deviations | blocked
- **Scenario coverage**: | Scenario | US/RF | Test | Result |
- **Files touched**: [file → in declared scope? → note]
- **Deviations / open questions**: ...
- **Blocked reason** (if blocked): what, where, what is needed to unblock
```

`blocked` is a valid outcome. Reporting a blocker early is success; forcing green around it
is failure.

---

## Consolidated Handoff (`handoff.md`)

Written by the orchestrator in `docs/specs/NNN-<story-slug>/handoff.md`:

```markdown
# US-NNN — Story Implementation Handoff

## Run Summary
- **Result**: story complete | halted at task NNN
- **Tasks executed**: 000 (reviewed & approved), 001, 002, ...
- **Orchestrator verification**: `just check` + `just test` green in [modules] after each task

## Aggregated Scenario Coverage
| Task | Scenario | US / RF | Test | Result |
|------|----------|---------|------|--------|

## Files Touched (whole story)
| File | Task(s) | In declared scope? |
|------|---------|--------------------|

## Deviations and Open Questions
(aggregated from per-task reports)

## Blocked (if halted)
Task, reason, what is needed to unblock. Remaining tasks not attempted: [list]

## Left for Manual QA
Behavior acceptance tests cannot cover (visual, UX, external-integration realism)

## Commit Guidance
No commits were made (by design — the user commits manually). The working tree contains the
full story implementation. Natural value boundaries, if useful: [suggestion]
```

---

## Inviolable Rules

1. **The orchestrator never implements; a subagent never orchestrates.** One fresh subagent
   per task, clean context, exactly two spec files as input
2. **NEVER run `git commit`, `git push`, or create PRs** — the user commits manually, and
   commits must reflect value deliveries, not task deliveries. This binds the orchestrator
   and every subagent, with no exceptions
3. **Task 000 review gate is unconditional** — no dependent task starts before explicit
   human approval, even when 000 declares no contract changes
4. **Ascending numeric order, no reordering** — numbering is topological by contract with the
   elicitation skill; a broken numbering is reported, not fixed locally
5. **First blocker halts the run** — no opportunistic continuation with independent tasks
6. **Task 000 contracts are read-only after approval** — a provisional contract with a bad
   name gets flagged, never renamed mid-story
7. **The spec is read-only** — wrong or ambiguous spec → blocked + report; never improvise
8. **Sensors are never evaded**; **only the verb vocabulary** is spoken; **the exemplar
   outranks the documentation**
9. **No `handoff.md`, no done** — the run always ends with the consolidated handoff, even
   when halted

---

## What This Skill Does NOT Do

- **Does not write or change specs, requirements, or task decompositions** — spec defects
  found during implementation are reported, not patched (`requirements-elicitation` owns them)
- **Does not make architectural decisions** — the module `CLAUDE.md` decision tree and the
  exemplar decide; when neither answers, the task blocks
- **Does not commit, push, or open PRs** — the user owns version control
- **Does not review its own work beyond the scope self-check** — review is a separate step
  that consumes the story diff and `handoff.md`
- **Does not parallelize tasks** — sequential by number in this version; parallel worktrees
  are a later harness stage
- **Does not decode or reinterpret the dependency graph** — it trusts the numbering and
  verifies consistency, nothing more

---

## Integration Contract

**Upstream** (`requirements-elicitation`): consumes `docs/specs/NNN-<story-slug>/` with
`overview.md`, `000-task-contracts.md`, and `NNN-task-*.md` files; relies on topological
numbering; uses `US-NNN` / `RF-XXX` / `DC-XXX` IDs verbatim in test names and reports.

**Downstream** (reviewer): the reviewer receives the story diff, the spec directory, and
`handoff.md`. The handoff templates above are a contract — changing their structure requires
updating the reviewer in the same commit.