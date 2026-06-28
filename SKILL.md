# FreeSurfer Skill

Run FreeSurfer's `recon-all` cortical reconstruction pipeline on T1
MRI data, with optional QC checkpoints and editing support.

**Version:** v1, FreeSurfer 7.x

---

## When to use this skill

Trigger this skill when the user asks to:

- Run FreeSurfer / `recon-all` / cortical reconstruction
- Process T1 MRI for cortical thickness, surface area, or volume
  measurements
- Generate cortical parcellations (Desikan-Killiany, Destrieux, DKT)
- Generate subcortical segmentation (aseg) from T1
- Recover from a failed FreeSurfer run
- Edit FreeSurfer intermediate files (brainmask.mgz, wm.mgz, etc.)
- QC FreeSurfer output
- **Subfield/subregion segmentation:** hippocampus, amygdala, brainstem,
  thalamic nuclei, limbic structures, SynthSeg whole-brain, SAMSEG
  multi-contrast
- **View images or surfaces in the web viewer** (FreeView Online) —
  inspect MGZ/NIfTI volumes and/or FreeSurfer surface meshes without
  running any processing

Do NOT trigger for: fMRI preprocessing (use fMRIPrep), diffusion
processing, lesion segmentation, or non-FreeSurfer pipelines.

---

## The three execution modes

FreeSurfer's `recon-all` can be run at three nested granularities:

| Level | Mode | When to use |
|---|---|---|
| 1 | `recon-all -all` (one command) | Trusted input, batch, fire-and-forget |
| 2 | `-autorecon1`, `-autorecon2*`, `-autorecon3` (3 stages) | Standard research workflow with QC |
| 3 | 31 single-step flags | Editing, debugging, custom processing |

These modes are **nested, not exclusive**. Real workflows mix levels:
start at Level 1, drop to Level 2 when QC checkpoints are needed, drop
to Level 3 when something fails or needs editing.

---

## Default behavior

**Default mode for a new subject: Level 2 with 4 QC checkpoints.**

Run `workflows/default.md` unless the user specifies otherwise. This
gives standard quality control without overwhelming the user.

**Drop to Level 1 (`-all`)** when:
- User says "just run it" / "no QC needed" / "batch mode"
- Processing many subjects (use `workflows/batch.md`)
- Re-running a previously-validated subject

**Drop to Level 3 (single step)** when:
- A specific step failed (use `workflows/resume.md`)
- User edited an intermediate file (use `editing/recon_edit.md` then resume)
- User wants to debug or learn one step
- Custom algorithm substitution

---

## The 4 QC nodes (core to this skill)

| QC | After step | Reviewing | File |
|---|---|---|---|
| **QC1** | 5 (skull strip) | `mri/brainmask.mgz` | auto-fix at `editing/brainmask_autofix.md`, or manual edit at `editing/recon_edit.md` |
| **QC2** | 14 (WM seg) | `mri/wm.mgz` | auto-fix at `editing/wm_autofix.md`, or manual edit at `editing/recon_edit.md` |
| **QC3** | 21 (white surface) | `surf/?h.white.preaparc` | usually fix at QC2 |
| **QC4** | 29 (pial surface) | `surf/?h.pial` | edit at `editing/recon_edit.md` |

**QC procedure (same at every node):**

1. Open the web viewer with the correct files for this node (see `qc/snapshot_commands.md`)
2. Give the user the viewer startup command and file-loading instructions
3. Relay the visual checklist for that node (from `qc/qc_checklist.md`)
4. Wait for user verdict: OK / edit / re-run / reject
5. Branch on verdict (resume command per node in `qc/qc_protocol.md`)

**The agent does NOT decide pass/fail.** The user decides. The agent's
job is to open the viewer with the right files, relay what to look for,
and execute the user's choice.

---

## Decision tree

```
User wants FreeSurfer processing
  │
  ├─ Fresh subject, standard workflow?
  │    → workflows/default.md (Level 2 + 4 QC nodes)
  │
  ├─ Fresh subject, "just run it"?
  │    → workflows/default.md without QC pauses (Level 1)
  │
  ├─ Many subjects?
  │    → workflows/batch.md
  │
  ├─ Pipeline crashed / interrupted?
  │    → workflows/resume.md (diagnose + resume)
  │
  ├─ Bad skull strip — fix it automatically (no painting)?
  │    → editing/brainmask_autofix.md (SynthStrip tightness ladder, user picks)
  │      └─ still unsatisfied after trying borders → manual touch-up in editing/recon_edit.md
  │
  ├─ Bad WM segmentation (wm.mgz holes/speckle) — fix automatically?
  │    → editing/wm_autofix.md (fill small holes + drop islands, user tunes thresholds)
  │      └─ still unsatisfied → manual touch-up in editing/recon_edit.md
  │
  ├─ Need to edit an intermediate file (manual brush)?
  │    → editing/recon_edit.md, then resume command
  │
  ├─ Want to annotate / mark regions?
  │    → editing/voxel_edit.md
  │
  ├─ Want to draw a binary ROI?
  │    → editing/roi_edit.md
  │
  ├─ Want to run only specific step(s)?
  │    → workflows/single_step.md
  │
  ├─ Want to run only subfield/subregion segmentation?
  │    (recon-all already done, just adding e.g. hippocampus)
  │    → subfields/overview.md → pick tool → run directly
  │
  ├─ Want a quick whole-brain segmentation without recon-all?
  │    → subfields/09_synthseg.md (or 10/11 variants)
  │
  ├─ Want to view images or surfaces in the web viewer?
  │    → workflows/view_freeview.md (no processing; just launch viewer)
  │
  └─ Want to understand a step?
       → reference/all_31_steps.md (read aloud relevant step)
```

---

## Skill structure

```
freesurfer/
├── SKILL.md                       (this file: entry + decision hub)
│
├── reference/                     (factual, command-level)
│   ├── recon_all.md               Level 1 (-all) one-shot
│   ├── three_stages.md            Level 2 (autorecon1/2/3)
│   ├── all_31_steps.md            Level 3 (every step + full commands)
│   ├── command_mapping.md         Speed-lookup mapping all 3 levels
│   └── modes_overview.md          How to mix levels (decision logic)
│
├── qc/                            (4-node QC protocol)
│   ├── qc_protocol.md             Full QC workflow at each node
│   ├── qc_checklist.md            What user should look for
│   └── snapshot_commands.md       freeview screenshot commands
│
├── editing/                       (edit procedures — automatic + manual web viewer)
│   ├── brainmask_autofix.md       Auto-fix skull strip via SynthStrip ladder (no painting)
│   ├── brainmask_autofix.py         (script for the above)
│   ├── wm_autofix.md              Auto-fix wm.mgz topology (fill small holes, drop islands)
│   ├── wm_autofix.py                (script for the above)
│   ├── recon_edit.md              Fix FreeSurfer intermediate files (brainmask, wm, finalsurfs)
│   ├── voxel_edit.md              Free-form voxel annotation for reference
│   └── roi_edit.md                Binary ROI drawing for demonstration
│
└── workflows/                     (task-level orchestration)
    ├── default.md                 Single subject + 4 QC (canonical)
    ├── resume.md                  Recover from crash
    ├── single_step.md             Run one step / re-run after edit
    ├── batch.md                   Many subjects (with/without QC)
    └── view_freeview.md           View images/surfaces in web viewer (no processing)

└── subfields/                     (12 subfield/subregion segmentation tools)
    ├── overview.md                Tool comparison + selection decision tree
    ├── 01_hippoamyg_t1.md         segmentHA_T1.sh
    ├── 02_hippoamyg_t2.md         segmentHA_T2.sh
    ├── 03_brainstem.md            segmentBS.sh
    ├── 04_thalamic_nuclei.md      segmentThalamicNuclei.sh
    ├── 05_subregions_thalamus.md  segment_subregions thalamus (Gen 2)
    ├── 06_subregions_brainstem.md segment_subregions brainstem (Gen 2)
    ├── 07_subregions_hippoamyg.md segment_subregions hippo-amygdala (Gen 2)
    ├── 08_sclimbic.md             mri_sclimbic_seg
    ├── 09_synthseg.md             mri_synthseg
    ├── 10_synthseg_robust.md      mri_synthseg --robust
    ├── 11_synthseg_parc.md        mri_synthseg --parc
    └── 12_samseg.md               samseg
```

---

## Opening dialogue (agent's first response)

When the user's intent is not already clear, the agent presents a
**two-level menu** using the `AskUserQuestion` tool (preferred — buttons
are easier to tap on mobile). Fall back to a numbered text list if the
tool is unavailable. Max 4 options per question.

### Level 1 — Top-level intent

```
Q: What do you want to do?
  Options:
    - Run FreeSurfer        (recon-all, subfields, crash recovery)
    - Open FreeView         (view or edit images / surfaces)
```

---

### Branch A — Run FreeSurfer

Ask Q1 + Q2 in one call. Ask Q3 only if not already known.

```
Q1: Processing scope
  - Single subject
  - Batch (multiple subjects)

Q2: Workflow mode
  - Standard (with 4 QC checkpoints)   ← default
  - Fast (recon-all -all, no QC)
  - Custom (specific steps / debug)

Q3: Subfield segmentation after recon-all?
  - No (recon-all only)                ← default
  - Yes (I'll specify which ones)
```

If Q3 = "Yes", follow up with plain text listing the 8 tools from
`subfields/overview.md` — do NOT put all 8 in buttons (max 4 per Q).

**Workflow routing after Branch A:**

| Q1 / Q2 / Q3 | Workflow |
|---|---|
| Single + Standard + None | `workflows/default.md` |
| Single + Standard + subfields | `workflows/default.md` → append `subfields/*` |
| Single + Fast + None | `recon-all -all` end-to-end |
| Single + Fast + subfields | `-all` then `subfields/*` |
| Single + Custom | `workflows/single_step.md` |
| Batch + any + any | `workflows/batch.md` |

---

### Branch B — Open FreeView

```
Q: What do you want to do in FreeView?
  - View (read-only, inspect files)
  - Edit (modify brainmask / wm / surfaces)
```

**If View:**

```
Q: How to specify files?
  - Folder mode   (give imaging dir and/or surface dir)
  - File mode     (list individual files; agent builds temp folder)
```

→ Go to `workflows/view_freeview.md`

**If Edit:**

```
Q: Which file type?
  - brainmask.mgz
  - wm.mgz
  - Surfaces (white / pial)
  - Other / not sure
```

→ Go to `editing/recon_edit.md` (covers all three edit targets)

---

### When to skip the opening dialogue

| User said | Action |
|---|---|
| "Run FreeSurfer on sub-01" | Ask Level 1 + Branch A (Q1/Q2/Q3) |
| "Just run -all on 50 subjects, no QC" | Skip all → Batch + Fast + None |
| "My recon-all crashed" | Skip all → `workflows/resume.md` |
| "Re-run just the white surface step" | Skip all → `workflows/single_step.md` |
| "I edited brainmask.mgz, what next" | Skip all → `editing/recon_edit.md` then resume |
| "View this folder / show me these surfaces" | Skip Level 1 → Branch B: View |
| "Edit my brainmask" | Skip Level 1 → Branch B: Edit → brainmask |

Principle: **don't ask what the user already told you.**

The agent then states the plan briefly and starts executing:

> Plan:
> - Process sub-01 with the standard workflow (4 QC checkpoints)
> - After QC4 passes, run hippocampus + amygdala subfield segmentation (T1)
> - Final report includes recon-all stats + hippocampus subfields
>
> Starting with environment setup and autorecon1...

This makes the agent's intentions transparent and lets the user
correct course before time-expensive steps run.

---

## Key behaviors

### Always

- Verify `$FREESURFER_HOME` and `$SUBJECTS_DIR` are set before any
  command
- Set `$SUBJECT` and `$QC_DIR` (export to `/mnt/user-data/outputs/<subject>_qc/`)
  at the start of any session
- Source `$FREESURFER_HOME/SetUpFreeSurfer.sh` to ensure tools are in
  PATH
- Backup intermediate files before editing
  (e.g., `cp brainmask.mgz brainmask.mgz.preEdit`)
- Log QC verdicts to `$QC_DIR/qc_log.txt`
- After each `recon-all` invocation, verify success by checking
  `scripts/recon-all-status.log`

### Never

- Decide pass/fail at a QC node — that's the user's call
- Skip QC nodes silently in the default workflow — at minimum, ask
  the user
- Run `-all` without confirming the user wants no QC
- Edit `brainmask.auto.mgz` (it's regenerated; edit `brainmask.mgz`)
- Mix Level 1 and Level 2 within a single workflow without explicit
  user request
- Skip giving the viewer file-loading instructions at a QC node — the
  user must know what to load and where to look
- Skip the QC log setup (export `$QC_DIR`, `mkdir -p`) — the audit trail
  still matters even without screenshots

### Mode-switching triggers

The agent should switch granularity (Level → Level) when:

| Trigger | Switch to |
|---|---|
| User says "QC each stage" | Level 2 |
| User says "stop after step X" | Level 2 or 3 |
| User says "edit Y file" | Level 3 (after edit) |
| `recon-all` returns error | Level 2/3 (resume) |
| User says "explain step N" | Level 3 (read all_31_steps.md) |
| User says "just run it all" | Level 1 |

---

## Output conventions

- **Subject directory:** `$SUBJECTS_DIR/<subject>/` (FreeSurfer
  default; do not modify)
- **QC log:** `/mnt/user-data/outputs/<subject>_qc/qc_log.txt`
- **Final stats:** `$SUBJECTS_DIR/<subject>/stats/*.stats` (FreeSurfer
  default)

QC review is done interactively in the web viewer (FreeView Online);
no PNG snapshots are generated by default. After completion, the agent
presents a final summary with stats and any post-completion edit prompt.

---

## Scope of v1

**Included:**
- `recon-all` end-to-end (steps 1-31, including 31a-j sub-steps)
- 3 execution modes (one-shot, three-stage, single-step)
- 4 QC nodes (brainmask, wm, white surface, pial surface)
- Manual editing procedures for the 3 main edit targets
- Single-subject and batch workflows
- Crash recovery
- **12 subfield/subregion segmentation tools** (`subfields/`):
  hippocampus + amygdala (T1 / T2 / unified), brainstem, thalamic
  nuclei, limbic structures, SynthSeg variants, SAMSEG

**Not included (potential v2):**
- Longitudinal pipeline (`-base` and `-long`)
- Group-level statistical analysis (mri_glmfit, etc.)
- TRACULA / diffusion processing
- Hypothalamic subunit segmentation
- Cerebellar lobule parcellation
- Automated QC tools (qatools, MRIQC integration)

If the user asks about these, say they're outside v1 scope but the
underlying FreeSurfer commands are documented at https://surfer.nmr.mgh.harvard.edu/fswiki.

---

## Quick reference index

| To find... | See... |
|---|---|
| Full command for step N | `reference/all_31_steps.md` |
| Three-stage flag usage | `reference/three_stages.md` |
| `-all` options and variations | `reference/recon_all.md` |
| Step-to-flag mapping | `reference/command_mapping.md` |
| How modes interrelate | `reference/modes_overview.md` |
| QC workflow at node N | `qc/qc_protocol.md` |
| What to look for at QC | `qc/qc_checklist.md` |
| freeview snapshot command | `qc/snapshot_commands.md` |
| Auto-fix a bad brainmask / skull strip (no painting) | `editing/brainmask_autofix.md` |
| Auto-fix wm.mgz topology (holes / speckle) | `editing/wm_autofix.md` |
| Edit any FreeSurfer intermediate file | `editing/recon_edit.md` |
| Annotate / mark regions | `editing/voxel_edit.md` |
| Draw a binary ROI | `editing/roi_edit.md` |
| Default single-subject flow | `workflows/default.md` |
| Recover from crash | `workflows/resume.md` |
| Run just one step | `workflows/single_step.md` |
| Process many subjects | `workflows/batch.md` |
| View images/surfaces in web viewer | `workflows/view_freeview.md` |
| Choose a subfield tool | `subfields/overview.md` |
| Hippocampus + amygdala (T1) | `subfields/01_hippoamyg_t1.md` |
| Hippocampus + amygdala (T2-enhanced) | `subfields/02_hippoamyg_t2.md` |
| Brainstem (Gen 1) | `subfields/03_brainstem.md` |
| Thalamic nuclei (Gen 1) | `subfields/04_thalamic_nuclei.md` |
| Thalamus / brainstem / hippo-amyg (Gen 2) | `subfields/05_*`, `06_*`, `07_*` |
| Limbic / NAc / BNST | `subfields/08_sclimbic.md` |
| SynthSeg whole-brain (any contrast) | `subfields/09_synthseg.md` |
| SynthSeg robust (low-quality input) | `subfields/10_synthseg_robust.md` |
| SynthSeg + cortical parcellation | `subfields/11_synthseg_parc.md` |
| Multi-contrast / lesions | `subfields/12_samseg.md` |
