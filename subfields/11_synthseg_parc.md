# Tool 11: mri_synthseg --parc

SynthSeg with added cortical parcellation. Beyond the 32 subcortical/
global labels of standard SynthSeg (#9), this version adds 95 cortical
regions (Desikan-Killiany atlas), giving a complete volumetric labeling
of the brain.

**Type:** Deep learning (no recon-all required)

**Atlas / model:** SynthSeg with DK parcellation extension

**Runtime:** 3-5 minutes (CPU); ~30 seconds (GPU)

---

## When to use this

Use `--parc` when you need:
- Cortical region labels in addition to subcortical
- Don't need surfaces (just volumetric ROI labels)
- Quick alternative to recon-all + aparc2aseg

This produces results similar to FreeSurfer's `aparc+aseg.mgz` but in
minutes instead of hours, and without surface generation.

---

## Prerequisites

- Any structural MR NIfTI
- FreeSurfer 7.3 or newer

---

## Command

```bash
mri_synthseg \
  --i T1.nii.gz \
  --o synthseg_parc_out.nii.gz \
  --vol synthseg_parc_volumes.csv \
  --parc
```

### Optional flags

```bash
# Force CPU
mri_synthseg --i T1.nii.gz --o out.nii.gz --parc --cpu

# Batch
mri_synthseg --i /input_dir/ --o /output_dir/ --vol vols.csv --parc
```

---

## Outputs

- `synthseg_parc_out.nii.gz` — segmentation with 32 subcortical + 95
  cortical labels
- `synthseg_parc_volumes.csv` — volumes for all 127 labels

---

## Labels

### Subcortical (32)
Same as #9. See `09_synthseg.md`.

### Cortical (95)
Standard Desikan-Killiany regions:
- 34 cortical regions per hemisphere (× 2 = 68 lateral cortex labels)
- Medial wall and unknown labels for both hemispheres
- Plus a few additional cortical white matter / boundary labels

Total label count: 127.

The cortical labels match FreeSurfer's standard `aparc+aseg.mgz` LUT,
so downstream code that processes recon-all output works on this output
too.

---

## QC

```bash
freeview -v T1.nii.gz \
  synthseg_parc_out.nii.gz:colormap=lut:opacity=0.4 \
  -viewport coronal \
  -ss $QC_DIR/qc_synthseg_parc_coronal.png 2 -quit

freeview -v T1.nii.gz \
  synthseg_parc_out.nii.gz:colormap=lut:opacity=0.4 \
  -viewport axial \
  -ss $QC_DIR/qc_synthseg_parc_axial.png 2 -quit
```

Check that:
- Cortical labels follow visible gyri (no obvious mismatches)
- Subcortical structures are still labeled correctly
- Boundaries between cortex and subcortex are clean

For numerical sanity:
```bash
# Total cortex volume (sum of all aparc cortical regions)
cat synthseg_parc_volumes.csv | head -1
```

---

## Choosing between #9, #10, #11

| Need | Use |
|---|---|
| Just subcortical, fast, clean input | #9 |
| Just subcortical, difficult input | #10 |
| Subcortical + cortical regions | #11 |
| Full surface analysis (thickness, area) | recon-all (not SynthSeg) |

`--robust` and `--parc` cannot be combined. If you need both, run
recon-all instead.

---

## Common issues

**"Cortical labels don't match recon-all output"**
- Some boundary disagreement is expected (DL vs surface-based methods
  differ at boundaries)
- For absolute agreement with FreeSurfer's standard output, use
  recon-all

**"Some cortical regions have zero volume"**
- Possible if the input has limited FOV that excludes some cortical
  areas
- Check input coverage; expect this for partial scans

**"Slower than I expected"**
- The cortical parcellation step is the slowest part; this is normal
- For only subcortical labels, use #9 (faster)

---

## Aggregate stats

```bash
# All subjects' volumes in one CSV
mri_synthseg --i /T1s/ --o /segs/ --vol all_vols.csv --parc
```

The CSV format is the same as #9/#10 (one row per subject), just with
more columns for cortical regions.

---

## Notes

**Use case: large cohort cortical analysis without surfaces.** When you
have a study with thousands of T1s and need volumetric ROI measures for
cortex + subcortex but don't need surface measures, this tool is the
right choice. Processing time is reduced by ~100× vs recon-all.

**Comparing across pipelines.** SynthSeg's cortical labels are
generally close to recon-all's `aparc+aseg.mgz`, but not identical.
Don't mix datasets processed with different pipelines in the same
analysis without careful normalization.

**No surface-based features.** This tool does NOT produce thickness,
surface area, curvature, or gyrification. For those, only recon-all
works.
