# FreeSurfer recon-all: Command Mapping (Speed Lookup)

This is a fast lookup table mapping the three modes (`-all`, three stages,
31 single steps) to each other. Use this when you know what you want to do
but need to find the right flag.

**FreeSurfer version:** 7.x

---

## Master mapping table

| Step # | Step name | Single-step flag | Stage flag | In `-all`? |
|---|---|---|---|---|
| 1 | Motion correction | `-motioncor` | `-autorecon1` | ✓ |
| 2 | NU correction | `-nuintensitycor` | `-autorecon1` | ✓ |
| 3 | Talairach | `-talairach` | `-autorecon1` | ✓ |
| 4 | Normalize 1 | `-normalization` | `-autorecon1` | ✓ |
| 5 | Skull strip ★ QC1 | `-skullstrip` | `-autorecon1` | ✓ |
| 6 | EM register | `-gcareg` | `-autorecon2` | ✓ |
| 7 | CA normalize | `-canorm` | `-autorecon2` | ✓ |
| 8 | CA register | `-careg` | `-autorecon2` | ✓ |
| 9 | aseg label | `-calabel` | `-autorecon2` | ✓ |
| 10 | CC seg | `-calabel` | `-autorecon2` | ✓ |
| 11 | Normalize 2 | `-normalization2` | `-autorecon2` | ✓ |
| 12 | Mask BFS | `-maskbfs` | `-autorecon2` | ✓ |
| 13 | WM seg | `-segmentation` | `-autorecon2` | ✓ |
| 14 | WM aseg edit ★ QC2 | `-segmentation` | `-autorecon2` | ✓ |
| 15 | Fill | `-fill` | `-autorecon2` | ✓ |
| 16 | Tessellate | `-tessellate` | `-autorecon2` | ✓ |
| 17 | Smooth1 | `-smooth1` | `-autorecon2` | ✓ |
| 18 | Inflate1 | `-inflate1` | `-autorecon2` | ✓ |
| 19 | QSphere | `-qsphere` | `-autorecon2` | ✓ |
| 20 | Fix topology | `-fix` | `-autorecon2` | ✓ |
| 21 | White surface ★ QC3 | `-white` | `-autorecon2` | ✓ |
| 22 | Smooth2 | `-smooth2` | `-autorecon2` | ✓ |
| 23 | Inflate2 | `-inflate2` | `-autorecon2` | ✓ |
| 24 | Sphere | `-sphere` | `-autorecon3` | ✓ |
| 25 | Surface reg | `-surfreg` | `-autorecon3` | ✓ |
| 26 | Jacobian | `-jacobian_white` | `-autorecon3` | ✓ |
| 27 | AvgCurv | `-avgcurv` | `-autorecon3` | ✓ |
| 28 | DK parcellation | `-cortparc` | `-autorecon3` | ✓ |
| 29 | Pial surface ★ QC4 | `-pial` | `-autorecon3` | ✓ |
| 30 | Cortical ribbon | `-cortribbon` | `-autorecon3` | ✓ |
| 31a | DK stats | `-parcstats` | `-autorecon3` | ✓ |
| 31b | Destrieux parc | `-cortparc2` | `-autorecon3` | ✓ |
| 31c | Destrieux stats | `-parcstats2` | `-autorecon3` | ✓ |
| 31d | DKT parc | `-cortparc3` | `-autorecon3` | ✓ |
| 31e | DKT stats | `-parcstats3` | `-autorecon3` | ✓ |
| 31f | aparc2aseg | `-aparc2aseg` | `-autorecon3` | ✓ |
| 31g | seg stats | `-segstats` | `-autorecon3` | ✓ |
| 31h | wmparc | `-wmparc` | `-autorecon3` | ✓ |
| 31i | BA labels | `-balabels` | `-autorecon3` | ✓ |
| 31j | Hypo relabel | `-hyporelabel` | `-autorecon3` | ✓ |

---

## Sub-stage flags (within autorecon2)

These are partial autorecon2 runs, useful for stopping at QC2 or resuming
after edits:

| Flag | Steps | Stops at | Use case |
|---|---|---|---|
| `-autorecon2-volonly` | 6-15 | After `mri_fill` | Stop for QC2 (review wm.mgz) |
| `-autorecon2-wm` | 11-23 | After white surface | Resume after wm.mgz edit |
| `-autorecon2-cp` | 7-23 | After white surface | Resume after control points added |
| `-autorecon2-perhemi` | varies | varies | Single-hemisphere processing |

---

## Reverse lookup: "I want to do X, what command?"

### Run everything from scratch
```bash
recon-all -s $SUBJECT -i T1.nii.gz -all
```

### Run with QC checkpoints (4-stop workflow)
```bash
recon-all -s $SUBJECT -i T1.nii.gz -autorecon1
# QC1: review brainmask.mgz
recon-all -s $SUBJECT -autorecon2-volonly
# QC2: review wm.mgz
recon-all -s $SUBJECT -autorecon2-wm
# QC3: review ?h.white.preaparc
recon-all -s $SUBJECT -autorecon3
# QC4: review ?h.pial
```

### Resume after I edited brainmask.mgz
```bash
recon-all -s $SUBJECT -autorecon2 -autorecon3
```

### Resume after I edited wm.mgz
```bash
recon-all -s $SUBJECT -autorecon2-wm -autorecon3
```

### Resume after I added control points (ctrl_pts.mgz)
```bash
recon-all -s $SUBJECT -autorecon2-cp -autorecon3
```

### Resume after I edited brain.finalsurfs.mgz (pial fix)
```bash
recon-all -s $SUBJECT -pial -autorecon3
```

### Re-run just the pial surface
```bash
recon-all -s $SUBJECT -pial
```

### Re-run just the parcellation stats
```bash
recon-all -s $SUBJECT -parcstats -parcstats2 -parcstats3
```

### Resume from where it crashed (auto-detect)
```bash
recon-all -s $SUBJECT -make all
```

### Force-rerun a step that recon-all thinks is done
```bash
# Either delete the output file first, or use -clean-* flags:
recon-all -s $SUBJECT -clean-bm -all       # force rerun skull strip
recon-all -s $SUBJECT -clean-tal -all      # force rerun Talairach
```

### Run with parallelization
```bash
recon-all -s $SUBJECT -i T1.nii.gz -all -parallel -openmp 4
```

### Run with T2 for better pial
```bash
recon-all -s $SUBJECT -i T1.nii.gz -T2 T2.nii.gz -T2pial -all
```

### Run hi-res input (sub-mm)
```bash
recon-all -s $SUBJECT -i T1_07mm.nii.gz -hires -all
```

---

## QC node → step → flag (quick map)

| QC node | After step | After stage flag | Edit target | Resume flag |
|---|---|---|---|---|
| **QC1** | 5 | `-autorecon1` | `brainmask.mgz` | `-autorecon2 -autorecon3` |
| **QC2** | 14 | `-autorecon2-volonly` | `wm.mgz` or `ctrl_pts.mgz` | `-autorecon2-wm` or `-autorecon2-cp`, then `-autorecon3` |
| **QC3** | 21 | `-autorecon2` | `wm.mgz` (back to QC2) | `-autorecon2-wm -autorecon3` |
| **QC4** | 29 | `-autorecon3` | `brain.finalsurfs.mgz` | `-pial` (and downstream stats) |

---

## Choosing the right granularity

| User intent | Mode | Flag |
|---|---|---|
| "Just process this subject" | Level 1 | `-all` |
| "I want to QC at each stage" | Level 2 | `-autorecon1`, `-autorecon2-volonly`, `-autorecon2-wm`, `-autorecon3` |
| "Re-run only step X" | Level 3 | single-step flag from table above |
| "Resume from failure" | mixed | `-make all` or specific resume flag |
| "Debug step X by hand" | Level 3 raw | underlying commands from `all_31_steps.md` |

---

## Notes

**Skipping steps not generally recommended.** The dependency graph between
steps is strict; skipping an intermediate step usually causes downstream
failures. Use `-clean-*` flags or single-step re-runs instead of trying to
omit steps.

**`-make` vs `-all`:** `-make all` resumes from the last completed step;
`-all` always tries to run every step (skipping ones with up-to-date
output). For interrupted runs, prefer `-make all`.

**Atlas-related flags** (e.g., `-cortparc2`, `-cortparc3`) are part of
autorecon3 by default. If you don't need extra atlases, you can skip them
individually, but they cost only a few minutes total.
