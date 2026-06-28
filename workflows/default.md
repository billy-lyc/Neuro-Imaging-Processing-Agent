# FreeSurfer Workflow: Default (Single Subject + 4 QC Nodes)

This is the **canonical workflow** for a new single subject. It uses
Level 2 stage flags with the 4 standard QC checkpoints. This is the
default the agent should propose unless the user specifies otherwise.

**FreeSurfer version:** 7.x

**Preconditions:**
- T1 NIfTI file available
- `$FREESURFER_HOME` and `$SUBJECTS_DIR` set

**Total wall-clock time:** 5-10 hours for compute, plus user QC time
(usually 5-10 minutes per QC node)

---

## Editing can be invoked at any time

At any point during or after the pipeline, the user can ask to edit.
The agent should immediately hand off to the appropriate editing module:

| User intent | Module |
|---|---|
| Fix a FreeSurfer intermediate file (brainmask, wm, finalsurfs) | `editing/recon_edit.md` |
| Mark / annotate a region for reference | `editing/voxel_edit.md` |
| Draw a binary ROI for demonstration | `editing/roi_edit.md` |

Do not wait for a QC checkpoint — if the user says "I want to edit", open
the viewer immediately.

---

## Workflow at a glance

```
[1] Setup environment
    ↓
[2] recon-all -autorecon1
    ↓
[3] QC1: open viewer (mri/) → load T1 + brainmask → checklist → verdict
    │   ├─ OK → continue
    │   └─ Edit needed → editing/recon_edit.md (brainmask.mgz) → resume
    ↓
[4] recon-all -autorecon2-volonly
    ↓
[5] QC2: open viewer (mri/) → load brain + wm → checklist → verdict
    │   ├─ OK → continue
    │   └─ Edit needed → editing/recon_edit.md (wm.mgz) → resume
    ↓
[6] recon-all -autorecon2-wm
    ↓
[7] QC3: open viewer (subject root) → load brain + white surfaces → checklist → verdict
    │   ├─ OK → continue
    │   └─ Issue traced to wm.mgz → editing/recon_edit.md → re-run
    ↓
[8] recon-all -autorecon3
    ↓
[9] QC4: open viewer (subject root) → load finalsurfs + white + pial → checklist → verdict
    │   ├─ OK → done
    │   ├─ Edit brain.finalsurfs.mgz → editing/recon_edit.md → -pial -autorecon3
    │   └─ Brainmask root cause → back to QC1
    ↓
[10] Final report + post-completion edit prompt
```

---

## Detailed step-by-step

### Step 1: Setup environment

```bash
export FREESURFER_HOME=/path/to/freesurfer
export SUBJECTS_DIR=/path/to/subjects
export SUBJECT=subject01           # change as needed
source $FREESURFER_HOME/SetUpFreeSurfer.sh

# QC log directory (for audit trail; no screenshots stored here)
export QC_DIR=/mnt/user-data/outputs/${SUBJECT}_qc
mkdir -p $QC_DIR

# Initialize QC log
echo "$(date -Iseconds) Starting default workflow for $SUBJECT" > $QC_DIR/qc_log.txt
```

### Step 2: Run autorecon1

```bash
recon-all -s $SUBJECT -i input_T1.nii.gz -autorecon1
```

Wait for completion (~10-20 minutes). Verify success:
```bash
tail -5 $SUBJECTS_DIR/$SUBJECT/scripts/recon-all.log
# Should end with "autorecon1 finished without error"
```

### Step 3: QC1 (skull strip)

Open the viewer with the mri/ directory and give the user file-loading
instructions (see `qc/snapshot_commands.md` QC1 section).

The agent then:
1. Relays QC1 checklist (5 items, see `qc/qc_checklist.md`)
2. Waits for user verdict
3. Logs verdict: `echo "$(date -Iseconds) QC1: <verdict>" >> $QC_DIR/qc_log.txt`

**If user says OK** → proceed to Step 4.

**If edit needed** → `editing/recon_edit.md` (brainmask.mgz).
Start viewer with `$SUBJECTS_DIR/$SUBJECT/mri`. After user confirms done,
run `recon-all -s $SUBJECT -autorecon2-volonly`. Proceed to Step 5.

### Step 4: Run autorecon2-volonly

```bash
recon-all -s $SUBJECT -autorecon2-volonly
```

Wait for completion (~1.5-3 hours).

### Step 5: QC2 (white matter)

Open the viewer with the mri/ directory. Give user file-loading
instructions (see `qc/snapshot_commands.md` QC2 section).

Agent relays QC2 checklist, waits for verdict.

**If OK** → Step 6.

**If edit needed** → `editing/recon_edit.md` (wm.mgz).
Start viewer with `$SUBJECTS_DIR/$SUBJECT/mri`. After edits done:
- Control point fix: `recon-all -s $SUBJECT -autorecon2-cp` → re-do QC2
- Direct paint: `recon-all -s $SUBJECT -autorecon2-wm` → Step 6

### Step 6: Run autorecon2-wm

```bash
recon-all -s $SUBJECT -autorecon2-wm
```

Wait for completion (~1.5-3 hours). This produces the white surface.

### Step 7: QC3 (white surface)

Open the viewer with the subject root directory (not mri/). Give user
file-loading instructions (see `qc/snapshot_commands.md` QC3 section).

Agent relays QC3 checklist, waits for verdict.

**If OK** → Step 8.

**If issue traced to wm.mgz** → `editing/recon_edit.md` (wm.mgz) → re-run
`-autorecon2-wm` → re-do QC3.

**If pervasive topology issues** → check Euler number:
```bash
mris_euler_number $SUBJECTS_DIR/$SUBJECT/surf/lh.orig
mris_euler_number $SUBJECTS_DIR/$SUBJECT/surf/rh.orig
# Both should equal 2; if not, re-run -fix and -white
```

### Step 8: Run autorecon3

```bash
recon-all -s $SUBJECT -autorecon3
```

Wait for completion (~1-2 hours). This includes pial generation.

### Step 9: QC4 (pial surface)

Open the viewer with the subject root directory. Give user file-loading
instructions (see `qc/snapshot_commands.md` QC4 section).

Agent relays QC4 checklist, waits for verdict.

**If OK** → Step 10.

**If local pial fix needed** → `editing/recon_edit.md` (brain.finalsurfs.mgz).
Start viewer with `$SUBJECTS_DIR/$SUBJECT/mri`. After edits done:
`recon-all -s $SUBJECT -pial -autorecon3` → re-do QC4.

**If brainmask root cause** → `editing/recon_edit.md` (brainmask.mgz) →
re-run `-autorecon2 -autorecon3` → re-do QC1, QC2, QC3, QC4.

### Step 10: Final report + edit prompt

Once all 4 QCs pass, run a sanity-check sweep:

```bash
# Verify all expected outputs exist
ls $SUBJECTS_DIR/$SUBJECT/mri/aparc+aseg.mgz
ls $SUBJECTS_DIR/$SUBJECT/surf/lh.thickness $SUBJECTS_DIR/$SUBJECT/surf/rh.thickness
ls $SUBJECTS_DIR/$SUBJECT/stats/aseg.stats
ls $SUBJECTS_DIR/$SUBJECT/stats/lh.aparc.stats $SUBJECTS_DIR/$SUBJECT/stats/rh.aparc.stats

# Quick stats summary
echo "=== Subject $SUBJECT processing complete ==="
grep "EstimatedTotalIntraCranialVol" $SUBJECTS_DIR/$SUBJECT/stats/aseg.stats
```

The agent produces a final summary, then **always asks**:

> Processing complete. Would you like to perform any manual edits?
>
> - **Recon Edit** — fix a FreeSurfer intermediate file (brainmask, wm, finalsurfs)
> - **Voxel Edit** — annotate / mark regions for reference
> - **ROI Edit** — draw a binary region for demonstration
> - **No** — done

Based on the user's choice, hand off to the corresponding editing module.
If the user selects Recon Edit and specifies a file, look up the correct
resume command from `editing/recon_edit.md` and run it after edits are done.

---

## Variant: skip selective QC nodes

If the user wants to skip some QC nodes (e.g., trust the WM but verify
the pial):

```bash
recon-all -s $SUBJECT -i input_T1.nii.gz -autorecon1
# QC1 (kept)

recon-all -s $SUBJECT -autorecon2     # full autorecon2 in one go
# QC3 only (skip QC2)

recon-all -s $SUBJECT -autorecon3
# QC4
```

Warn: "Skipping QC2 means wm.mgz issues will surface at QC3, requiring
expensive re-processing if found." Then honor the user's choice.

---

## Variant: parallel processing

```bash
recon-all -s $SUBJECT -i T1.nii.gz -autorecon1 -parallel -openmp 4
recon-all -s $SUBJECT -autorecon2-volonly -parallel -openmp 4
```

OpenMP helps autorecon2 most (especially CA register).

---

## Variant: adding T2 or FLAIR

```bash
recon-all -s $SUBJECT -i T1.nii.gz \
  -T2 T2.nii.gz -T2pial \
  -autorecon1
```

---

## When this workflow is NOT appropriate

- **Batch processing many subjects** → `workflows/batch.md`
- **Recovering from a crash** → `workflows/resume.md`
- **Re-running just one step** → `workflows/single_step.md`

---

## Quick reference: full command sequence

```bash
# Setup
export SUBJECTS_DIR=/path/to/subjects
export SUBJECT=subject01
source $FREESURFER_HOME/SetUpFreeSurfer.sh
export QC_DIR=/mnt/user-data/outputs/${SUBJECT}_qc
mkdir -p $QC_DIR

# Stage 1
recon-all -s $SUBJECT -i input_T1.nii.gz -autorecon1
# [QC1 here]

# Stage 2a
recon-all -s $SUBJECT -autorecon2-volonly
# [QC2 here]

# Stage 2b
recon-all -s $SUBJECT -autorecon2-wm
# [QC3 here]

# Stage 3
recon-all -s $SUBJECT -autorecon3
# [QC4 here → final report → edit prompt]
```
