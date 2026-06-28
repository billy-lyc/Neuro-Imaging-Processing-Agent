# Tool 7: segment_subregions hippo-amygdala

Segment hippocampus subfields and amygdala nuclei using the unified
`segment_subregions` interface. Functionally equivalent to tool #1
(`segmentHA_T1.sh`), with optional T2 input replacing tool #2
(`segmentHA_T2.sh`).

**Generation:** Unified interface (Gen 2)

**Atlas:** Iglesias et al. 2015 (hippo) + Saygin et al. 2017 (amyg)

**Runtime:** 1-2 hours (T1 only); 2-3 hours (T1+T2)

---

## Why use this over #1 / #2?

- Single command for both T1 and T2-enhanced modes (just add `--t2`)
- Cleaner CLI consistent with other Gen 2 tools
- Same algorithms and outputs as #1/#2

---

## Prerequisites

- FreeSurfer 7.3 or newer
- `recon-all -all` completed
- (Optional) high-resolution T2 NIfTI for T2-enhanced mode

---

## Commands

### T1-only mode (equivalent to tool #1)

```bash
export SUBJECTS_DIR=/path/to/subjects
source $FREESURFER_HOME/SetUpFreeSurfer.sh

segment_subregions hippo-amygdala --cross $SUBJECT
```

### T1+T2 mode (equivalent to tool #2)

```bash
segment_subregions hippo-amygdala --cross $SUBJECT \
  --t2 /path/to/T2_hippo.nii.gz \
  --suffix T2hippo
```

The `--suffix` argument tags output filenames with the T2 identifier.

### Optional flags

```bash
# Specify SUBJECTS_DIR
segment_subregions hippo-amygdala --cross $SUBJECT --sd /alternate/dir

# Force re-run
segment_subregions hippo-amygdala --cross $SUBJECT --force
```

---

## Outputs

### T1-only mode
Same as tool #1:
- `mri/lh.hippoAmygLabels-T1.v22.mgz`
- `mri/rh.hippoAmygLabels-T1.v22.mgz`
- `stats/hipposubfields.{lh,rh}.T1.v22.stats`
- `stats/amygdalar-nuclei.{lh,rh}.T1.v22.stats`

### T1+T2 mode (with `--suffix T2hippo`)
Same as tool #2:
- `mri/lh.hippoAmygLabels-T2hippo.v22.mgz`
- `mri/rh.hippoAmygLabels-T2hippo.v22.mgz`
- `stats/hipposubfields.{lh,rh}.T2hippo.v22.stats`
- `stats/amygdalar-nuclei.{lh,rh}.T2hippo.v22.stats`

---

## Subfields and nuclei

Same 12 hippocampus subfields and 9 amygdala nuclei as tools #1/#2.
See `01_hippoamyg_t1.md` for the full list and details.

---

## QC

Same QC procedures as tools #1/#2. See `01_hippoamyg_t1.md` and
`02_hippoamyg_t2.md`.

```bash
# T1 mode QC
freeview -v $SUBJECTS_DIR/$SUBJECT/mri/T1.mgz \
  $SUBJECTS_DIR/$SUBJECT/mri/lh.hippoAmygLabels-T1.v22.mgz:colormap=lut:opacity=0.5 \
  $SUBJECTS_DIR/$SUBJECT/mri/rh.hippoAmygLabels-T1.v22.mgz:colormap=lut:opacity=0.5 \
  -viewport coronal \
  -ss $QC_DIR/qc_hippoamyg.png 2 -quit
```

---

## Common issues

Same as #1/#2 (see those files).

Additionally:

**"Command not found"**
- Cause: FreeSurfer < 7.3
- Fix: use #1 (T1) or #2 (T2) instead

**"T2 file not found / registration error"**
- Same as #2: pre-register T2 to T1 if automatic registration fails

---

## Aggregate stats

Identical to #1/#2:

```bash
asegstats2table --subjects $(cat subjects.txt) \
  --statsfile=hipposubfields.lh.T1.v22.stats \
  --tablefile=lh_hippo_subfields.tsv --skip
```

---

## Notes

**Tool #7 = Tool #1 with `--cross`, or Tool #2 with `--cross --t2`.**
The unified interface lets you choose modes via flags rather than
separate commands.

**Atlas version `v22`:** Same as #1/#2.

**Choosing between #1, #2, #7:**
- Old pipeline / FreeSurfer < 7.3 → #1 (T1) or #2 (T2)
- New pipeline / 7.3+ → #7 (handles both)
