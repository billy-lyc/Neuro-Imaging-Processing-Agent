# FreeSurfer Workflow: Batch Processing

This workflow handles processing multiple subjects. The trade-off vs.
the default workflow: full per-subject QC at every node is impractical
at scale, so batch processing typically uses Level 1 (`-all`) with
post-hoc QC.

**FreeSurfer version:** 7.x

---

## Two batch styles

### Style A: Sequential, no mid-pipeline QC

Run each subject end-to-end with `-all`, then do post-hoc QC on all
finished subjects.

**Pros:** Simple, fully unattended, works on any infrastructure.

**Cons:** Errors aren't caught mid-pipeline; you may have to re-run
expensive steps for problem subjects after the fact.

**Use when:** You trust the input quality (validated cohort), have
plenty of compute time, and can tolerate some re-processing.

### Style B: Per-subject staged with selective QC

Run each subject through autorecon1 first; review QC1 across all
subjects; reject obvious failures; continue surviving subjects through
autorecon2/3.

**Pros:** Catches the most common failure (skull strip) early; saves
compute on bad subjects.

**Cons:** Requires more orchestration; multiple QC passes.

**Use when:** Mixed-quality data (e.g., clinical scans, archival data),
or you want better cost control.

---

## Style A: Sequential `-all`

### Single-machine, sequential

```bash
export SUBJECTS_DIR=/path/to/subjects
source $FREESURFER_HOME/SetUpFreeSurfer.sh

for subj in subj01 subj02 subj03; do
  recon-all -s $subj -i ${subj}_T1.nii.gz -all
done
```

### Single-machine, parallel (multiple subjects at once)

```bash
# Run 4 subjects simultaneously, each using 2 OpenMP threads
for subj in subj01 subj02 subj03 subj04; do
  recon-all -s $subj -i ${subj}_T1.nii.gz -all -openmp 2 &
done
wait

# Continue with next batch
for subj in subj05 subj06 subj07 subj08; do
  recon-all -s $subj -i ${subj}_T1.nii.gz -all -openmp 2 &
done
wait
```

Adjust the parallelism based on RAM (each subject uses 4-8 GB peak)
and CPU cores.

### Cluster (SLURM example)

```bash
#!/bin/bash
#SBATCH --array=1-100
#SBATCH --cpus-per-task=4
#SBATCH --mem=12G
#SBATCH --time=12:00:00
#SBATCH --output=logs/recon_%A_%a.log

source $FREESURFER_HOME/SetUpFreeSurfer.sh
export SUBJECTS_DIR=/path/to/subjects

# Read subject ID from a list
SUBJ=$(sed -n "${SLURM_ARRAY_TASK_ID}p" subjects.txt)

recon-all -s $SUBJ -i ${SUBJ}_T1.nii.gz -all \
  -parallel -openmp 4
```

Submit:
```bash
sbatch run_freesurfer_array.slurm
```

---

## Style B: Staged with QC1 gating

This is more complex but saves compute on subjects that fail at QC1.

### Phase 1: autorecon1 for all

```bash
for subj in $(cat subjects.txt); do
  recon-all -s $subj -i ${subj}_T1.nii.gz -autorecon1 &

  # Limit concurrency
  while [ $(jobs -r | wc -l) -ge 4 ]; do sleep 60; done
done
wait
```

### Phase 2: QC1 review across all subjects

Generate QC1 snapshots for everyone:

```bash
for subj in $(cat subjects.txt); do
  export QC_DIR=/mnt/user-data/outputs/${subj}_qc
  mkdir -p $QC_DIR

  cd $SUBJECTS_DIR/$subj
  for view in axial coronal sagittal; do
    freeview -v mri/T1.mgz \
      mri/brainmask.mgz:colormap=heat:opacity=0.4 \
      -viewport $view \
      -ss $QC_DIR/qc1_brainmask_${view}.png 2 -quit
  done
done

# Then user reviews all snapshots, marks pass/fail in a list
# (e.g., a CSV file with subject ID and verdict)
```

### Phase 3: Continue surviving subjects

Read the verdict file and continue processing only the OK subjects:

```bash
# Assume qc1_verdicts.csv has format: subj_id,verdict (PASS/FAIL/EDIT)
awk -F, '$2=="PASS"' qc1_verdicts.csv | cut -d, -f1 > pass_list.txt

for subj in $(cat pass_list.txt); do
  recon-all -s $subj -autorecon2 -autorecon3 &
  while [ $(jobs -r | wc -l) -ge 4 ]; do sleep 60; done
done
wait
```

For subjects marked EDIT, run them through individual editing
workflows (see `workflows/default.md` step 3).

For subjects marked FAIL, document and exclude from analysis.

---

## Post-hoc QC (after Style A)

After `-all` finishes for all subjects, generate snapshots for spot-
checking:

```bash
for subj in $(cat subjects.txt); do
  export QC_DIR=/mnt/user-data/outputs/${subj}_qc
  mkdir -p $QC_DIR

  cd $SUBJECTS_DIR/$subj

  # QC1: brainmask
  for view in axial coronal sagittal; do
    freeview -v mri/T1.mgz mri/brainmask.mgz:colormap=heat:opacity=0.4 \
      -viewport $view \
      -ss $QC_DIR/qc1_brainmask_${view}.png 2 -quit
  done

  # QC4: pial (most important post-hoc check)
  for hemi in lh rh; do
    freeview -v mri/T1.mgz \
      -f surf/${hemi}.white:edgecolor=yellow \
         surf/${hemi}.pial:edgecolor=red \
      -viewport coronal \
      -ss $QC_DIR/qc4_pial_${hemi}.png 2 -quit
  done
done
```

User then reviews snapshots in batch (often as a contact sheet — see
"Contact sheet" below).

---

## Contact sheet generation

For visualizing many subjects at once, combine snapshots into a grid
image:

```bash
# Requires ImageMagick
montage /mnt/user-data/outputs/*_qc/qc4_pial_lh.png \
  -tile 5x -geometry 200x200+5+5 \
  /mnt/user-data/outputs/qc4_pial_lh_contactsheet.png
```

This produces a single image showing the lh pial for all subjects in
a 5-column grid. The user can scan for outliers (subjects whose pial
looks visually different).

---

## Aggregate stats extraction

After all subjects are processed, extract stats into a single table:

```bash
# Cortical thickness per region for all subjects
asegstats2table --subjects $(cat subjects.txt) \
  --meas volume \
  --tablefile aseg_volume_table.tsv

aparcstats2table --subjects $(cat subjects.txt) \
  --hemi lh --meas thickness \
  --tablefile lh_aparc_thickness.tsv

aparcstats2table --subjects $(cat subjects.txt) \
  --hemi rh --meas thickness \
  --tablefile rh_aparc_thickness.tsv

# Other measures: area, volume, meancurv, etc.
aparcstats2table --subjects $(cat subjects.txt) \
  --hemi lh --meas area \
  --tablefile lh_aparc_area.tsv
```

These tables are the typical input for group-level statistical
analysis.

---

## Practical tips

### Subject naming

Use a consistent, simple naming convention. Avoid spaces, special
characters, and very long names. Good: `sub-001`, `Patient_42`,
`Control_15`. Bad: `John Smith T1 (run 2).nii`.

### Pre-flight checks

Before kicking off a batch, do a sanity check on inputs:

```bash
for subj in $(cat subjects.txt); do
  if [ ! -f ${subj}_T1.nii.gz ]; then
    echo "MISSING: ${subj}_T1.nii.gz"
  fi

  # Check that file is reasonable size (e.g., not empty/truncated)
  size=$(stat -c%s ${subj}_T1.nii.gz 2>/dev/null)
  if [ "$size" -lt 1000000 ]; then  # less than 1MB is suspicious
    echo "SMALL FILE: ${subj}_T1.nii.gz ($size bytes)"
  fi
done
```

### Estimating runtime

For a batch of N subjects:
- Single machine, N parallel: limited by RAM/CPU; typically 4-8
  parallel works
- With 4 subjects parallel × 4 OpenMP threads each on a 16-core
  machine, expect ~3-5 hours per subject wall-clock
- Total time ≈ (N / 4) × 4 hours = N hours

For cluster with 100 array slots:
- Each subject takes 3-5 hours
- Total wall-clock ≈ 5 hours regardless of N (assuming queue is empty)

### Storage

Each subject directory is 500 MB - 1 GB. For 100 subjects, allocate
~75 GB for `$SUBJECTS_DIR`.

### Resuming a failed batch

If your batch crashed mid-way:
1. Identify which subjects finished (look for "finished without error"
   in their `recon-all-status.log`)
2. Identify which crashed (use `workflows/resume.md` per subject)
3. Identify which never started (no subject directory or only `mri/orig`)
4. For "never started," just re-run the same `recon-all -i ... -all`
5. For "crashed," apply resume per subject
6. For "finished," skip

A wrapper to handle this automatically:

```bash
for subj in $(cat subjects.txt); do
  status_file=$SUBJECTS_DIR/$subj/scripts/recon-all-status.log

  if [ -f "$status_file" ] && \
     tail -1 "$status_file" | grep -q "finished without error"; then
    echo "$subj already done, skipping"
    continue
  fi

  if [ -d "$SUBJECTS_DIR/$subj" ]; then
    echo "$subj exists but not finished, resuming"
    recon-all -s $subj -make all
  else
    echo "$subj not started, running fresh"
    recon-all -s $subj -i ${subj}_T1.nii.gz -all
  fi
done
```

---

## When this workflow is NOT appropriate

- **Just one subject** → use `workflows/default.md`
- **Recovery from a single-subject failure** → use `workflows/resume.md`
- **Need careful QC at every step on every subject** → too expensive
  at scale; consider automated QC tools (qatools, MRIQC) instead

---

## Cheat sheet

| Action | Command |
|---|---|
| Sequential batch | `for subj in ...; do recon-all -s $subj -i ${subj}_T1.nii.gz -all; done` |
| Parallel batch (4 at a time) | wrap in `&` with `wait`; limit with `jobs -r \| wc -l` |
| Cluster batch | SLURM array job, see template above |
| Resume failed batch | wrapper checking `recon-all-status.log` per subject |
| Aggregate stats | `aparcstats2table`, `asegstats2table` |
| Contact sheet QC | `montage` from ImageMagick |
