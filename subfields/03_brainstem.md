# Tool 3: segmentBS.sh

Segment brainstem into 4 substructures: midbrain, pons, medulla
oblongata, and superior cerebellar peduncle (SCP).

**Generation:** Classic shell wrapper (Gen 1)

**Atlas:** Iglesias et al. 2015 (brainstem)

**Runtime:** 30-60 minutes per subject

---

## Prerequisites

- `recon-all -all` completed
- `$SUBJECTS_DIR/<subject>/mri/aseg.mgz` exists

---

## Command

```bash
export SUBJECTS_DIR=/path/to/subjects
source $FREESURFER_HOME/SetUpFreeSurfer.sh

segmentBS.sh $SUBJECT
```

Optional second argument for SUBJECTS_DIR:
```bash
segmentBS.sh $SUBJECT /alternate/subjects/dir
```

---

## Outputs

### Segmentation volume (in `mri/`)
- `brainstemSsLabels.v13.mgz` — single volume containing all 4
  substructures (no separate left/right; brainstem is midline)

### Stats file (in `stats/`)
- `brainstem.v13.stats` — table of 4 substructures + Whole_brainstem

---

## Substructures (4)

| Label | Structure | Anatomy |
|---|---|---|
| Midbrain | Mesencephalon | Cerebral peduncles, tectum, tegmentum |
| Pons | Pons | Includes pontine nuclei and corticospinal fibers |
| Medulla_Oblongata | Medulla | Lower brainstem, cardiorespiratory centers |
| SCP | Superior cerebellar peduncle | Output of cerebellar nuclei |

Plus:
- `Whole_brainstem` — total of all 4

Note: brainstem nuclei (e.g., substantia nigra, locus coeruleus, raphe)
are NOT subdivided by this tool. For nucleus-level brainstem
segmentation, additional tools or manual segmentation are needed.

---

## Typical volumes (healthy adults, mm³)

| Structure | Volume |
|---|---|
| Whole_brainstem | 22000-28000 |
| Midbrain | 5500-7000 |
| Pons | 13000-16500 |
| Medulla | 4000-5500 |
| SCP | 200-400 |

The SCP is small and most variable; sub-100 mm³ values may indicate
segmentation issues.

---

## QC

```bash
# Numerical sanity check
cat $SUBJECTS_DIR/$SUBJECT/stats/brainstem.v13.stats
```

### Visual QC (optional)

```bash
freeview -v $SUBJECTS_DIR/$SUBJECT/mri/T1.mgz \
  $SUBJECTS_DIR/$SUBJECT/mri/brainstemSsLabels.v13.mgz:colormap=lut:opacity=0.5 \
  -viewport sagittal \
  -ss $QC_DIR/qc_brainstem.png 2 -quit
```

In sagittal view (best for brainstem), check:
- Boundary between midbrain and pons (at the level of the pontomesencephalic junction)
- Boundary between pons and medulla (at the level of the pontomedullary junction)
- SCP appears as a thin structure dorsal to the upper pons
- No segmentation extending into the cerebellum or thalamus

---

## Common issues

**"Whole brainstem volume too low"**
- Cause: aseg has under-segmented brainstem from recon-all
- Fix: re-do QC1 (skull strip — sometimes the brainstem is partially
  cut off if the FOV is tight) and re-run recon-all

**"SCP missing or merged with cerebellar WM"**
- The SCP is small and easily missed; this is sometimes acceptable
- Fix: visually verify in coronal slices through the upper pons; if
  truly missing, may indicate cerebellar dentate is not segmented in
  aseg

**"Boundaries look anatomically wrong"**
- Most common cause: poor recon-all alignment in posterior fossa
- Fix: check the original aseg.mgz brainstem labeling; if that's
  wrong, the input is wrong and segmentBS.sh inherits the error

---

## Aggregate stats extraction

```bash
asegstats2table --subjects $(cat subjects.txt) \
  --statsfile=brainstem.v13.stats \
  --tablefile=brainstem_volumes.tsv \
  --skip
```

---

## Research applications

- **Parkinson's disease:** midbrain atrophy (substantia nigra pars compacta)
  is well-documented; this tool provides whole-midbrain measurement
- **Multiple system atrophy:** pons atrophy ("hot cross bun" sign)
  measurable as pons volume reduction
- **Friedreich ataxia, SCA:** SCP atrophy
- **Brainstem stroke / lesions:** baseline volumetry

For sub-region detail (substantia nigra alone, etc.), additional tools
or manual segmentation are required.

---

## Notes

**No left/right split:** The brainstem is treated as a midline
structure. If you need left/right midbrain measures (e.g., for
unilateral Parkinson's), you'd have to manually split the segmentation
along the midline.

**Atlas version `v13`:** Current default in FreeSurfer 7.x.

**Equivalent in new interface:** Tool #6 (`segment_subregions
brainstem`) produces equivalent output via the unified CLI.
