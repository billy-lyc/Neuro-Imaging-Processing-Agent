# FreeSurfer QC: Visual Inspection Checklist

This document tells the **user** what to look for at each QC node when
reviewing results in the web viewer. The agent relays this checklist
after giving the viewer file-loading instructions.

**FreeSurfer version:** 7.x

**Philosophy:** All QC decisions are made by the human user. The agent's
job is to open the viewer with the right files, relay this checklist,
and wait for the user's verdict ("OK continue" / "needs editing").

---

## QC1: Skull Strip (after autorecon1)

**Files in viewer:** `data/T1.mgz` (background) + `data/brainmask.mgz` (heat overlay, opacity 0.3)

**Views:** coronal, axial, sagittal

### What "good" looks like
- Brainmask covers all of cortex, cerebellum, brainstem
- Sharp boundary between brain (covered) and skull/scalp (not covered)
- No skull or scalp tissue visible inside the mask
- No eye, dura, or sinus tissue inside the mask

### What to check, in order

**1. Temporal poles (axial + coronal)**
- The most over-stripped region in FreeSurfer
- Look at the anterior tips of temporal lobes
- Failure mode: temporal pole partially or fully cut off

**2. Orbitofrontal cortex (sagittal + coronal)**
- Inferior frontal lobe near the eyes
- Failure mode: cortex above orbits is missing, leaving a flat bottom

**3. Cerebellum and brainstem (sagittal + axial)**
- Should be fully included up to the foramen magnum
- Failure mode: cerebellar tonsils or inferior cerebellum cut off

**4. Superior sagittal sinus and dura (coronal + axial)**
- Top of the brain along the midline
- Failure mode: dura or venous sinus included as if it were brain
  (mask extends outside cortex)

**5. Eye and optic nerve (axial + sagittal)**
- Anterior to the brain
- Failure mode: eyeball or extraocular muscle included in mask

### Verdict options
- **OK** → proceed to autorecon2-volonly
- **Minor over-strip** (small temporal pole / OFC missing) → edit
  `brainmask.mgz` to add back tissue, then proceed
- **Minor under-strip** (small dura inclusion) → edit `brainmask.mgz`
  to remove non-brain, then proceed
- **Severe failure** (large cortex missing or huge dura inclusion) →
  consider re-running with `-3T` flag, different watershed threshold,
  or substituting SynthStrip; if structural input is bad, may need to
  reject this subject

See `editing/brainmask_edit.md` for the editing procedure.

---

## QC2: White Matter Segmentation (after step 14)

**Files in viewer:** `data/brain.mgz` (background) + `data/wm.mgz` (lut overlay, opacity 0.4)

**Views:** coronal, axial, sagittal

### What "good" looks like
- All visible white matter is included in the mask
- Mask follows GM/WM boundary closely (no large under- or over-coverage)
- No large holes in deep white matter
- Subcortical structures (thalamus, caudate, putamen) are NOT included
  as WM
- Ventricles are NOT included as WM

### What to check, in order

**1. Deep white matter (all views)**
- Centrum semiovale, corona radiata, internal capsule
- Failure mode: holes inside WM (appear as black islands within the
  yellow mask) — caused by intensity inhomogeneity not fully corrected

**2. Insular and temporal WM (coronal)**
- Subcortical regions where T1 contrast is poor
- Failure mode: WM under-segmented, leaving thin gyri without WM core

**3. WM near subcortical structures (axial + coronal)**
- Boundary with thalamus, basal ganglia
- Failure mode: thalamus partially classified as WM, or WM bleeding
  into ventricle

**4. Cerebellum (sagittal)**
- Cerebellar WM should be excluded (cerebellum is segmented separately)
- Failure mode: cerebellar WM included (this often points to a
  filled.mgz or aseg issue)

**5. Brainstem (sagittal)**
- Brainstem should NOT be in wm.mgz
- Failure mode: brainstem partially in mask

### Verdict options
- **OK** → proceed to autorecon2-wm (continues to white surface)
- **WM holes in 1-3 small regions** → add control points in
  `mri/ctrl_pts.mgz` at hole centers; re-run with `-autorecon2-cp`
- **WM holes in many regions** → likely an intensity normalization
  problem; consider re-running from `-normalization2` after fixing
  inhomogeneity
- **Direct paint edits in freeview** → edit `wm.mgz` voxels manually,
  then re-run with `-autorecon2-wm`
- **Subcortical structures included** → check `aseg.presurf.mgz` for
  errors; may need to fix aseg first or move to manual ROI mask

See `editing/wm_edit.md` for editing procedures including control points.

---

## QC3: White Surface (after step 21 / end of autorecon2)

**Files in viewer:** `data/mri/brain.mgz` (background) + `data/surf/lh.white.preaparc` and `data/surf/rh.white.preaparc` (yellow edges)
*(Start viewer with subject root, not mri/)*

**Views:** coronal

### What "good" looks like
- Yellow line follows the GM/WM boundary smoothly
- No spikes, dips, or large jumps in the surface
- No regions where the surface cuts deep into WM (away from GM)
- No regions where the surface bulges out into GM
- Surface is closed (no holes visible)

### What to check, in order

**1. Smoothness of the boundary (all views)**
- The white line should glide along the GM/WM transition
- Failure mode: jagged or spiky surface — usually means topology
  defects weren't fully fixed in step 20

**2. Regions of intensity inhomogeneity (all views)**
- Especially temporal lobe, orbitofrontal, deep WM in centrum semiovale
- Failure mode: surface dips into WM where T1 intensity dropped (often
  related to wm.mgz holes from QC2)

**3. Insular cortex (coronal)**
- Tight, deeply folded region; common failure spot
- Failure mode: surface cuts across the insula instead of following
  the gyrus

**4. Temporal pole (sagittal + coronal)**
- Failure mode: surface bulges into GM, especially if brainmask was
  over-stripped at QC1

**5. Across hemispheres (lh vs rh comparison)**
- Both hemispheres should look similar in quality
- Failure mode: one hemisphere noticeably worse than the other,
  pointing to hemisphere-specific aseg or fill issues

### Verdict options
- **OK** → proceed to autorecon3
- **Local surface error in 1-3 places** → most likely caused by
  `wm.mgz` issues; go back to QC2, edit `wm.mgz`, re-run from
  `-autorecon2-wm`
- **Pervasive smoothness issues** → topology defects; check
  `mris_euler_number surf/?h.orig` output (should be 2). If not 2,
  re-run `-fix` and `-white`
- **Severe surface failure** → likely upstream issue at QC1 (brainmask)
  or QC2 (wm.mgz); go back to those and re-process forward

See `editing/wm_edit.md` (most QC3 fixes are wm.mgz edits) and
`editing/surface_edit.md` (rare cases of direct surface editing).

---

## QC4: Pial Surface (after step 29 / end of autorecon3)

**Files in viewer:** `data/mri/brain.finalsurfs.mgz` (background) + lh/rh white (yellow edges) and lh/rh pial (red edges)
*(Start viewer with subject root, not mri/)*

**Views:** coronal

### What "good" looks like
- Red line (pial) follows the GM/CSF boundary
- Yellow line (white) follows GM/WM boundary
- Gap between yellow and red represents cortical thickness
  (typically 2-4mm)
- Pial does not jump out into dura or skull regions
- Pial does not cut across thin gyri (missing thin cortex)
- No large gaps between hemispheres or other anatomical violations

### What to check, in order

**1. Pial in superior frontal and parietal cortex (coronal)**
- Most common pial failure region
- Failure mode: red line jumps out into dura/scalp (gap between yellow
  and red is unrealistically wide, e.g., >6mm)

**2. Sulcal depths (coronal + axial)**
- Pial should follow the bottom of sulci
- Failure mode: red line cuts straight across the top of a sulcus
  (missing the sulcal CSF), causing artificially low thickness

**3. Thin gyri (all views)**
- Especially in the frontal pole and occipital pole
- Failure mode: pial collapses onto white in thin gyri, giving zero
  thickness

**4. Vessels and venous sinuses (coronal near midline)**
- Vessels are bright on T1; pial can stick to them
- Failure mode: red line follows a vessel rather than cortical boundary

**5. Thickness sanity check**
- Use `mris_anatomical_stats` or check `?h.thickness` distribution
- Mean thickness should be 2.3-2.7mm; max in any region <5mm
- If mean thickness is wildly off, pial likely has systematic errors

### Verdict options
- **OK** → done with QC, processing complete
- **Local pial errors in 1-3 places** → edit `brain.finalsurfs.mgz`
  (paint in non-brain values where pial leaked into dura), then re-run
  with `-pial -autorecon3`
- **Many regions with dura inclusion** → likely brainmask issue at
  QC1; edit `brainmask.mgz`, then re-run from `-autorecon2 -autorecon3`
  (this is expensive — only do for severe cases)
- **Sulcal CSF cutting** → re-run `-pial` with T2 or FLAIR if
  available (`-T2pial` or `-FLAIRpial`); often resolves sulcal CSF
  issues
- **Severe failure** → consider rejecting subject or marking ROIs as
  unreliable

See `editing/surface_edit.md` and `editing/brainmask_edit.md`.

---

## Cross-node failure patterns

If you see issues at multiple QC nodes, the root cause is usually
upstream. Symptoms and likely causes:

| Pattern | Likely root cause | Fix at |
|---|---|---|
| QC1 looks OK but QC3 has surface bleeding into GM | wm.mgz holes | QC2: edit wm.mgz |
| QC1 has dura inclusion AND QC4 has pial leaking into dura | brainmask.mgz | QC1: edit brainmask |
| QC2 OK but QC3 has spikes in random places | Topology defects | After step 20: check Euler number |
| QC4 has pial cutting sulcal CSF in many places | Suboptimal T1 contrast | Re-run with T2/FLAIR |
| All 4 QCs look noisy | Severe motion or low-quality T1 | Reject subject |

When a downstream QC fails, always consider whether to fix at the
current node or go back to the upstream root cause. Going back is more
expensive in compute time but produces cleaner results.

---

## What the agent does at each QC node

1. Give viewer startup command + file-loading instructions (from `snapshot_commands.md`)
2. List the "What to check, in order" items for that node (relayed from this document)
3. Wait for the user's verdict
4. Branch on the verdict (continue / edit / re-run)

The agent does NOT make pass/fail decisions. The agent only describes
what to look for and quotes the checklist verbatim. The user decides.
