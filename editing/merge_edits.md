# Merge Edits: NIfTI → MGZ

Apply a `.nii.gz` edit overlay back into the original `.mgz` file.

**When to use:** A drawing was saved as `.nii.gz` (e.g. `wm.nii.gz`) and
needs to be merged into the corresponding FreeSurfer volume (`wm.mgz`).

**Merge logic:**
- Where the `.nii.gz` voxel is **non-zero** → overwrite the `.mgz` voxel
- Where the `.nii.gz` voxel is **zero** → keep the original `.mgz` voxel

A `.premerge` backup of the original is created automatically.

---

## Usage

**Auto mode** — scan a directory, find all matching pairs by name:
```bash
python "${SKILL_DIR}/editing/merge_edits.py" \
  $SUBJECTS_DIR/$SUBJECT/mri/
```
Finds all pairs automatically, e.g. `wm.nii.gz` + `wm.mgz`, `brainmask.nii.gz` + `brainmask.mgz`.

**Explicit mode** — specify files directly:
```bash
python "${SKILL_DIR}/editing/merge_edits.py" \
  $SUBJECTS_DIR/$SUBJECT/mri/wm.nii.gz \
  $SUBJECTS_DIR/$SUBJECT/mri/wm.mgz
```

---

## What it checks before merging

1. **Dimensions match** — if shapes differ, skips with an error message
2. **Non-zero voxels exist** — if the edit file is all zeros, skips

---

## After merging

Run the appropriate resume command for the edited file:

| Merged file | Resume command |
|---|---|
| `brainmask.mgz` | `recon-all -s $SUBJECT -autorecon2-volonly` |
| `wm.mgz` | `recon-all -s $SUBJECT -autorecon2-wm` |
| `brain.finalsurfs.mgz` | `recon-all -s $SUBJECT -pial -autorecon3` |
| `aseg.mgz` | `recon-all -s $SUBJECT -segstats` |
