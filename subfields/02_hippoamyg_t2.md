# Tool 2: segmentHA_T2.sh

Segment hippocampus into 12 subfields using a high-resolution T2 image
in addition to the T1. The T2 reveals internal hippocampal structure
(perforant pathway, internal architecture) that's invisible on T1,
producing more accurate subfield boundaries.

**Generation:** Classic shell wrapper (Gen 1)

**Atlas:** Iglesias et al. 2015

**Runtime:** 2-3 hours per subject

---

## When to use this over segmentHA_T1.sh (#1)

Use #2 only if you have a **dedicated high-resolution T2** of the
hippocampus, ideally:
- In-plane resolution ≤ 0.5×0.5 mm
- Slice thickness 1-2 mm
- Oblique-coronal orientation perpendicular to hippocampal long axis
- Field of view restricted to the medial temporal lobe

A standard whole-brain isotropic T2 (e.g., 1mm³) is usually NOT enough
to add value over T1-only and may even degrade results. In that case,
use tool #1 instead.

---

## Prerequisites

- `recon-all -all` completed
- High-resolution T2 NIfTI (see resolution requirements above)

---

## Command

```bash
export SUBJECTS_DIR=/path/to/subjects
source $FREESURFER_HOME/SetUpFreeSurfer.sh

segmentHA_T2.sh $SUBJECT $T2_PATH $T2_TAG 1 $SUBJECTS_DIR
```

Arguments:
- `$SUBJECT` — subject ID
- `$T2_PATH` — path to T2 NIfTI (e.g., `/data/sub-01/T2_hippo.nii.gz`)
- `$T2_TAG` — short tag for output filenames (e.g., `T2hippo`)
- `1` — flag to use T2 only (set to `0` for joint T1+T2 fitting)
- `$SUBJECTS_DIR` — subjects directory

Example:
```bash
segmentHA_T2.sh sub-01 /data/sub-01/T2_hippo.nii.gz T2hippo 1 $SUBJECTS_DIR
```

The script handles T2-to-T1 registration automatically using
`mri_robust_register`.

---

## Outputs

### Segmentation volumes (in `mri/`)
- `lh.hippoAmygLabels-${TAG}.v22.mgz` — left hemisphere
- `rh.hippoAmygLabels-${TAG}.v22.mgz` — right hemisphere

For tag=`T2hippo`, files are `lh.hippoAmygLabels-T2hippo.v22.mgz` etc.

### Stats files (in `stats/`)
- `hipposubfields.lh.${TAG}.v22.stats`
- `hipposubfields.rh.${TAG}.v22.stats`
- `amygdalar-nuclei.lh.${TAG}.v22.stats`
- `amygdalar-nuclei.rh.${TAG}.v22.stats`

### Registration outputs (in `mri/transforms/`)
- T2-to-T1 transform file

---

## Subfield labels

Same 12 hippocampal subfields and 9 amygdala nuclei as tool #1. See
`01_hippoamyg_t1.md` for the full list and typical volumes.

The key difference vs T1-only: subfield boundaries (especially CA1/CA3,
subiculum, dentate gyrus) are more accurate because the T2 makes them
visible.

---

## QC

The same numerical sanity check as tool #1 applies. Additionally, check
the T2-to-T1 registration:

```bash
# Visualize T2 registered onto T1
freeview -v $SUBJECTS_DIR/$SUBJECT/mri/T1.mgz \
  $SUBJECTS_DIR/$SUBJECT/mri/T2hippo.norm.mgz:colormap=heat:opacity=0.4 \
  -viewport coronal
```

If the T2 doesn't align with the T1 in the temporal lobe, re-do the
registration manually with `bbregister` and re-run.

```bash
freeview -v $SUBJECTS_DIR/$SUBJECT/mri/T1.mgz \
  $SUBJECTS_DIR/$SUBJECT/mri/lh.hippoAmygLabels-T2hippo.v22.mgz:colormap=lut:opacity=0.5 \
  $SUBJECTS_DIR/$SUBJECT/mri/rh.hippoAmygLabels-T2hippo.v22.mgz:colormap=lut:opacity=0.5 \
  -viewport coronal \
  -ss $QC_DIR/qc_hippoamyg_t2.png 2 -quit
```

---

## Common issues

**"T2 registration failed"**
- Cause: T2 has very different FOV from T1, or is highly tilted
- Fix: pre-register T2 to T1 manually:
  ```bash
  bbregister --s $SUBJECT --mov T2.nii.gz --reg T2_to_T1.lta --T2
  ```
- Then call `segmentHA_T2.sh` with the manually registered T2

**"Output looks similar to T1-only run"**
- Cause: T2 resolution too low; algorithm fell back to T1-dominated fit
- Fix: confirm T2 resolution. If genuinely sub-millimeter in plane, the
  algorithm is using it. If 1mm or coarser, use tool #1 instead.

**"Subfield volumes systematically different from T1-only"**
- Expected. T2 generally produces:
  - Larger CA1, smaller subiculum
  - More accurate dentate gyrus
  - Different absolute volumes — don't mix T1 and T2 results in
    the same analysis

---

## Aggregate stats extraction

```bash
asegstats2table --subjects $(cat subjects.txt) \
  --statsfile=hipposubfields.lh.T2hippo.v22.stats \
  --tablefile=lh_hippo_T2.tsv \
  --skip

# Same for rh and amygdala
```

---

## Notes

**Don't mix T1 and T2 results.** If you have a cohort where some subjects
have T2 and some don't, run tool #1 on all subjects. Mixing #1 and #2
results introduces systematic bias.

**Joint fitting (T1+T2):** Setting the 4th argument to `0` instead of
`1` enables joint T1+T2 fitting, which uses both contrasts. In practice
T2-only (`1`) is more commonly used.

**Atlas version `v22`:** Same atlas as tool #1. Earlier versions: v10,
v21.

**Equivalent in new interface:** Tool #7 (`segment_subregions
hippo-amygdala`) supports T2 input via `--t2 <path>` flag.
