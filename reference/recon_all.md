# FreeSurfer recon-all: One-Shot Reference

This document covers `recon-all -all` — the default, one-command full pipeline.
For staged or per-step usage, see `three_stages.md` and `all_31_steps.md`.

**FreeSurfer version:** 7.x

**When to use `-all`:**
- Default for new subjects when you trust the input quality
- Batch processing where per-subject QC isn't practical mid-pipeline
- Rerunning a subject from scratch after deleting the subject directory

**When NOT to use `-all`:**
- You want QC checkpoints between stages → use three-stage flags
- You're recovering from an edit → use stage or single-step flags
- You're debugging a specific step → use single-step flags

---

## Minimal command

```bash
recon-all -s $SUBJECT -i input_T1.nii.gz -all
```

This runs all 31 steps end-to-end. Takes 5-10 hours single-threaded,
2-4 hours with parallelization.

---

## Common variations

### Multiple T1 inputs (motion-corrected average)
```bash
recon-all -s $SUBJECT \
  -i T1_run1.nii.gz \
  -i T1_run2.nii.gz \
  -i T1_run3.nii.gz \
  -all
```

### With T2 or FLAIR for better pial surface
```bash
# T2 helps refine pial surface (reduces dura inclusion)
recon-all -s $SUBJECT -i T1.nii.gz -T2 T2.nii.gz -T2pial -all

# FLAIR alternative
recon-all -s $SUBJECT -i T1.nii.gz -FLAIR FLAIR.nii.gz -FLAIRpial -all
```

### Parallel execution
```bash
# OpenMP parallelism (recommended): N = number of threads
recon-all -s $SUBJECT -i T1.nii.gz -all -parallel -openmp 4

# Hemisphere-level parallelism (older)
recon-all -s $SUBJECT -i T1.nii.gz -all -parallel
```

### High-resolution input (sub-millimeter)
```bash
# For 0.7mm or 0.5mm T1 acquisitions
recon-all -s $SUBJECT -i T1_highres.nii.gz -hires -all
```

---

## Useful global flags

These can be added to any recon-all invocation, not just `-all`.

| Flag | Effect |
|---|---|
| `-parallel` | Run lh and rh in parallel where possible |
| `-openmp N` | Use N OpenMP threads in parallelizable steps |
| `-3T` | Use 3T-tuned skull strip and other parameters |
| `-no-isrunning` | Override the "subject is already running" lock |
| `-clean-tal` | Recompute Talairach (after manual edit of nu.mgz) |
| `-clean-bm` | Recompute brainmask (overrides edits to brainmask.mgz) |
| `-noaparc2aseg` | Skip aparc2aseg (saves time if you don't need volume mapping) |
| `-nowmparc` | Skip wmparc |
| `-nohyporelabel` | Skip hypointensity relabeling |
| `-debug` | Verbose logging (writes every underlying command) |
| `-expert <file>` | Pass custom parameters to underlying commands |

---

## Required environment

```bash
export FREESURFER_HOME=/path/to/freesurfer
export SUBJECTS_DIR=/path/to/subjects
source $FREESURFER_HOME/SetUpFreeSurfer.sh
```

`$SUBJECTS_DIR` must exist and be writable. The subject directory is
created at `$SUBJECTS_DIR/$SUBJECT/` automatically by `-i input.nii.gz`.

---

## Input requirements

| Parameter | Requirement |
|---|---|
| Modality | T1-weighted (MPRAGE, MP2RAGE, SPGR) |
| Resolution | 1mm isotropic preferred; sub-millimeter needs `-hires` |
| Field strength | 1.5T or 3T (use `-3T` for 3T) |
| File format | NIfTI (.nii, .nii.gz), DICOM, MGH (.mgz, .mgh), Analyze |
| FOV | Whole brain including cerebellum and brainstem |
| Quality | Minimal motion, no severe bias field, no large lesions |

**Common input issues that break `-all`:**
- Cropped FOV (cerebellum cut off) → skull strip fails
- Severe bias field beyond N4 correction → segmentation fails
- Heavy motion → topology defects accumulate
- Large lesions or resections → aseg mislabels structures

For known-difficult inputs, prefer staged execution with QC checkpoints
over `-all`.

---

## Output overview

After `recon-all -all` completes, `$SUBJECTS_DIR/$SUBJECT/` contains:

```
mri/                    Volumetric data
├── orig.mgz            Conformed input
├── nu.mgz              N4-corrected
├── T1.mgz              Normalized
├── brainmask.mgz       Skull-stripped (★ QC1 target)
├── norm.mgz            Atlas-normalized
├── brain.mgz           Final intensity volume
├── brain.finalsurfs.mgz   Drives surface placement
├── wm.mgz              White matter mask (★ QC2 target)
├── filled.mgz          Hemispheres separated
├── aseg.mgz            Final subcortical segmentation
├── aparc+aseg.mgz      Cortical + subcortical (most-used output)
├── aparc.a2009s+aseg.mgz   Destrieux variant
├── aparc.DKTatlas+aseg.mgz  DKT variant
├── ribbon.mgz          GM ribbon volume
└── wmparc.mgz          WM parcellation

surf/                   Surface meshes (per hemisphere: lh., rh.)
├── ?h.white            White matter surface (★ QC3 target)
├── ?h.pial             Pial surface (★ QC4 target)
├── ?h.inflated         Inflated for visualization
├── ?h.sphere           Spherical mapping
├── ?h.sphere.reg       Aligned to fsaverage
├── ?h.thickness        Per-vertex cortical thickness
├── ?h.curv             Mean curvature
├── ?h.sulc             Sulcal depth
├── ?h.area             Per-vertex surface area
└── ?h.volume           Per-vertex GM volume

label/                  Cortical parcellations
├── ?h.aparc.annot      Desikan-Killiany (34 regions)
├── ?h.aparc.a2009s.annot   Destrieux (75 regions)
├── ?h.aparc.DKTatlas.annot   DKT (refined DK)
├── ?h.cortex.label     Cortical mask (excludes medial wall)
└── ?h.BA*_exvivo.label    Brodmann area labels

stats/                  Numerical summaries
├── aseg.stats          Subcortical structure stats + eTIV
├── ?h.aparc.stats      DK per-region thickness, area, volume
├── ?h.aparc.a2009s.stats   Destrieux stats
├── ?h.aparc.DKTatlas.stats   DKT stats
└── wmparc.stats        WM parcellation stats

scripts/                Logs and provenance
├── recon-all.log       Full processing log
├── recon-all-status.log    High-level progress
├── recon-all.cmd       Exact command used
└── build-stamp.txt     FreeSurfer version
```

---

## Verifying success

A clean `-all` run ends with this line in `recon-all.log`:
```
recon-all -s <subject> finished without error at <timestamp>
```

And `recon-all-status.log` ends with:
```
finished without error at <timestamp>
```

If recon-all crashed, the last lines of `recon-all.log` will show the
failing command and its error. The `recon-all-status.log` will show which
step was running when it failed.

For mid-pipeline failures, see `workflows/resume.md`.

---

## Notes

**Idempotency:** Running `recon-all -s $SUBJECT -all` twice on the same
subject does not re-run already-completed steps unless you also pass
`-clean-...` flags. recon-all checks output files and skips up-to-date
steps. To force a full rerun, delete `$SUBJECTS_DIR/$SUBJECT/` first.

**Disk usage:** A completed subject directory is ~500 MB - 1 GB. Plan
storage accordingly for large cohorts.

**Default vs `-all`:** Calling `recon-all -s $SUBJECT -i input.nii.gz`
without `-all` only sets up the subject directory; it does not run the
pipeline. Always include `-all` (or specific stage flags) to actually
process.
