# Tool 5: segment_subregions thalamus

Segment thalamic nuclei using the unified `segment_subregions` interface.
Functionally equivalent to tool #4 (`segmentThalamicNuclei.sh`) but uses
the newer Python-based CLI introduced in FreeSurfer 7.3.

**Generation:** Unified interface (Gen 2)

**Atlas:** Iglesias et al. 2018 (same as #4)

**Runtime:** 1-2 hours per subject

---

## Why use this over tool #4?

- **Cleaner CLI:** consistent flag patterns across all `segment_subregions`
  invocations (thalamus / brainstem / hippo-amygdala)
- **Better error messages:** Python wrapper gives more informative output
- **Easier to script:** uniform input/output handling
- **Same algorithm:** identical segmentation results to tool #4

If you're starting a new pipeline on FreeSurfer 7.3+, prefer this tool.
If you have existing pipelines using tool #4, no need to switch.

---

## Prerequisites

- FreeSurfer 7.3 or newer
- `recon-all -all` completed for the subject

---

## Command

```bash
export SUBJECTS_DIR=/path/to/subjects
source $FREESURFER_HOME/SetUpFreeSurfer.sh

segment_subregions thalamus --cross $SUBJECT
```

The `--cross` flag indicates cross-sectional (single time point)
processing. For longitudinal data, use `--long` (not in v1 scope).

### Optional flags

```bash
# Specify SUBJECTS_DIR
segment_subregions thalamus --cross $SUBJECT --sd /alternate/dir

# Force re-run (overwrites existing output)
segment_subregions thalamus --cross $SUBJECT --force
```

---

## Outputs

Identical to tool #4:

### Segmentation volume (in `mri/`)
- `ThalamicNuclei.v13.T1.mgz`

### Stats files (in `stats/`)
- `thalamic-nuclei.lh.v13.T1.stats`
- `thalamic-nuclei.rh.v13.T1.stats`

---

## Thalamic nuclei

Same 25 nuclei per hemisphere as tool #4. See `04_thalamic_nuclei.md`
for the full list, typical volumes, and research applications.

---

## QC

Same QC procedure as tool #4. See `04_thalamic_nuclei.md`.

```bash
freeview -v $SUBJECTS_DIR/$SUBJECT/mri/T1.mgz \
  $SUBJECTS_DIR/$SUBJECT/mri/ThalamicNuclei.v13.T1.mgz:colormap=lut:opacity=0.5 \
  -viewport axial \
  -ss $QC_DIR/qc_thalamus_axial.png 2 -quit
```

---

## Common issues

Same as tool #4 (see `04_thalamic_nuclei.md`).

Additionally:

**"Command not found"**
- Cause: FreeSurfer version older than 7.3
- Fix: use tool #4 (`segmentThalamicNuclei.sh`) instead, or upgrade

**"ImportError" / Python errors**
- Cause: missing Python dependencies in FreeSurfer's bundled Python
- Fix: ensure FreeSurfer was installed without modifying its Python
  environment; reinstall if needed

---

## Aggregate stats

Identical to tool #4 (asegstats2table works on the same .stats files):

```bash
asegstats2table --subjects $(cat subjects.txt) \
  --statsfile=thalamic-nuclei.lh.v13.T1.stats \
  --tablefile=lh_thalamic_nuclei.tsv --skip
```

---

## Notes

**Choosing between #4 and #5:** Functionally equivalent. Use #5 if on
7.3+ and want the cleaner CLI; use #4 for compatibility with older
FreeSurfer or existing scripts.

**Output filenames:** The `v13.T1` suffix is preserved across both
tools, so downstream analyses (stats extraction, visualization) work
identically.
