# Tool 12: samseg

Sequence Adaptive Multimodal SEGmentation. A Bayesian framework that
jointly segments brain tissue from one or multiple MRI contrasts, with
explicit support for **lesion segmentation** (MS, stroke, etc.).

**Type:** Bayesian generative model (no recon-all required)

**Atlas / model:** Puonti et al. 2016 (SAMSEG)

**Runtime:** 30-60 minutes (CPU); supports parallelization

---

## Why use samseg over other tools

Samseg is the only tool in this skill that:
- Jointly uses multiple contrasts (T1 + FLAIR + T2 + ...) for a single
  segmentation
- Explicitly models lesions as a separate tissue class
- Is contrast-agnostic in the same sense as SynthSeg, but Bayesian
- Provides per-tissue uncertainty estimates

Use it when:
- You have multi-contrast data (T1 + FLAIR is common for clinical)
- You need lesion segmentation (MS, stroke, traumatic lesions)
- You want statistically principled segmentation with priors

For T1-only standard volumetry, prefer recon-all or SynthSeg.

---

## Prerequisites

- T1 NIfTI (required)
- Optional: T2, FLAIR, PD, or other contrasts (registered to T1)
- FreeSurfer 7.x

No recon-all needed.

---

## Commands

### T1-only

```bash
samseg \
  --t1w T1.nii.gz \
  --output samseg_output \
  --threads 4
```

### Multi-contrast (T1 + FLAIR for lesion segmentation)

```bash
samseg \
  --t1w T1.nii.gz \
  --flair FLAIR.nii.gz \
  --output samseg_output \
  --lesion \
  --threads 4
```

The `--lesion` flag enables the lesion model, which adds WM lesions
as a separate class with anatomical priors.

### Multi-contrast (T1 + T2)

```bash
samseg \
  --t1w T1.nii.gz \
  --t2w T2.nii.gz \
  --output samseg_output \
  --threads 4
```

### General (any contrasts via `--input`)

```bash
samseg \
  --input T1.nii.gz \
  --input FLAIR.nii.gz \
  --output samseg_output \
  --threads 4
```

When using `--input`, all contrasts must be pre-registered. The `--t1w`,
`--t2w`, `--flair` flags handle registration internally.

---

## Outputs

Output is a directory with multiple files:

```
samseg_output/
├── seg.mgz                 Segmentation with standard FreeSurfer labels
├── posteriors/
│   ├── White_matter.mgz    Per-voxel probability for each tissue
│   ├── Gray_matter.mgz
│   ├── ...
├── samseg.stats            Volume table per structure
├── sbtiv.stats             eTIV estimate
└── lesion.mgz              (with --lesion) Lesion probability map
```

The `seg.mgz` uses the standard FreeSurfer LUT, compatible with other
FreeSurfer tools.

---

## Labels

Standard FreeSurfer labels (similar to aseg + cortex grouped):
- Cerebral white matter, gray matter
- Cerebellum white matter, gray matter
- Subcortical structures (thalamus, caudate, putamen, etc.)
- Ventricles, CSF
- Brainstem
- Lesion (when `--lesion` enabled)

Total ~30 labels depending on configuration.

---

## QC

```bash
freeview -v T1.nii.gz \
  samseg_output/seg.mgz:colormap=lut:opacity=0.4 \
  -viewport coronal \
  -ss $QC_DIR/qc_samseg_coronal.png 2 -quit
```

For lesion segmentation, also check the lesion probability map:
```bash
freeview -v FLAIR.nii.gz \
  samseg_output/lesion.mgz:colormap=heat:opacity=0.5 \
  -viewport axial \
  -ss $QC_DIR/qc_samseg_lesions.png 2 -quit
```

For volumes:
```bash
cat samseg_output/samseg.stats
```

---

## Common issues

**"Samseg doesn't converge / hangs"**
- Cause: input contrasts misregistered, or one contrast has very poor
  quality
- Fix: pre-register contrasts manually with `mri_robust_register` or
  `mri_coreg`; check that all inputs cover the brain

**"Lesion segmentation includes too much WM"**
- Cause: lesion model is sensitive to FLAIR contrast; very heavy
  diffuse hyperintensity can be over-segmented
- Fix: tune `--lesion-mask-pattern` and `--lesion-mask-thresh`
  (advanced); see SAMSEG documentation

**"Out of memory"**
- Reduce `--threads`
- Check input resolution; resample to 1mm³ if very high-res

**"Output looks similar to default aseg"**
- Expected for T1-only inputs without lesions; samseg's advantages
  show with multi-contrast or lesion inputs

---

## Aggregate stats

```bash
# Concatenate samseg.stats files from multiple subjects
for subj in $(cat subjects.txt); do
  echo "$subj" >> all_samseg.csv
  cat ${subj}_samseg/samseg.stats | \
    awk '{print $5","$2}' >> all_samseg.csv
done
```

(samseg doesn't have a built-in aggregate tool comparable to
asegstats2table; you'll need a custom script.)

---

## Research applications

- **Multiple sclerosis:** lesion volumes over time (longitudinal samseg)
- **Stroke:** acute lesion volume, peri-lesion segmentation
- **Traumatic brain injury:** focal contusions
- **Multi-cohort studies with mixed contrasts:** samseg can use
  whatever contrasts each subject has, vs needing the same protocol

---

## Notes

**Longitudinal samseg:** A separate longitudinal pipeline exists
(`run_samseg_long`) for temporally regularized segmentation across
time points. Not in v1 scope.

**Comparison to recon-all:** samseg's segmentation is volumetric only
(no surfaces). For thickness/area, still need recon-all (which can be
combined with samseg for lesion-aware thickness analysis).

**Computation cost:** Samseg with multiple contrasts and lesion model
takes 30-60 minutes per subject; plan accordingly for large cohorts.

**Documentation:** SAMSEG has its own dedicated documentation at
`https://surfer.nmr.mgh.harvard.edu/fswiki/Samseg` with advanced usage
patterns not covered here.
