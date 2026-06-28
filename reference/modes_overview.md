# FreeSurfer recon-all: Modes Overview & Decision Tree

This document explains how the three execution modes (one-shot, three-stage,
single-step) relate to each other and how to choose between them. For
specific commands, see `recon_all.md`, `three_stages.md`, `all_31_steps.md`,
and `command_mapping.md`.

**FreeSurfer version:** 7.x

---

## The three modes are nested, not parallel

```
Level 1: recon-all -all                  (one command, full pipeline)
     ↓ unfolds to
Level 2: -autorecon1, -autorecon2,       (three stages, can stop between)
         -autorecon3, plus sub-stages
     ↓ unfolds to
Level 3: 31 single-step flags            (finest granularity, one step at a time)
```

A user does not pick one mode and stay in it. They pick a starting mode and
**switch granularity as the situation demands**. The most common pattern:

> Start at Level 1 (default `-all`), drop to Level 2 when QC checkpoints are
> needed, drop to Level 3 when something fails or needs editing.

---

## Mode comparison

| Aspect | Level 1 (`-all`) | Level 2 (3 stages) | Level 3 (31 steps) |
|---|---|---|---|
| Command count | 1 | 3-4 | up to 31 |
| QC checkpoints | None mid-pipeline | 4 standard QC nodes | Anywhere |
| Total runtime | Same as sum of stages | Same + QC pause time | Same + QC pause time |
| Flexibility | Low | Medium | High |
| Cognitive load | Low | Medium | High |
| Best for | Trusted inputs, batches | Standard research workflow | Debugging, edits, custom |

Runtime is the same across modes for a clean run — splitting into stages
or steps adds no compute overhead. The cost of finer granularity is only
the human attention required between invocations.

---

## Decision tree

```
START: User wants to run FreeSurfer on a T1
  │
  ├─ Is this a fresh subject (no existing output)?
  │    ├─ YES, AND user wants standard processing
  │    │     → Default to Level 2 with 4 QC checkpoints
  │    │       (workflows/default.md)
  │    │
  │    ├─ YES, AND user explicitly says "just run it" / batch mode
  │    │     → Level 1: recon-all -all
  │    │       (workflows/batch.md if multiple subjects)
  │    │
  │    └─ YES, AND user wants to learn/debug
  │          → Level 3: step-by-step
  │            (workflows/single_step.md)
  │
  └─ Existing output present?
       │
       ├─ Pipeline crashed mid-run
       │    → workflows/resume.md
       │      Diagnose from recon-all-status.log, resume with -make all
       │      or specific stage flag
       │
       ├─ Pipeline finished, user wants to edit and re-run
       │    → editing/<target>_edit.md for the edit
       │      Then resume flag from command_mapping.md
       │
       ├─ User wants to add an analysis (e.g., extra atlas)
       │    → Level 3 single-step (e.g., -cortparc2 -parcstats2)
       │
       └─ User wants to re-do everything
            → Delete subject dir, then Level 1 or Level 2
```

---

## When each mode wins

### Level 1 (`-all`) wins when:

- Input quality is known to be good (verified scanner protocol, prior cohort)
- Batch processing many subjects unattended (overnight, cluster jobs)
- Re-running a previously-validated subject after software update
- User has no time/expertise to QC mid-pipeline

**Trade-off:** If anything goes wrong, you discover it 6+ hours later.

### Level 2 (3 stages with QC) wins when:

- Standard research workflow on a new subject or new cohort
- Input quality is uncertain (clinical scans, archival data, varied protocols)
- Subject-level QC is required by the study protocol
- The cost of a bad reconstruction (statistical analysis on bad data) is
  high relative to QC time

**Trade-off:** Requires human attention at 4 checkpoints over the run.

### Level 3 (single steps) wins when:

- A specific step failed and you need to debug
- You're editing intermediate files (wm.mgz, brainmask.mgz, etc.) and
  need to re-run only the affected steps
- You're substituting a custom algorithm for one step (e.g., SynthStrip
  for skull strip)
- You're learning what each step does
- You only need part of the pipeline (e.g., autorecon1 + skull strip
  outputs for a different downstream tool)

**Trade-off:** Easy to forget a downstream dependency and end up with
inconsistent state.

---

## How modes mix in practice

Real workflows almost always span multiple levels. Examples:

### Standard research workflow (Level 1 → Level 2 → Level 3)
```bash
# Start with autorecon1 (Level 2)
recon-all -s subj01 -i T1.nii.gz -autorecon1
# QC1 fails → edit brainmask.mgz manually (Level 3 territory)

# Resume autorecon2 partial (Level 2)
recon-all -s subj01 -autorecon2-volonly
# QC2 OK

# Continue (Level 2)
recon-all -s subj01 -autorecon2-wm
# QC3 fails → edit wm.mgz (Level 3 territory)

# Re-run from edit (Level 2 sub-stage)
recon-all -s subj01 -autorecon2-wm

# Finish (Level 2)
recon-all -s subj01 -autorecon3
# QC4 OK → done
```

### Batch processing with selective QC (Level 1 → Level 3 spot-check)
```bash
# Run all subjects in parallel (Level 1)
for s in subj01 subj02 subj03 ...; do
  recon-all -s $s -i ${s}_T1.nii.gz -all &
done
wait

# Spot-check QC4 on all subjects (Level 3 visual)
# For any subject with bad pial:
recon-all -s subjXX -pial -autorecon3   # after editing brain.finalsurfs.mgz
```

### Failure recovery (Level 1 → Level 2 → Level 1)
```bash
recon-all -s subj01 -i T1.nii.gz -all
# Crashes during step 8 (CA register)

# Diagnose: recon-all-status.log shows crash in -careg
# Fix root cause (e.g., disk space, atlas file corruption)

# Resume from where it stopped
recon-all -s subj01 -make all
# Continues from -careg onward
```

---

## Mode-switching triggers

The agent should drop from Level 1 to Level 2 (or 2 to 3) when any of
these conditions appear:

| Trigger | Drop to | Action |
|---|---|---|
| User says "QC each stage" | Level 2 | Run autorecon1/2/3 sequentially with QC pauses |
| User says "I want to see X intermediate file" | Level 2 or 3 | Stop at the stage that produces it |
| User says "edit Y file" | Level 3 | Run only the steps needed to regenerate downstream outputs |
| Pipeline crashed | Level 2 or 3 | Diagnose stage and re-enter at the right granularity |
| User says "just step N" | Level 3 | Single-step flag |
| User says "explain what happens" | Level 3 mental model | Read all_31_steps.md to user |

---

## Mental model for the agent

The agent should think of mode selection as a **two-axis decision**:

**Axis 1 — Trust in input/process**

```
Low trust ─────────────────────────► High trust
  Level 3                              Level 1
  (per-step inspection)                (-all, fire-and-forget)
```

**Axis 2 — Recovery state**

```
Fresh start ──────────────────────► Mid-pipeline edit/recover
  Level 1 or 2                        Level 2 or 3 sub-flag
```

Default starting position: **Level 2 with 4 QC checkpoints** (medium trust,
fresh start). This is the workflow described in `workflows/default.md`.

Move to Level 1 only when the user explicitly indicates trust ("just run
it", "batch mode") or when running unattended overnight.

Move to Level 3 only when the user is editing, debugging, or learning,
or when a specific step has failed.

---

## Anti-patterns

**Don't mix modes haphazardly.** If the user asks for QC checkpoints,
commit to Level 2 throughout. Don't run autorecon1, then jump to `-all`
for the rest — that defeats the QC plan.

**Don't run single-step flags without checking dependencies.** The 31
steps form a strict DAG. Running `-pial` without first having
`?h.aparc.annot` (from step 28) will fail. The agent should consult
`all_31_steps.md` for input requirements before any Level 3 invocation.

**Don't QC after every single step.** The 4 QC checkpoints are chosen
because they correspond to the 4 most error-prone outputs. Adding more
QC adds friction without catching more problems.

**Don't skip QC entirely on unfamiliar data.** New cohort, new scanner,
new pulse sequence — these warrant Level 2 even when the user says
"just run it." The agent can suggest the trade-off.
