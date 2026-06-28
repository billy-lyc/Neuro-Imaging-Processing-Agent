# Tool 1: segmentHA_T1.sh

Segment hippocampus into 12 subfields and amygdala into 9 nuclei using T1
only. This is the most widely used FreeSurfer subfield tool.

**Generation:** Classic shell wrapper (Gen 1)

**Atlas:** Iglesias et al. 2015 (hippocampus), Saygin et al. 2017 (amygdala)

**Runtime:** 1-2 hours per subject (single-threaded)

---

## Prerequisites

- `recon-all -all` completed for the subject
- `$SUBJECTS_DIR/<subject>/mri/aseg.mgz` exists
- `$SUBJECTS_DIR/<subject>/mri/norm.mgz` exists

---

## Command

```bash
export SUBJECTS_DIR=/path/to/subjects
source $FREESURFER_HOME/SetUpFreeSurfer.sh

segmentHA_T1.sh $SUBJECT
```

That's it — single argument is the subject ID. Optional second argument
specifies a different SUBJECTS_DIR:

```bash
segmentHA_T1.sh $SUBJECT /alternate/subjects/dir
```

---

## Outputs

### Segmentation volumes (in `mri/`)
- `lh.hippoAmygLabels-T1.v22.mgz` — left hemisphere segmentation
- `rh.hippoAmygLabels-T1.v22.mgz` — right hemisphere segmentation

These are voxel volumes with integer labels (one per subfield/nucleus).
The `v22` suffix is the atlas version.

### Stats files (in `stats/`)
- `hipposubfields.lh.T1.v22.stats` — left hippocampus subfield volumes
- `hipposubfields.rh.T1.v22.stats` — right hippocampus subfield volumes
- `amygdalar-nuclei.lh.T1.v22.stats` — left amygdala nuclei volumes
- `amygdalar-nuclei.rh.T1.v22.stats` — right amygdala nuclei volumes

Each stats file is a plain text table: structure name, volume in mm³.

---

## Hippocampal subfields (12)

| Label | Structure | Notes |
|---|---|---|
| parasubiculum | Parasubiculum | Most medial subiculum component |
| presubiculum | Presubiculum | |
| subiculum | Subiculum proper | Largest input/output zone |
| CA1 | Cornu Ammonis 1 | Most vulnerable to AD pathology |
| CA3 | Cornu Ammonis 3 | (CA2 is grouped with CA3 in this atlas) |
| CA4 | Cornu Ammonis 4 | Hilar region |
| GC-ML-DG | Granule cell + molecular layer of dentate gyrus | |
| molecular_layer_HP | Molecular layer of hippocampus | |
| fimbria | Fimbria | Output white matter |
| HATA | Hippocampal-amygdaloid transition area | |
| hippocampal_fissure | Hippocampal fissure | CSF space, used as quality marker |
| hippocampal_tail | Posterior tail | |

Plus a summary measure:
- `Whole_hippocampus` — total of all subfields excluding fissure

---

## Amygdala nuclei (9)

| Label | Structure |
|---|---|
| Lateral-nucleus | Lateral nucleus |
| Basal-nucleus | Basal nucleus |
| Accessory-Basal-nucleus | Accessory basal nucleus |
| Anterior-amygdaloid-area-AAA | Anterior amygdaloid area |
| Central-nucleus | Central nucleus |
| Medial-nucleus | Medial nucleus |
| Cortical-nucleus | Cortical nucleus |
| Paralaminar-nucleus | Paralaminar nucleus |
| Corticoamygdaloid-transitio | Corticoamygdaloid transition area |

Plus:
- `Whole_amygdala` — total of all nuclei

---

## Typical volumes (healthy adults, mm³)

These are rough reference values for sanity checking. Substantial
deviations may indicate processing failure.

| Structure | Left | Right |
|---|---|---|
| Whole_hippocampus | 3000-4500 | 3000-4500 |
| CA1 | 600-900 | 600-900 |
| Subiculum | 400-600 | 400-600 |
| Whole_amygdala | 1300-1900 | 1300-1900 |

Volumes scale with eTIV; correct for head size in group analysis.

---

## QC

After completion, do a quick numerical check:

```bash
# Print whole hippocampus and amygdala volumes
grep -E "Whole_hippocampus|Whole_amygdala" \
  $SUBJECTS_DIR/$SUBJECT/stats/hipposubfields.{lh,rh}.T1.v22.stats \
  $SUBJECTS_DIR/$SUBJECT/stats/amygdalar-nuclei.{lh,rh}.T1.v22.stats
```

Volumes should be within reasonable range (above table) and
left/right should be roughly symmetric (within ~15%).

### Visual QC (optional)

```bash
freeview -v $SUBJECTS_DIR/$SUBJECT/mri/T1.mgz \
  $SUBJECTS_DIR/$SUBJECT/mri/lh.hippoAmygLabels-T1.v22.mgz:colormap=lut:opacity=0.5 \
  $SUBJECTS_DIR/$SUBJECT/mri/rh.hippoAmygLabels-T1.v22.mgz:colormap=lut:opacity=0.5 \
  -viewport coronal \
  -ss $QC_DIR/qc_hippoamyg_t1.png 2 -quit
```

In freeview, scroll through coronal slices in the temporal lobe. Check:
- Hippocampus is fully covered along its length (head, body, tail)
- Subfields follow the expected medial-to-lateral pattern
- No segmentation outside the hippocampus or amygdala

---

## Common issues

**"Segmentation is shifted relative to anatomy"**
- Cause: poor recon-all alignment, often from skull-strip or aseg errors
- Fix: re-do QC1 (brainmask) and re-run recon-all

**"Whole hippocampus volume is implausibly low (<2000 mm³) or high (>6000 mm³)"**
- Cause: aseg.mgz has bad hippocampal labeling
- Fix: inspect aseg in freeview; if needed, edit and re-run from the
  affected step

**"Atrophy patient: subfields look reasonable but tail is missing"**
- Often expected — severe atrophy can leave the tail too small to
  segment confidently
- Document and proceed; analyze with awareness

**"Amygdala segmentation extends into temporal cortex"**
- Known limitation in T1-only mode (T2 helps; see tool #2)
- Acceptable for whole-amygdala analyses, problematic for nucleus-level

---

## Aggregate stats extraction

For batch analysis, extract a per-subject table:

```bash
# Per-subfield volumes for all subjects, left hemisphere
asegstats2table --subjects $(cat subjects.txt) \
  --statsfile=hipposubfields.lh.T1.v22.stats \
  --tablefile=lh_hippo_subfields.tsv \
  --skip

asegstats2table --subjects $(cat subjects.txt) \
  --statsfile=hipposubfields.rh.T1.v22.stats \
  --tablefile=rh_hippo_subfields.tsv \
  --skip

asegstats2table --subjects $(cat subjects.txt) \
  --statsfile=amygdalar-nuclei.lh.T1.v22.stats \
  --tablefile=lh_amyg_nuclei.tsv \
  --skip

asegstats2table --subjects $(cat subjects.txt) \
  --statsfile=amygdalar-nuclei.rh.T1.v22.stats \
  --tablefile=rh_amyg_nuclei.tsv \
  --skip
```

The `--skip` flag skips subjects that don't have the stats file.

---

## Notes

**v22 atlas:** This is the current default in FreeSurfer 7.x. Earlier
versions used v10 or v21 atlases; results are not directly comparable.

**Hemisphere processing:** The script processes both hemispheres
sequentially. There is no flag to do one hemisphere only.

**Re-running:** If you re-run on the same subject, outputs are
overwritten. Backup if needed:
```bash
cp $SUBJECTS_DIR/$SUBJECT/mri/lh.hippoAmygLabels-T1.v22.mgz \
   $SUBJECTS_DIR/$SUBJECT/mri/lh.hippoAmygLabels-T1.v22.mgz.bak
```

**Equivalent in new interface:** Tool #7 (`segment_subregions
hippo-amygdala`) produces the same output via a unified CLI.
