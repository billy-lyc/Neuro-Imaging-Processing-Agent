# FreeSurfer recon-all: Three-Stage Reference

This document covers the three-stage flags (`-autorecon1`, `-autorecon2`,
`-autorecon3`) and their sub-stage variants. For per-step detail, see
`all_31_steps.md`. For one-shot full processing, see `recon_all.md`.

**When to use three-stage flags instead of `-all`:**
- You want to insert QC checkpoints between stages
- You're recovering from an edit and need to re-run a specific stage
- You're benchmarking or debugging a particular stage
- You want to parallelize stages across compute (e.g., run autorecon2 on a
  larger node)

---

## The three primary stages

### `-autorecon1` (steps 1-5)

**Covers:** motion correction → NU correction → Talairach → normalize 1 →
skull strip

**Output milestone:** `mri/brainmask.mgz`

**Typical runtime:** 10-20 min

**Command:**
```bash
recon-all -s $SUBJECT -i input_T1.nii.gz -autorecon1
```

For multiple T1 inputs:
```bash
recon-all -s $SUBJECT -i T1_run1.nii.gz -i T1_run2.nii.gz -autorecon1
```

**QC node after this stage: QC1** (skull strip)

**Why stop here for QC:** The brainmask drives every surface placement
downstream. Catching skull-strip errors here costs minutes; catching them
after autorecon3 costs the entire pipeline runtime.

**Sub-flags within autorecon1** (rarely used, for debugging only):
- `-motioncor` — only step 1
- `-nuintensitycor` — only step 2
- `-talairach` — only step 3
- `-normalization` — only step 4
- `-skullstrip` — only step 5

---

### `-autorecon2` (steps 6-23)

**Covers:** EM register → CA normalize → CA register → aseg → CC seg →
normalize 2 → mask BFS → WM seg → WM aseg edit → fill → tessellate →
smooth1 → inflate1 → qsphere → fix topology → white surface → smooth2 →
inflate2

**Output milestone:** `surf/?h.white.preaparc`, `surf/?h.inflated`,
`surf/?h.sulc`

**Typical runtime:** 3-6 hours (Step 8 dominates)

**Command:**
```bash
recon-all -s $SUBJECT -autorecon2
```

**QC nodes within/after this stage:**
- **QC2** — after step 14 (`wm.mgz` review)
- **QC3** — after step 21 (white surface review, at end of autorecon2)

Because autorecon2 contains two QC points, you typically don't run the full
autorecon2 in one go if you want both checkpoints. Instead, use the sub-flags
below.

#### Sub-stage flags within autorecon2

These let you stop autorecon2 at intermediate points for QC2 (the wm checkpoint).

**`-autorecon2-volonly`** (steps 6-15)
- Stops after `mri_fill`, before tessellation
- Output milestone: `mri/wm.mgz`, `mri/filled.mgz`
- **Use case:** Stop here for QC2 (review `wm.mgz`). After editing, resume
  with `-autorecon2-cp` if you added control points, or `-autorecon2-wm`
  if you edited wm.mgz directly.

**`-autorecon2-wm`** (re-runs from step 11 onwards)
- Re-runs intensity normalization 2 + WM seg + fill + everything after
- **Use case:** After editing `wm.mgz` or `brainmask.mgz`, re-run from
  here. This is the standard "I edited wm.mgz, now re-finish autorecon2"
  recovery flag.

**`-autorecon2-cp`** (re-runs control-point-driven steps)
- Re-runs from step 7 (CA normalize) using updated `ctrl_pts.mgz`
- **Use case:** After adding control points in freeview to fix WM
  intensity issues, this picks up the new control points and re-runs
  normalization onwards.

**`-autorecon2-pial`** (re-runs pial-related parts)
- Note: despite the name, this flag is sometimes used for re-running pial
  surface generation. In FreeSurfer 7.x the canonical flag is `-pial`
  (single step). Check `recon-all --help` for your version.

**`-autorecon2-perhemi`** (run one hemisphere at a time)
- Used with `-hemi lh` or `-hemi rh` to run autorecon2 on one side only
- **Use case:** Parallelization or hemisphere-specific debugging

---

### `-autorecon3` (steps 24-31)

**Covers:** sphere → surface registration → jacobian → avgcurv → DK
parcellation → pial → cortical ribbon → all parcellation stats and
extended segmentation

**Output milestone:** `surf/?h.pial`, `surf/?h.thickness`, `stats/aseg.stats`,
`stats/?h.aparc.stats`, `mri/aparc+aseg.mgz`

**Typical runtime:** 1-2 hours

**Command:**
```bash
recon-all -s $SUBJECT -autorecon3
```

**QC node within this stage: QC4** (pial surface, after step 29)

QC4 is the final checkpoint. Pial errors require editing
`brain.finalsurfs.mgz` (or `brainmask.mgz`) and re-running from `-pial`
or earlier.

**Sub-stage flags within autorecon3:**
- `-sphere`, `-surfreg`, `-jacobian_white`, `-avgcurv` — geometry steps
- `-cortparc`, `-cortparc2`, `-cortparc3` — three parcellation atlases
- `-pial` — pial surface generation (where QC4 happens)
- `-cortribbon` — ribbon volume
- `-parcstats`, `-parcstats2`, `-parcstats3` — atlas-specific stats
- `-aparc2aseg` — surface → volume mapping
- `-segstats` — final aseg stats
- `-wmparc` — white matter parcellation
- `-balabels` — Brodmann area labels
- `-hyporelabel` — hypointensity relabeling

Each of these is documented in `all_31_steps.md` (steps 24 through 31j).

---

## Stage-to-step mapping summary

| Stage | Steps | Output milestone | QC | Typical runtime |
|---|---|---|---|---|
| autorecon1 | 1-5 | `brainmask.mgz` | QC1 | 10-20 min |
| autorecon2-volonly | 6-15 | `wm.mgz` | QC2 | 1.5-3 h |
| autorecon2 | 6-23 | `?h.white.preaparc` | QC3 | 3-6 h |
| autorecon3 | 24-31 | `?h.pial`, stats | QC4 | 1-2 h |

---

## Standard mixed workflow (Level 2 default)

When using three-stage flags with all 4 QC checkpoints, the canonical
sequence is:

```bash
# Stage 1
recon-all -s $SUBJECT -i input_T1.nii.gz -autorecon1
# → QC1: review brainmask.mgz, edit if needed

# Stage 2a: stop at wm.mgz
recon-all -s $SUBJECT -autorecon2-volonly
# → QC2: review wm.mgz, add control points or edit if needed

# Stage 2b: continue to white surface
recon-all -s $SUBJECT -autorecon2-wm
# → QC3: review ?h.white.preaparc

# Stage 3
recon-all -s $SUBJECT -autorecon3
# → QC4: review ?h.pial
```

If any QC fails, the recovery flag depends on what you edited:

| Edited file | Resume command |
|---|---|
| `brainmask.mgz` | `recon-all -s $SUBJECT -autorecon2 -autorecon3` |
| `wm.mgz` (direct edit) | `recon-all -s $SUBJECT -autorecon2-wm -autorecon3` |
| `ctrl_pts.mgz` (control points) | `recon-all -s $SUBJECT -autorecon2-cp -autorecon3` |
| `brain.finalsurfs.mgz` | `recon-all -s $SUBJECT -pial -autorecon3` |

See `editing/` for the actual edit procedures and
`workflows/resume.md` for full recovery scenarios.

---

## Combining stage flags

You can chain stages in a single command. recon-all runs them in order:

```bash
# Full pipeline (equivalent to -all):
recon-all -s $SUBJECT -i T1.nii.gz -autorecon1 -autorecon2 -autorecon3

# Skip autorecon1, run 2 and 3:
recon-all -s $SUBJECT -autorecon2 -autorecon3

# Re-do everything after a wm.mgz edit:
recon-all -s $SUBJECT -autorecon2-wm -autorecon3
```

This is useful when scripting recovery: you can hand recon-all the exact
set of stages it needs to redo.

---

## Notes

**`-make all` vs stage flags:** `recon-all -make all` reads
`recon-all-status.log` and resumes from wherever the last run stopped.
This is convenient for "just continue from failure" but doesn't give you
QC checkpoints. Use stage flags when you want explicit control.

**Parallelization:** Add `-parallel -openmp N` to any stage flag to use
N threads. autorecon2 (especially Step 8 CA register) benefits the most.
autorecon1 has limited parallelism gains.

**Logs:** Each stage writes to `scripts/recon-all.log` (full trace) and
`scripts/recon-all-status.log` (high-level progress). Stage flags do not
overwrite the log; they append.
