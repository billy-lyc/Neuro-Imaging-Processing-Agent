# Tool 6: segment_subregions brainstem

Segment brainstem substructures using the unified `segment_subregions`
interface. Functionally equivalent to tool #3 (`segmentBS.sh`) but uses
the newer Python-based CLI from FreeSurfer 7.3.

**Generation:** Unified interface (Gen 2)

**Atlas:** Iglesias et al. 2015 (same as #3)

**Runtime:** 30-60 minutes per subject

---

## Why use this over tool #3?

- Cleaner CLI consistent with #5 and #7
- Better error reporting
- Same algorithm and outputs as tool #3

---

## Prerequisites

- FreeSurfer 7.3 or newer
- `recon-all -all` completed

---

## Command

```bash
export SUBJECTS_DIR=/path/to/subjects
source $FREESURFER_HOME/SetUpFreeSurfer.sh

segment_subregions brainstem --cross $SUBJECT
```

### Optional flags

```bash
segment_subregions brainstem --cross $SUBJECT --sd /alternate/dir
segment_subregions brainstem --cross $SUBJECT --force
```

---

## Outputs

Identical to tool #3:

### Segmentation volume (in `mri/`)
- `brainstemSsLabels.v13.mgz`

### Stats file (in `stats/`)
- `brainstem.v13.stats`

---

## Substructures

Same 4 substructures as tool #3:
- Midbrain
- Pons
- Medulla_Oblongata
- SCP (superior cerebellar peduncle)

Plus Whole_brainstem total.

See `03_brainstem.md` for typical volumes and research applications.

---

## QC

Same as tool #3. See `03_brainstem.md`.

```bash
freeview -v $SUBJECTS_DIR/$SUBJECT/mri/T1.mgz \
  $SUBJECTS_DIR/$SUBJECT/mri/brainstemSsLabels.v13.mgz:colormap=lut:opacity=0.5 \
  -viewport sagittal \
  -ss $QC_DIR/qc_brainstem.png 2 -quit
```

---

## Common issues

Same as tool #3 (see `03_brainstem.md`).

---

## Aggregate stats

```bash
asegstats2table --subjects $(cat subjects.txt) \
  --statsfile=brainstem.v13.stats \
  --tablefile=brainstem_volumes.tsv --skip
```

---

## Notes

**Choosing between #3 and #6:** Equivalent functionality. Use #6 on
FreeSurfer 7.3+ for the cleaner CLI; use #3 for older FreeSurfer or
script compatibility.
