# FreeSurfer Workflow: Single Step

This workflow handles cases where the user wants to run just one step
(or a small set of steps) — for debugging, learning, custom processing,
or post-edit re-runs.

**FreeSurfer version:** 7.x

---

## When to use this

- The user wants to understand or trace a specific step
- A step needs to be re-run (e.g., to use updated atlas or different params)
- An edit was made to an intermediate file and only some downstream steps
  need re-running
- The user is substituting a custom algorithm for one step
- The user only needs partial output (e.g., just brainmask, not full
  pipeline)

---

## Two approaches

### Approach 1: Use recon-all single-step flags (recommended)

Each of the 31 steps has a recon-all flag that runs only that step.
recon-all handles dependencies: if required inputs are missing, it
errors out cleanly.

See `reference/command_mapping.md` for the full step-to-flag table.

```bash
# Run just step 5 (skull strip)
recon-all -s $SUBJECT -skullstrip

# Run just step 21 (white surface)
recon-all -s $SUBJECT -white

# Run multiple steps in order
recon-all -s $SUBJECT -smooth1 -inflate1 -qsphere -fix
```

### Approach 2: Run underlying commands directly

For maximum control (e.g., custom parameters), invoke the underlying
binaries directly. Full commands are in `reference/all_31_steps.md`.

```bash
# Equivalent of -skullstrip with custom watershed threshold
mri_watershed -T1 -h 25 -brain_atlas \
  $FREESURFER_HOME/average/RB_all_withskull_2016-05-10.vc700.gca \
  mri/transforms/talairach_with_skull.lta \
  mri/T1.mgz mri/brainmask.auto.mgz
```

This bypasses recon-all's dependency checks, so be careful: missing
inputs will cause errors at the underlying tool level (less friendly
than recon-all's checks).

**General preference:** use Approach 1 unless you have a specific
reason for Approach 2.

---

## Common single-step scenarios

### Scenario 1: Re-do skull strip with different parameters

```bash
# Default skull strip uses watershed; for some subjects -3T helps
recon-all -s $SUBJECT -clean-bm -3T -skullstrip

# Re-do the QC node
# (snapshot QC1 again — see qc/snapshot_commands.md)
```

After re-doing skull strip, downstream steps need re-running too:
```bash
recon-all -s $SUBJECT -autorecon2 -autorecon3
```

### Scenario 2: Re-do just the cortical parcellation (different atlas)

If you want to update parcellations without re-doing surfaces:

```bash
# DK
recon-all -s $SUBJECT -cortparc -parcstats

# Destrieux
recon-all -s $SUBJECT -cortparc2 -parcstats2

# DKT
recon-all -s $SUBJECT -cortparc3 -parcstats3

# Re-do the volumetric mapping if needed
recon-all -s $SUBJECT -aparc2aseg
```

### Scenario 3: Re-generate stats after editing an annot

```bash
# After editing label/lh.aparc.annot manually:
recon-all -s $SUBJECT -parcstats
recon-all -s $SUBJECT -aparc2aseg
recon-all -s $SUBJECT -segstats
```

### Scenario 4: Run just autorecon1 (e.g., for skull-stripped output only)

```bash
recon-all -s $SUBJECT -i T1.nii.gz -autorecon1
# Output: mri/brainmask.mgz, mri/T1.mgz, etc.
# Stop here; no need to continue.
```

This is useful if another tool (e.g., a different segmentation pipeline)
needs only the bias-corrected, skull-stripped brain.

### Scenario 5: Re-run pial only after editing brain.finalsurfs.mgz

```bash
recon-all -s $SUBJECT -pial

# Then re-do downstream stats
recon-all -s $SUBJECT -parcstats -parcstats2 -parcstats3 \
  -aparc2aseg -segstats -wmparc
```

Or chain:
```bash
recon-all -s $SUBJECT -pial -autorecon3
```

`-autorecon3` is mostly idempotent and will only re-run steps whose
inputs changed.

### Scenario 6: Substitute SynthStrip for skull stripping

```bash
# 1. Run autorecon1 partially (through normalization 1)
recon-all -s $SUBJECT -i T1.nii.gz \
  -motioncor -nuintensitycor -talairach -normalization

# 2. Run SynthStrip instead of -skullstrip
mri_synthstrip \
  -i $SUBJECTS_DIR/$SUBJECT/mri/T1.mgz \
  -o $SUBJECTS_DIR/$SUBJECT/mri/brainmask.mgz

# Also save as brainmask.auto.mgz so recon-all sees it
cp $SUBJECTS_DIR/$SUBJECT/mri/brainmask.mgz \
   $SUBJECTS_DIR/$SUBJECT/mri/brainmask.auto.mgz

# 3. Continue pipeline
recon-all -s $SUBJECT -autorecon2 -autorecon3
```

---

## Dependency awareness

When running single steps, you must understand the dependency graph.
Each step requires specific input files; running a step without its
inputs will fail.

### Quick dependency reference

| Step | Required inputs |
|---|---|
| `-motioncor` | `mri/orig/00*.mgz` |
| `-nuintensitycor` | `mri/orig.mgz` |
| `-talairach` | `mri/nu.mgz` |
| `-normalization` | `mri/nu.mgz`, `mri/transforms/talairach.xfm` |
| `-skullstrip` | `mri/T1.mgz`, `mri/nu.mgz` |
| `-gcareg` | `mri/nu.mgz`, `mri/brainmask.mgz` |
| `-canorm` | `mri/nu.mgz`, `mri/brainmask.mgz`, `talairach.lta` |
| `-careg` | `mri/norm.mgz`, `talairach.lta` |
| `-calabel` | `mri/norm.mgz`, `talairach.m3z` |
| `-normalization2` | `mri/norm.mgz`, `mri/aseg.presurf.mgz` |
| `-maskbfs` | `mri/brain.mgz`, `mri/brainmask.mgz` |
| `-segmentation` | `mri/brain.mgz`, `mri/aseg.presurf.mgz` |
| `-fill` | `mri/wm.mgz`, `talairach.lta` |
| `-tessellate` | `mri/filled.mgz` |
| `-smooth1` | `surf/?h.orig.nofix` |
| `-inflate1` | `surf/?h.smoothwm.nofix` |
| `-qsphere` | `surf/?h.inflated.nofix` |
| `-fix` | `surf/?h.qsphere.nofix`, `surf/?h.orig.nofix` |
| `-white` | `surf/?h.orig`, `mri/brain.finalsurfs.mgz`, `mri/wm.mgz` |
| `-smooth2` | `surf/?h.white.preaparc` |
| `-inflate2` | `surf/?h.smoothwm` |
| `-sphere` | `surf/?h.inflated` |
| `-surfreg` | `surf/?h.sphere`, fsaverage atlas |
| `-jacobian_white` | `surf/?h.white.preaparc`, `surf/?h.sphere.reg` |
| `-avgcurv` | `surf/?h.sphere.reg`, fsaverage curvature |
| `-cortparc` | `surf/?h.sphere.reg`, DK classifier |
| `-pial` | `surf/?h.white.preaparc`, `?h.aparc.annot`, `mri/brain.finalsurfs.mgz` |
| `-cortribbon` | `surf/?h.white`, `surf/?h.pial` |
| `-parcstats*` | parcellation annot + stats inputs |
| `-aparc2aseg` | parcellation annot + `mri/ribbon.mgz` |
| `-segstats` | `mri/aseg.mgz` (final) |
| `-wmparc` | `mri/aparc+aseg.mgz` |

For full input lists, see `reference/all_31_steps.md`.

---

## Single-hemisphere processing

Most surface-related single-step flags can be limited to one hemisphere
with `-hemi`:

```bash
# Run -white only on left hemisphere
recon-all -s $SUBJECT -hemi lh -white

# Run autorecon3 only on right hemisphere
recon-all -s $SUBJECT -hemi rh -autorecon3
```

Useful when one hemisphere had a specific issue and you don't want to
re-process the good one.

---

## Verifying output of a single step

After running a step, verify it produced the expected output:

```bash
# Check the file exists and is non-empty
ls -la $SUBJECTS_DIR/$SUBJECT/<expected-output>

# Check log for errors specific to this step
grep -A 5 "<step name>" $SUBJECTS_DIR/$SUBJECT/scripts/recon-all.log | tail
```

For QC-relevant steps, run the QC snapshot for that step.

---

## When NOT to use single steps

- **Initial run on a fresh subject** → use `workflows/default.md`
- **Recovering from a crash mid-pipeline** → use `workflows/resume.md`
- **Batch processing** → use `workflows/batch.md`

Single-step is for surgical re-runs, not the typical workflow.

---

## Cheat sheet

| Goal | Command |
|---|---|
| Run one step | `recon-all -s $SUBJECT -<flag>` |
| Run a few steps in sequence | `recon-all -s $SUBJECT -<flag1> -<flag2> ...` |
| Force re-run a completed step | `recon-all -s $SUBJECT -clean-<thing> -<flag>` |
| One hemisphere only | `recon-all -s $SUBJECT -hemi <lh|rh> -<flag>` |
| Underlying command directly | See `reference/all_31_steps.md` |
