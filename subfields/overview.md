# FreeSurfer Subfields/Subregions: Tool Overview

This module covers FreeSurfer's 12 subfield/subregion segmentation tools.
All run **after** `recon-all -all` completes (except `mri_synthseg` and
`samseg`, which can run independently).

**FreeSurfer version:** 7.x

---

## The 12 tools at a glance

| # | Tool | Targets | Input | Runtime |
|---|---|---|---|---|
| 1 | `segmentHA_T1.sh` | Hippocampus 12 subfields + Amygdala 9 nuclei | T1 | 1-2 h |
| 2 | `segmentHA_T2.sh` | Hippocampus subfields, T2-enhanced | T1 + T2 | 2-3 h |
| 3 | `segmentBS.sh` | Brainstem 4 substructures | T1 | 30-60 min |
| 4 | `segmentThalamicNuclei.sh` | Thalamus 25 nuclei | T1 | 1-2 h |
| 5 | `segment_subregions thalamus` | Thalamus (new interface, same as #4) | T1 | 1-2 h |
| 6 | `segment_subregions brainstem` | Brainstem (new interface, same as #3) | T1 | 30-60 min |
| 7 | `segment_subregions hippo-amygdala` | Hippocampus + Amygdala (new interface, same as #1) | T1 | 1-2 h |
| 8 | `mri_sclimbic_seg` | 13 limbic structures (NAc, BNST, etc.) | T1 (no recon-all needed) | 5-10 min |
| 9 | `mri_synthseg` | Whole-brain 32 labels, contrast-agnostic | Any contrast (no recon-all needed) | 1-3 min |
| 10 | `mri_synthseg --robust` | SynthSeg+ for low-quality scans | Any contrast | 3-5 min |
| 11 | `mri_synthseg --parc` | SynthSeg + cortical parcellation | Any contrast | 3-5 min |
| 12 | `samseg` | Multi-contrast Bayesian segmentation (with lesions) | T1 (+ optional T2/FLAIR) | 30-60 min |

---

## Two generations of tools

FreeSurfer's subfield tools come from two generations:

**Generation 1 — Classic shell wrappers (FreeSurfer 6.x, kept in 7.x)**
- `segmentHA_T1.sh`, `segmentHA_T2.sh`, `segmentBS.sh`,
  `segmentThalamicNuclei.sh`
- Each is a shell script that wraps a MATLAB-compiled binary
- Mature, well-tested, documented in many published studies

**Generation 2 — Unified `segment_subregions` interface (FreeSurfer 7.3+)**
- `segment_subregions thalamus|brainstem|hippo-amygdala`
- Single Python entry point, same underlying algorithm as Gen 1
- Cleaner API, supports BIDS-like batch invocation
- Recommended for new pipelines if FreeSurfer 7.3+ is available

For most purposes, Gen 1 and Gen 2 produce equivalent results. Choose based
on FreeSurfer version and personal preference. This skill documents both
generations as separate tools because their command syntax and output
filenames differ.

---

## Tool selection decision tree

```
What do you want to segment?
  │
  ├─ Hippocampus / Amygdala
  │    │
  │    ├─ Have only T1?
  │    │    ├─ Classic interface → segmentHA_T1.sh (#1)
  │    │    └─ New interface → segment_subregions hippo-amygdala (#7)
  │    │
  │    └─ Have T1 + T2 (high-res T2 of hippocampus)?
  │         └─ segmentHA_T2.sh (#2) — best precision
  │
  ├─ Brainstem (mid/pons/medulla/SCP)
  │    ├─ Classic → segmentBS.sh (#3)
  │    └─ New → segment_subregions brainstem (#6)
  │
  ├─ Thalamic nuclei
  │    ├─ Classic → segmentThalamicNuclei.sh (#4)
  │    └─ New → segment_subregions thalamus (#5)
  │
  ├─ Limbic system (NAc, BNST, basal forebrain, etc.)
  │    └─ mri_sclimbic_seg (#8) — only tool for these structures
  │
  ├─ Whole-brain segmentation, no recon-all available
  │    │
  │    ├─ Standard quality scan → mri_synthseg (#9)
  │    ├─ Low-quality / motion / artifacts → mri_synthseg --robust (#10)
  │    └─ Need cortical parcellation too → mri_synthseg --parc (#11)
  │
  └─ Multi-contrast (T1 + FLAIR), or have lesions
       └─ samseg (#12) — only tool for joint multi-contrast + lesions
```

---

## When to choose which

### "I want detailed hippocampus analysis"

**Default:** `segmentHA_T1.sh` (#1) or `segment_subregions hippo-amygdala` (#7).

**Upgrade if you have T2:** `segmentHA_T2.sh` (#2). T2 dramatically improves
the hippocampal subfield boundaries because the perforant pathway and
internal hippocampal structure are visible on T2 but not T1. Requires a
high-resolution T2 (preferably 0.4×0.4×2 mm or similar, oblique-coronal
to hippocampus).

### "I want subcortical detail beyond aseg"

**For hippocampus + amygdala:** #1 / #2 / #7.

**For brainstem:** #3 / #6.

**For thalamus:** #4 / #5. (The default aseg labels thalamus as a single
structure; #4/#5 splits it into 25 nuclei.)

**For limbic structures (NAc, BNST, basal forebrain):** #8.

### "I don't have recon-all done / can't run it"

**Best general choice:** `mri_synthseg` (#9). Runs in minutes on any
T1/T2/FLAIR/CT, no preprocessing needed.

**Low-quality data:** `mri_synthseg --robust` (#10). Slower but more
forgiving of motion, partial coverage, low SNR.

**Need cortical parcellation:** `mri_synthseg --parc` (#11). Adds
Desikan-Killiany-style cortical parcellation to the SynthSeg output.

### "I have multi-contrast data (T1 + FLAIR) and possibly lesions"

`samseg` (#12). Designed for joint Bayesian segmentation across
contrasts; specifically supports lesion segmentation in MS, stroke,
etc. Requires careful tuning for non-standard cohorts.

---

## Common combinations

Researchers often run multiple subfield tools on the same subject:

**Memory / aging studies (Alzheimer's, MCI):**
```bash
recon-all -s $SUBJECT -i T1.nii.gz -all
segmentHA_T1.sh $SUBJECT
segmentBS.sh $SUBJECT      # for brainstem nuclei involvement
mri_sclimbic_seg ...       # for basal forebrain (cholinergic system)
```

**Movement disorders (Parkinson's, dystonia):**
```bash
recon-all -s $SUBJECT -i T1.nii.gz -all
segmentBS.sh $SUBJECT
segmentThalamicNuclei.sh $SUBJECT
```

**Consciousness / sensory research:**
```bash
recon-all -s $SUBJECT -i T1.nii.gz -all
segmentThalamicNuclei.sh $SUBJECT
```

**Quick-look pipeline (no recon-all):**
```bash
mri_synthseg --i T1.nii.gz --o synthseg_out.nii.gz --parc
```

**Lesion studies (MS, stroke):**
```bash
samseg --t1w T1.nii.gz --flair FLAIR.nii.gz --output samseg_out --lesion
```

---

## Prerequisites summary

| Tool | Needs recon-all? | Needs extra inputs? |
|---|---|---|
| #1 segmentHA_T1.sh | Yes | No |
| #2 segmentHA_T2.sh | Yes | T2 NIfTI |
| #3 segmentBS.sh | Yes | No |
| #4 segmentThalamicNuclei.sh | Yes | No |
| #5 segment_subregions thalamus | Yes | No |
| #6 segment_subregions brainstem | Yes | No |
| #7 segment_subregions hippo-amygdala | Yes | No |
| #8 mri_sclimbic_seg | No | T1 NIfTI |
| #9 mri_synthseg | No | Any contrast NIfTI |
| #10 mri_synthseg --robust | No | Any contrast NIfTI |
| #11 mri_synthseg --parc | No | Any contrast NIfTI |
| #12 samseg | No | T1 (+ optional T2/FLAIR) |

Tools that need recon-all use the existing subject directory at
`$SUBJECTS_DIR/<subject>/`. Tools that don't need recon-all (#8-12) take a
standalone NIfTI and write to a user-specified output path.

---

## Output conventions

### Tools that need recon-all (#1-7)

Output goes into the existing subject directory:

```
$SUBJECTS_DIR/<subject>/
├── mri/
│   ├── lh.hippoAmygLabels-T1.v22.mgz    (#1, #7 segmentation)
│   ├── rh.hippoAmygLabels-T1.v22.mgz
│   ├── brainstemSsLabels.v13.mgz        (#3, #6)
│   ├── ThalamicNuclei.v13.T1.mgz        (#4, #5)
│   └── ...
└── stats/
    ├── hipposubfields.lh.T1.v22.stats   (#1, #7 volumes per subfield)
    ├── hipposubfields.rh.T1.v22.stats
    ├── amygdalar-nuclei.lh.T1.v22.stats
    ├── amygdalar-nuclei.rh.T1.v22.stats
    ├── brainstem.v13.stats              (#3, #6)
    ├── thalamic-nuclei.lh.v13.T1.stats  (#4, #5)
    ├── thalamic-nuclei.rh.v13.T1.stats
    └── ...
```

### Standalone tools (#8-12)

Output goes to a user-specified path (typical practice: alongside the
input NIfTI):

```
project/
├── T1.nii.gz                             (input)
├── synthseg_out.nii.gz                   (#9-11 segmentation)
├── synthseg_volumes.csv                  (#9-11 stats)
├── samseg_out/                           (#12 directory)
│   ├── seg.mgz
│   ├── lesion.nii.gz
│   └── samseg.stats
└── ...
```

---

## QC for subfields (lightweight)

Unlike the 4 main QC nodes (QC1-4) which are mandatory, subfield QC is
**optional and on-demand**. Subfield algorithms are generally stable;
errors are rare on good-quality T1 inputs.

**Default behavior:** After running a subfield tool, the agent does an
automatic numerical sanity check (volume in expected range for that
structure). If anything looks unusual, the agent suggests a visual check.

**Visual check (when requested):**
```bash
# Hippocampus example
freeview -v $SUBJECTS_DIR/$SUBJECT/mri/T1.mgz \
  $SUBJECTS_DIR/$SUBJECT/mri/lh.hippoAmygLabels-T1.v22.mgz:colormap=lut:opacity=0.5 \
  -viewport coronal \
  -ss $QC_DIR/qc_hippo_lh.png 2 -quit
```

Each tool's documentation includes a `QC` section with the right freeview
overlay command and what to look for.

---

## Parallelization

Subfield tools generally use a single CPU core; they don't benefit from
`-openmp`. For batch processing, parallelize at the subject level:

```bash
for subj in $(cat subjects.txt); do
  segmentHA_T1.sh $subj &
  while [ $(jobs -r | wc -l) -ge 4 ]; do sleep 60; done
done
wait
```

`mri_synthseg` is the exception — it can use GPU if available
(`--cpu` to force CPU).

---

## Quick reference: tool to documentation

| Tool | File |
|---|---|
| segmentHA_T1.sh | `01_hippoamyg_t1.md` |
| segmentHA_T2.sh | `02_hippoamyg_t2.md` |
| segmentBS.sh | `03_brainstem.md` |
| segmentThalamicNuclei.sh | `04_thalamic_nuclei.md` |
| segment_subregions thalamus | `05_subregions_thalamus.md` |
| segment_subregions brainstem | `06_subregions_brainstem.md` |
| segment_subregions hippo-amygdala | `07_subregions_hippoamyg.md` |
| mri_sclimbic_seg | `08_sclimbic.md` |
| mri_synthseg | `09_synthseg.md` |
| mri_synthseg --robust | `10_synthseg_robust.md` |
| mri_synthseg --parc | `11_synthseg_parc.md` |
| samseg | `12_samseg.md` |
