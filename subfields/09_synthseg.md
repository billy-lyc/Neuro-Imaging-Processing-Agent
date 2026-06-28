# Tool 9: mri_synthseg

Segment the whole brain into 32 labels using a contrast-agnostic deep
learning model. Works on T1, T2, FLAIR, PD, CT, and any other MR
contrast without retraining or preprocessing.

**Type:** Deep learning (no recon-all required)

**Atlas / model:** Billot et al. 2023 (SynthSeg)

**Runtime:** 1-3 minutes per subject (CPU); ~10 seconds (GPU)

---

## Why use this tool

- **Contrast-agnostic:** segments any structural MR contrast and even
  CT/PET — no retraining
- **Fast:** orders of magnitude faster than recon-all
- **No preprocessing needed:** raw NIfTI input, no skull strip, no bias
  correction
- **Robust to resolution:** works on isotropic, anisotropic, low-res,
  high-res
- **Volumetric only:** produces voxel labels, NOT cortical surfaces

Use this when you need fast volumetric labels and don't need surfaces.

---

## Prerequisites

- Any structural MR NIfTI file (T1, T2, FLAIR, etc.)
- FreeSurfer 7.3 or newer

No recon-all required.

---

## Command

### Basic

```bash
mri_synthseg --i T1.nii.gz --o synthseg_out.nii.gz
```

### With volume table

```bash
mri_synthseg \
  --i T1.nii.gz \
  --o synthseg_out.nii.gz \
  --vol synthseg_volumes.csv
```

### Batch (multiple inputs)

```bash
# Pass a directory; each NIfTI in it is processed
mri_synthseg \
  --i /path/to/inputs/ \
  --o /path/to/outputs/ \
  --vol /path/to/volumes.csv
```

### GPU vs CPU

```bash
# Default: GPU if available
mri_synthseg --i T1.nii.gz --o seg.nii.gz

# Force CPU
mri_synthseg --i T1.nii.gz --o seg.nii.gz --cpu

# Specify GPU ID (multi-GPU systems)
mri_synthseg --i T1.nii.gz --o seg.nii.gz --threads 1
```

---

## Outputs

### Segmentation
- `synthseg_out.nii.gz` — voxel labels in same space as input

### Volumes (with `--vol`)
- `synthseg_volumes.csv` — one row per input, columns are structure
  volumes in mm³

The output is in the input's native space and resolution. To resample
to a standard space, use `mri_convert` afterward.

---

## Labels (32)

Standard FreeSurfer aseg labels:

### Subcortical (per hemisphere)
- Cerebral white matter, Cerebral cortex
- Lateral ventricle, Inferior lateral ventricle
- Cerebellum white matter, Cerebellum cortex
- Thalamus, Caudate, Putamen, Pallidum, Hippocampus, Amygdala,
  Accumbens area, Ventral DC

### Midline / global
- 3rd ventricle, 4th ventricle
- Brain stem
- CSF
- Choroid plexus

Total: 32 labels using the standard FreeSurfer LUT (lookup table).

---

## QC

```bash
freeview -v T1.nii.gz \
  synthseg_out.nii.gz:colormap=lut:opacity=0.4 \
  -viewport coronal \
  -ss $QC_DIR/qc_synthseg_coronal.png 2 -quit

freeview -v T1.nii.gz \
  synthseg_out.nii.gz:colormap=lut:opacity=0.4 \
  -viewport axial \
  -ss $QC_DIR/qc_synthseg_axial.png 2 -quit
```

For volume sanity check:
```bash
cat synthseg_volumes.csv
```

Compare key volumes (whole-brain, hippocampus, ventricles) to expected
ranges for the subject's age/sex.

---

## Common issues

**"Output looks pixelated/blocky"**
- Cause: input has very anisotropic voxels (e.g., 1×1×6 mm)
- Mitigation: SynthSeg handles this internally but output quality is
  lower than for isotropic 1mm input. For better results, see tool #10
  (`--robust` mode).

**"Skull/scalp shows up as cortex"**
- Rare in default mode, but possible on extreme inputs
- Fix: try `--robust` (tool #10) or pre-skull-strip with
  `mri_synthstrip`

**"GPU memory error"**
- Add `--cpu` flag, or reduce input resolution before processing

**"Cerebellum boundary looks too dilated"**
- Known for some atypical contrast inputs
- Acceptable for whole-cerebellum analysis; problematic for
  cerebellar lobule-level work (which SynthSeg doesn't do anyway)

---

## Aggregate stats

The `--vol` output is already a CSV-format aggregate; just concatenate
across batches:

```bash
# Volumes for all subjects in one CSV
mri_synthseg --i /path/to/T1s/ --o /path/to/segs/ --vol all_volumes.csv
```

The CSV format is one row per subject (input filename in first column),
making it directly usable for group analysis.

---

## When to choose this over recon-all

Use SynthSeg instead of recon-all when:
- You only need volumetric labels (not surface measures like thickness)
- Speed matters (e.g., processing thousands of scans)
- Input is a non-T1 contrast (T2, FLAIR, etc.)
- Input is low-quality and recon-all keeps failing
- Input is non-standard (kids, neonates, primates, atrophied brains)

Stick with recon-all when:
- You need cortical thickness, surface area, gyrification
- You need vertex-wise group analyses
- You need the full set of 31 steps' diagnostic intermediates

---

## Notes

**Robustness vs quality trade-off:** Default mode (`#9`) is fast and
high-quality on standard inputs. For low-quality or unusual inputs,
tool #10 (`--robust`) is more reliable but slower.

**Native space output:** Output is in input space. If you need it in
a standard atlas space, register afterwards.

**Skull-strip behavior:** SynthSeg internally produces a brain mask;
non-brain voxels are labeled 0.

**For cortical parcellation in addition to subcortical labels:** use
tool #11 (`mri_synthseg --parc`).
