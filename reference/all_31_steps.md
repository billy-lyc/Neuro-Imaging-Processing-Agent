# FreeSurfer recon-all: All 31 Steps Reference

This document is the ground-truth reference for every step in `recon-all`. Each
entry lists the recon-all flag, stage, underlying command(s) with full
parameters, inputs, outputs, purpose, and (where relevant) QC and editing hooks.

**Notation:**
- `?h` means both `lh` and `rh` (run for each hemisphere)
- All paths are relative to `$SUBJECTS_DIR/<subject>/` unless otherwise noted
- Atlas files in `$FREESURFER_HOME/average/` may have date suffixes that vary
  by FreeSurfer version (e.g., `RB_all_2016-05-10.vc700.gca`); use whichever
  exists in your installation
- "QC node" marks the 4 standard human-inspection points
- "Edit hook" marks where manual edits can be inserted before re-running

**Before any manual command:**
```bash
export SUBJECTS_DIR=/path/to/subjects
export SUBJECT=subject01
source $FREESURFER_HOME/SetUpFreeSurfer.sh
cd $SUBJECTS_DIR/$SUBJECT
```

---

## Stage 1: autorecon1 (Steps 1-5)

Preprocessing of the raw T1: motion correction, intensity normalization,
Talairach registration, and skull stripping.

### Step 1: Motion Correction and Conform
- **Flag:** `-motioncor`
- **Input:** `mri/orig/001.mgz` (and 002.mgz, 003.mgz... if multiple T1s)
- **Output:** `mri/rawavg.mgz`, `mri/orig.mgz`
- **Purpose:** Average multiple T1 acquisitions via rigid registration to
  improve SNR; conform output to 256³, 1mm isotropic, LIA orientation.

**Command (full):**
```bash
# Single T1: just conform
mri_convert mri/orig/001.mgz mri/rawavg.mgz
mri_convert mri/rawavg.mgz mri/orig.mgz --conform

# Multiple T1s: motion-correct + average first
mri_motion_correct2 -o mri/rawavg.mgz -wild mri/orig/0*.mgz
mri_convert mri/rawavg.mgz mri/orig.mgz --conform

# Either case: add identity Talairach to header
mri_add_xform_to_header -c \
  $SUBJECTS_DIR/$SUBJECT/mri/transforms/talairach.xfm \
  mri/orig.mgz mri/orig.mgz
```

### Step 2: NU Intensity Correction
- **Flag:** `-nuintensitycor`
- **Input:** `mri/orig.mgz`
- **Output:** `mri/nu.mgz`
- **Purpose:** Correct B1 inhomogeneity (bias field) so tissue intensities are
  spatially uniform. Critical for downstream segmentation.

**Command (full):**
```bash
mri_nu_correct.mni --no-rescale --i mri/orig.mgz --o mri/orig_nu.mgz \
  --ants-n4 --n 1 --proto-iters 1000 --distance 50

mri_add_xform_to_header -c \
  $SUBJECTS_DIR/$SUBJECT/mri/transforms/talairach.xfm \
  mri/orig_nu.mgz mri/nu.mgz
```

### Step 3: Talairach Transform Computation
- **Flag:** `-talairach`
- **Input:** `mri/nu.mgz`
- **Output:** `mri/transforms/talairach.auto.xfm`, `mri/transforms/talairach.xfm`
- **Purpose:** Compute affine transform from subject space to MNI305 Talairach
  space. Used as initial alignment for atlas-based steps later.

**Command (full):**
```bash
talairach_avi --i mri/nu.mgz --xfm mri/transforms/talairach.auto.xfm
cp mri/transforms/talairach.auto.xfm mri/transforms/talairach.xfm

# Optional: visual QA against MNI305 average
tal_QC_AZS mri/transforms/talairach.xfm
```

### Step 4: Intensity Normalization 1
- **Flag:** `-normalization`
- **Input:** `mri/nu.mgz`
- **Output:** `mri/T1.mgz`
- **Purpose:** Normalize white matter intensity to 110 across the volume.
  Establishes a uniform intensity reference for segmentation.

**Command (full):**
```bash
mri_normalize -g 1 -seed 1234 -mprage mri/nu.mgz mri/T1.mgz
```

### Step 5: Skull Stripping ★ QC1
- **Flag:** `-skullstrip`
- **Input:** `mri/T1.mgz`, `mri/nu.mgz`
- **Output:** `mri/brainmask.auto.mgz`, `mri/brainmask.mgz`
- **Purpose:** Remove skull, scalp, eyes, dura, leaving brain only.
- **QC node: QC1** — Visual check required before autorecon2.
- **Edit hook:** `brainmask.mgz` can be manually edited in freeview to add back
  removed brain or remove residual non-brain tissue.

**Command (full):**
```bash
# Step 5a: Atlas-based skull registration (provides skull prior)
mri_em_register -skull mri/nu.mgz \
  $FREESURFER_HOME/average/RB_all_withskull_2016-05-10.vc700.gca \
  mri/transforms/talairach_with_skull.lta

# Step 5b: Watershed skull strip with atlas prior
mri_watershed -T1 -brain_atlas \
  $FREESURFER_HOME/average/RB_all_withskull_2016-05-10.vc700.gca \
  mri/transforms/talairach_with_skull.lta \
  mri/T1.mgz mri/brainmask.auto.mgz

cp mri/brainmask.auto.mgz mri/brainmask.mgz
```

> **Why this needs QC:** Skull stripping is the most common failure point in
> FreeSurfer. The watershed + atlas hybrid usually works but can over-strip
> temporal poles, orbitofrontal cortex, or cerebellar tonsils, and can
> under-strip dura near the superior sagittal sinus. Errors here propagate
> into every downstream step. See `qc/qc_checklist.md` for what to look for.

---

## Stage 2: autorecon2 (Steps 6-23)

Subcortical segmentation, white matter segmentation, surface tessellation,
topology fixing, and white surface generation.

### Step 6: EM Registration
- **Flag:** `-gcareg`
- **Input:** `mri/nu.mgz`, `mri/brainmask.mgz`, GCA atlas
- **Output:** `mri/transforms/talairach.lta`
- **Purpose:** Linear registration to Gaussian Classifier Atlas (GCA) using
  expectation-maximization on tissue mixture model.

**Command (full):**
```bash
mri_em_register -uns 3 -mask mri/brainmask.mgz \
  mri/nu.mgz \
  $FREESURFER_HOME/average/RB_all_2016-05-10.vc700.gca \
  mri/transforms/talairach.lta
```

### Step 7: CA Normalize
- **Flag:** `-canorm`
- **Input:** `mri/nu.mgz`, `talairach.lta`, GCA atlas
- **Output:** `mri/norm.mgz`, `mri/ctrl_pts.mgz`
- **Purpose:** Atlas-guided second intensity normalization. Selects control
  points in white matter and renormalizes locally for tighter intensity
  uniformity than Step 4.

**Command (full):**
```bash
mri_ca_normalize -c mri/ctrl_pts.mgz -mask mri/brainmask.mgz \
  mri/nu.mgz \
  $FREESURFER_HOME/average/RB_all_2016-05-10.vc700.gca \
  mri/transforms/talairach.lta \
  mri/norm.mgz
```

### Step 8: CA Register
- **Flag:** `-careg`
- **Input:** `mri/norm.mgz`, `mri/brainmask.mgz`, GCA atlas
- **Output:** `mri/transforms/talairach.m3z`
- **Purpose:** Compute nonlinear deformation field aligning subject to atlas.
  This is the slowest step in autorecon2 (often 1-2 hours).

**Command (full):**
```bash
mri_ca_register -nobigventricles \
  -T mri/transforms/talairach.lta \
  -align-after -mask mri/brainmask.mgz \
  mri/norm.mgz \
  $FREESURFER_HOME/average/RB_all_2016-05-10.vc700.gca \
  mri/transforms/talairach.m3z
```

### Step 9: Subcortical Segmentation (aseg)
- **Flag:** `-calabel` (this flag also triggers Step 10)
- **Input:** `mri/norm.mgz`, `talairach.m3z`, GCA atlas
- **Output:** `mri/aseg.auto_noCCseg.mgz`
- **Purpose:** Label 40+ subcortical structures (hippocampus, thalamus,
  putamen, pallidum, caudate, amygdala, lateral ventricles, etc.) via Bayesian
  classification with Markov Random Field smoothing.

**Command (full):**
```bash
mri_ca_label -relabel_unlikely 9 .3 -prior 0.5 -align \
  mri/norm.mgz \
  mri/transforms/talairach.m3z \
  $FREESURFER_HOME/average/RB_all_2016-05-10.vc700.gca \
  mri/aseg.auto_noCCseg.mgz
```

### Step 10: Corpus Callosum Segmentation
- **Flag:** part of `-calabel`
- **Input:** `mri/aseg.auto_noCCseg.mgz`
- **Output:** `mri/aseg.auto.mgz`, `mri/aseg.presurf.mgz`
- **Purpose:** Subdivide corpus callosum into 5 regions (anterior, mid-anterior,
  central, mid-posterior, posterior) using shape-based segmentation.

**Command (full):**
```bash
mri_cc -aseg aseg.auto_noCCseg.mgz \
  -o aseg.auto.mgz \
  -lta mri/transforms/cc_up.lta \
  $SUBJECT

cp mri/aseg.auto.mgz mri/aseg.presurf.mgz
```

### Step 11: Intensity Normalization 2
- **Flag:** `-normalization2`
- **Input:** `mri/norm.mgz`, `mri/aseg.presurf.mgz`, `mri/brainmask.mgz`
- **Output:** `mri/brain.mgz`
- **Purpose:** Third (and final) intensity normalization, now informed by
  subcortical segmentation. Produces the cleanest intensity volume.

**Command (full):**
```bash
mri_normalize -mprage \
  -aseg mri/aseg.presurf.mgz \
  -mask mri/brainmask.mgz \
  mri/norm.mgz mri/brain.mgz
```

### Step 12: Mask Brain Final Surfaces
- **Flag:** `-maskbfs`
- **Input:** `mri/brain.mgz`, `mri/brainmask.mgz`
- **Output:** `mri/brain.finalsurfs.mgz`
- **Purpose:** Produce the final masked volume that drives surface placement
  in steps 21 and 29. Edits to `brainmask.mgz` propagate here.

**Command (full):**
```bash
mri_mask -T 5 mri/brain.mgz mri/brainmask.mgz mri/brain.finalsurfs.mgz
```

### Step 13: WM Segmentation
- **Flag:** part of `-segmentation`
- **Input:** `mri/brain.mgz`
- **Output:** `mri/wm.seg.mgz`
- **Purpose:** Initial white matter segmentation using intensity thresholds
  derived from the normalized volume.

**Command (full):**
```bash
mri_segment -mprage mri/brain.mgz mri/wm.seg.mgz
```

### Step 14: Edit WM with ASeg ★ QC2
- **Flag:** part of `-segmentation`
- **Input:** `mri/wm.seg.mgz`, `mri/brain.mgz`, `mri/aseg.presurf.mgz`
- **Output:** `mri/wm.asegedit.mgz`, `mri/wm.mgz`
- **Purpose:** Refine white matter boundary using subcortical segmentation
  to fix systematic errors (e.g., thalamus mis-classified as WM).
- **QC node: QC2** — Visual check recommended before tessellation.
- **Edit hook:** `wm.mgz` is the most common manual-edit target. Use control
  points (in `mri/ctrl_pts.mgz`) or directly paint voxels in freeview.

**Command (full):**
```bash
# Use aseg to fix WM seg errors near subcortical structures
mri_edit_wm_with_aseg -keep-in \
  mri/wm.seg.mgz mri/brain.mgz mri/aseg.presurf.mgz \
  mri/wm.asegedit.mgz

# Pretessellation cleanup (removes voxel-level topology issues)
mri_pretess mri/wm.asegedit.mgz wm mri/norm.mgz mri/wm.mgz
```

> **Why this needs QC:** Errors in `wm.mgz` directly determine the white
> surface in Step 21. Common issues: white matter "holes" in deep regions
> (insula, basal ganglia border), missed WM in temporal lobe, or non-WM
> voxels included near ventricles. Adding control points and re-running from
> Step 11 fixes most issues.

### Step 15: Fill
- **Flag:** `-fill`
- **Input:** `mri/wm.mgz`, `talairach.lta`, `mri/aseg.auto_noCCseg.mgz`
- **Output:** `mri/filled.mgz`
- **Purpose:** Cut the corpus callosum and pons to disconnect hemispheres,
  fill internal holes in white matter, and label hemispheres (lh=255,
  rh=127). The filled volume is what gets tessellated.

**Command (full):**
```bash
mri_fill -a scripts/ponscc.cut.log \
  -xform mri/transforms/talairach.lta \
  -segmentation mri/aseg.auto_noCCseg.mgz \
  mri/wm.mgz mri/filled.mgz
```

> **Why this matters:** If hemispheres aren't fully separated here (e.g., a
> few voxels of CC remain connected), the tessellation in Step 16 will
> produce a single connected surface instead of two, which breaks everything
> downstream.

### Step 16: Tessellation
- **Flag:** `-tessellate`
- **Input:** `mri/filled.mgz`
- **Output:** `surf/?h.orig.nofix`
- **Purpose:** Convert WM voxel boundary into a triangular mesh. Each voxel
  face on the WM/non-WM boundary becomes two triangles. The `.nofix` suffix
  indicates topology has not yet been corrected.

**Command (full):**
```bash
# lh: label 255, rh: label 127
for hemi_label in "lh:255" "rh:127"; do
  hemi=${hemi_label%:*}
  label=${hemi_label#*:}

  mri_pretess mri/filled.mgz $label mri/norm.mgz \
    mri/filled-pretess${label}.mgz

  mri_tessellate mri/filled-pretess${label}.mgz $label \
    surf/${hemi}.orig.nofix

  rm mri/filled-pretess${label}.mgz

  mris_extract_main_component \
    surf/${hemi}.orig.nofix surf/${hemi}.orig.nofix
done
```

### Step 17: Smooth1
- **Flag:** `-smooth1`
- **Input:** `surf/?h.orig.nofix`
- **Output:** `surf/?h.smoothwm.nofix`
- **Purpose:** Smooth the staircase artifacts from voxel-grid tessellation
  without computing curvature (`-nw` = no write of curv files yet).

**Command (full):**
```bash
for hemi in lh rh; do
  mris_smooth -nw -seed 1234 \
    surf/${hemi}.orig.nofix surf/${hemi}.smoothwm.nofix
done
```

### Step 18: Inflate1
- **Flag:** `-inflate1`
- **Input:** `surf/?h.smoothwm.nofix`
- **Output:** `surf/?h.inflated.nofix`
- **Purpose:** Inflate the cortical surface (push gyri out, pull sulci in)
  to reveal topological defects for fixing in Step 20. Sulcal depth is not
  saved yet — that comes from the post-fix inflate2.

**Command (full):**
```bash
for hemi in lh rh; do
  mris_inflate -no-save-sulc \
    surf/${hemi}.smoothwm.nofix surf/${hemi}.inflated.nofix
done
```

### Step 19: QSphere
- **Flag:** `-qsphere`
- **Input:** `surf/?h.inflated.nofix`
- **Output:** `surf/?h.qsphere.nofix`
- **Purpose:** Quick (low-quality) spherical mapping used only as input to
  topology fixing. Faster than the full sphere of Step 24.

**Command (full):**
```bash
for hemi in lh rh; do
  mris_sphere -q -seed 1234 \
    surf/${hemi}.inflated.nofix surf/${hemi}.qsphere.nofix
done
```

### Step 20: Topology Fixer
- **Flag:** `-fix`
- **Input:** `surf/?h.qsphere.nofix`, `surf/?h.orig.nofix`
- **Output:** `surf/?h.orig`, `surf/?h.inflated`
- **Purpose:** Detect and patch topological defects (handles, holes) so the
  surface is genus-0 (Euler number = 2).

**Command (full):**
```bash
for hemi in lh rh; do
  cp surf/${hemi}.orig.nofix surf/${hemi}.orig
  cp surf/${hemi}.inflated.nofix surf/${hemi}.inflated

  mris_fix_topology -mgz -sphere qsphere.nofix \
    -ga -seed 1234 \
    $SUBJECT $hemi

  mris_euler_number surf/${hemi}.orig

  mris_remove_intersection surf/${hemi}.orig surf/${hemi}.orig
done
```

> **Why this matters:** Surface registration in Step 25 requires genus-0
> topology. A surface with even one handle cannot be unfolded to a sphere
> properly. The fixer log reports the number of defects found and fixed —
> typical subjects have 5-30 defects, mostly small. Many defects (>100) or
> a non-zero Euler number after fixing usually means a problem upstream
> (Step 14 or 15).

### Step 21: White Surface (preaparc) ★ QC3
- **Flag:** `-white`
- **Input:** `surf/?h.orig`, `mri/brain.finalsurfs.mgz`, `mri/wm.mgz`,
  `mri/aseg.presurf.mgz`
- **Output:** `surf/?h.white.preaparc`, `surf/?h.curv`, `surf/?h.area`
- **Purpose:** Refine the white surface to sub-voxel precision by deforming
  it to follow intensity gradients between WM and GM.
- **QC node: QC3** — Visual check at autorecon2 completion.
- **Edit hook:** Errors here usually require editing `wm.mgz` (back to
  Step 14) and re-running from `-segmentation` onwards.

**Command (full):**
```bash
for hemi in lh rh; do
  mris_make_surfaces -aseg aseg.presurf \
    -white white.preaparc \
    -noaparc -mgz \
    -T1 brain.finalsurfs \
    $SUBJECT $hemi
done
```

> **Why this needs QC:** The white surface drives cortical thickness
> measurement, so errors here directly bias your downstream stats. Common
> failures: surface dipping into deep WM (where T1 is inhomogeneous),
> surface bleeding into GM (where wm.mgz had holes), or surface getting
> stuck on vessels.

### Step 22: Smooth2
- **Flag:** `-smooth2`
- **Input:** `surf/?h.white.preaparc`
- **Output:** `surf/?h.smoothwm`
- **Purpose:** Smooth the refined white surface for the second inflation.

**Command (full):**
```bash
for hemi in lh rh; do
  mris_smooth -n 3 -nw -seed 1234 \
    surf/${hemi}.white.preaparc surf/${hemi}.smoothwm
done
```

### Step 23: Inflate2
- **Flag:** `-inflate2`
- **Input:** `surf/?h.smoothwm`
- **Output:** `surf/?h.inflated`, `surf/?h.sulc`
- **Purpose:** Final inflation that also computes and saves sulcal depth
  (`?h.sulc`). Sulcal depth is later used as a feature in surface
  registration.

**Command (full):**
```bash
for hemi in lh rh; do
  mris_inflate surf/${hemi}.smoothwm surf/${hemi}.inflated

  mris_curvature -thresh .999 -n -a 5 -w \
    -distances 10 10 \
    surf/${hemi}.inflated
done
```

---

## Stage 3: autorecon3 (Steps 24-31)

Spherical registration, parcellation, pial surface, and statistics.

### Step 24: Sphere
- **Flag:** `-sphere`
- **Input:** `surf/?h.inflated`
- **Output:** `surf/?h.sphere`
- **Purpose:** High-quality spherical mapping that minimizes metric
  distortion. The sphere is the canonical space for cross-subject
  comparison.

**Command (full):**
```bash
for hemi in lh rh; do
  mris_sphere -seed 1234 \
    surf/${hemi}.inflated surf/${hemi}.sphere
done
```

### Step 25: Surface Registration
- **Flag:** `-surfreg`
- **Input:** `surf/?h.sphere`, fsaverage folding atlas
- **Output:** `surf/?h.sphere.reg`
- **Purpose:** Align subject's sphere to fsaverage by warping based on
  curvature, sulcal depth, and average curvature features.

**Command (full):**
```bash
for hemi in lh rh; do
  mris_register -curv \
    surf/${hemi}.sphere \
    $FREESURFER_HOME/average/${hemi}.folding.atlas.acfb40.noaparc.i12.2016-08-02.tif \
    surf/${hemi}.sphere.reg
done
```

### Step 26: Jacobian White
- **Flag:** `-jacobian_white`
- **Input:** `surf/?h.white.preaparc`, `surf/?h.sphere.reg`
- **Output:** `surf/?h.jacobian_white`
- **Purpose:** Compute Jacobian determinant of the white-to-sphere map.
  Quantifies local areal distortion.

**Command (full):**
```bash
for hemi in lh rh; do
  mris_jacobian \
    surf/${hemi}.white.preaparc surf/${hemi}.sphere.reg \
    surf/${hemi}.jacobian_white
done
```

### Step 27: AvgCurv
- **Flag:** `-avgcurv`
- **Input:** `surf/?h.sphere.reg`, fsaverage curvature template
- **Output:** `surf/?h.avg_curv`
- **Purpose:** Resample the average curvature template onto the subject's
  surface.

**Command (full):**
```bash
for hemi in lh rh; do
  mrisp_paint -a 5 \
    $FREESURFER_HOME/average/${hemi}.folding.atlas.acfb40.noaparc.i12.2016-08-02.tif#6 \
    surf/${hemi}.sphere.reg \
    surf/${hemi}.avg_curv
done
```

### Step 28: Cortical Parcellation - DK Atlas
- **Flag:** `-cortparc`
- **Input:** `surf/?h.sphere.reg`, Desikan-Killiany classifier (.gcs)
- **Output:** `label/?h.aparc.annot`
- **Purpose:** Label 34 cortical regions per hemisphere using the
  Desikan-Killiany atlas. This is the default `aparc`.

**Command (full):**
```bash
for hemi in lh rh; do
  mris_ca_label \
    -l label/${hemi}.cortex.label \
    -aseg mri/aseg.presurf.mgz \
    -seed 1234 \
    $SUBJECT $hemi surf/${hemi}.sphere.reg \
    $FREESURFER_HOME/average/${hemi}.curvature.buckner40.filled.desikan_killiany.2010-03-25.gcs \
    label/${hemi}.aparc.annot
done
```

### Step 29: Pial Surface ★ QC4
- **Flag:** `-pial`
- **Input:** `surf/?h.white.preaparc`, `mri/brain.finalsurfs.mgz`,
  `label/?h.aparc.annot`, `mri/aseg.presurf.mgz`
- **Output:** `surf/?h.white` (final), `surf/?h.pial`,
  `surf/?h.thickness`, `surf/?h.curv.pial`, `surf/?h.area.pial`
- **Purpose:** Generate the pial (GM/CSF) surface and finalize the white
  surface. Cortical thickness is computed as the distance between
  corresponding vertices on white and pial surfaces.
- **QC node: QC4** — Visual check at autorecon3 completion.
- **Edit hook:** Pial errors are fixed by editing `brain.finalsurfs.mgz`
  (or `brainmask.mgz` and re-running from Step 12). Re-run with `-pial`
  flag only after editing.

**Command (full):**
```bash
for hemi in lh rh; do
  mris_make_surfaces \
    -orig_white white.preaparc \
    -orig_pial white.preaparc \
    -aseg aseg.presurf -mgz \
    -T1 brain.finalsurfs \
    $SUBJECT $hemi
done
```

> **Why this needs QC:** The pial surface is the most error-prone surface
> because it must follow the GM/CSF boundary, which is harder to detect
> than GM/WM. Common failures: pial leaking into dura (especially superior
> frontal and parietal), pial cutting into sulcal CSF (missing thin gyri),
> or pial sticking to vessels. Thickness measurements are invalid wherever
> the pial is wrong.

### Step 30: Cortical Ribbon and Volume
- **Flag:** `-cortribbon`
- **Input:** `surf/?h.white`, `surf/?h.pial`
- **Output:** `mri/ribbon.mgz`, `mri/?h.ribbon.mgz`, `surf/?h.volume`
- **Purpose:** Generate the GM ribbon volume (voxels between white and
  pial surfaces) and compute per-vertex GM volume.

**Command (full):**
```bash
mris_volmask --aseg_name aseg.presurf \
  --label_left_white 2 --label_left_ribbon 3 \
  --label_right_white 41 --label_right_ribbon 42 \
  --save_ribbon $SUBJECT

for hemi in lh rh; do
  mris_calc -o surf/${hemi}.volume \
    surf/${hemi}.area mul surf/${hemi}.thickness
done
```

### Step 31: Parcellation Statistics and Extended Segmentation

This is a cluster of recon-all flags executed sequentially. Each can be
re-run individually.

**31a — `-parcstats`** (DK atlas stats)
- Output: `stats/?h.aparc.stats`
- Purpose: Per-region thickness, area, volume, mean curvature, Gaussian
  curvature, folding index for the 34 DK regions.

```bash
for hemi in lh rh; do
  mris_anatomical_stats -th3 -mgz \
    -cortex label/${hemi}.cortex.label \
    -f stats/${hemi}.aparc.stats \
    -b -a label/${hemi}.aparc.annot \
    -c label/aparc.annot.ctab \
    $SUBJECT $hemi white
done
```

**31b — `-cortparc2`** (Destrieux atlas parcellation)
- Output: `label/?h.aparc.a2009s.annot`
- Purpose: Finer 75-region parcellation per hemisphere.

```bash
for hemi in lh rh; do
  mris_ca_label \
    -l label/${hemi}.cortex.label \
    -aseg mri/aseg.presurf.mgz \
    -seed 1234 \
    $SUBJECT $hemi surf/${hemi}.sphere.reg \
    $FREESURFER_HOME/average/${hemi}.CDaparc.atlas.acfb40.noaparc.i12.2016-08-02.gcs \
    label/${hemi}.aparc.a2009s.annot
done
```

**31c — `-parcstats2`** (Destrieux stats)
- Output: `stats/?h.aparc.a2009s.stats`

```bash
for hemi in lh rh; do
  mris_anatomical_stats -th3 -mgz \
    -cortex label/${hemi}.cortex.label \
    -f stats/${hemi}.aparc.a2009s.stats \
    -b -a label/${hemi}.aparc.a2009s.annot \
    -c label/aparc.annot.a2009s.ctab \
    $SUBJECT $hemi white
done
```

**31d — `-cortparc3`** (DKT atlas parcellation)
- Output: `label/?h.aparc.DKTatlas.annot`
- Purpose: DKT (Desikan-Killiany-Tourville) is a refined version of DK
  with cleaner boundaries.

```bash
for hemi in lh rh; do
  mris_ca_label \
    -l label/${hemi}.cortex.label \
    -aseg mri/aseg.presurf.mgz \
    -seed 1234 \
    $SUBJECT $hemi surf/${hemi}.sphere.reg \
    $FREESURFER_HOME/average/${hemi}.DKTatlas40.gcs \
    label/${hemi}.aparc.DKTatlas.annot
done
```

**31e — `-parcstats3`** (DKT stats)
- Output: `stats/?h.aparc.DKTatlas.stats`

```bash
for hemi in lh rh; do
  mris_anatomical_stats -th3 -mgz \
    -cortex label/${hemi}.cortex.label \
    -f stats/${hemi}.aparc.DKTatlas.stats \
    -b -a label/${hemi}.aparc.DKTatlas.annot \
    -c label/aparc.annot.DKTatlas.ctab \
    $SUBJECT $hemi white
done
```

**31f — `-aparc2aseg`** (volumetric mapping)
- Output: `mri/aparc+aseg.mgz`, `mri/aparc.a2009s+aseg.mgz`,
  `mri/aparc.DKTatlas+aseg.mgz`
- Purpose: Map cortical parcellations from surface to voxel space, merged
  with subcortical aseg.

```bash
mri_aparc2aseg --s $SUBJECT --volmask
mri_aparc2aseg --s $SUBJECT --volmask --a2009s
mri_aparc2aseg --s $SUBJECT --volmask --annot aparc.DKTatlas
```

**31g — `-segstats`** (final aseg stats)
- Output: `stats/aseg.stats`
- Purpose: Volume, mean intensity for each subcortical structure, plus
  eTIV, total brain volume, and other global measures.

```bash
mri_segstats --seg mri/aseg.mgz --sum stats/aseg.stats \
  --pv mri/norm.mgz --empty \
  --brainmask mri/brainmask.mgz \
  --brain-vol-from-seg --excludeid 0 --excl-ctxgmwm \
  --supratent --subcortgray \
  --in mri/norm.mgz --in-intensity-name norm \
  --in-intensity-units MR \
  --etiv --surf-wm-vol --surf-ctx-vol \
  --totalgray --euler \
  --ctab $FREESURFER_HOME/ASegStatsLUT.txt \
  --subject $SUBJECT
```

**31h — `-wmparc`** (WM parcellation)
- Output: `mri/wmparc.mgz`, `stats/wmparc.stats`
- Purpose: Label WM voxels by their nearest cortical parcellation region.

```bash
mri_aparc2aseg --s $SUBJECT \
  --labelwm --hypo-as-wm --rip-unknown \
  --volmask --o mri/wmparc.mgz \
  --ctxseg aparc+aseg.mgz

mri_segstats --seg mri/wmparc.mgz --sum stats/wmparc.stats \
  --pv mri/norm.mgz --excludeid 0 \
  --brainmask mri/brainmask.mgz \
  --in mri/norm.mgz --in-intensity-name norm \
  --in-intensity-units MR \
  --subject $SUBJECT --surf-wm-vol \
  --ctab $FREESURFER_HOME/WMParcStatsLUT.txt --etiv
```

**31i — `-balabels`** (Brodmann area labels)
- Output: `label/?h.BA*_exvivo.label`, `label/?h.BA_exvivo.thresh.annot`
- Purpose: Map ex vivo Brodmann area labels to subject space.

```bash
for hemi in lh rh; do
  for ba in BA1 BA2 BA3a BA3b BA4a BA4p BA6 BA44 BA45 V1 V2 MT \
            perirhinal entorhinal; do
    mri_label2label \
      --srcsubject fsaverage \
      --srclabel $SUBJECTS_DIR/fsaverage/label/${hemi}.${ba}_exvivo.label \
      --trgsubject $SUBJECT \
      --trglabel label/${hemi}.${ba}_exvivo.label \
      --hemi $hemi --regmethod surface
  done

  mris_label2annot --s $SUBJECT --hemi $hemi \
    --ctab $FREESURFER_HOME/average/colortable_BA.txt \
    --l label/${hemi}.BA1_exvivo.label \
    --l label/${hemi}.BA2_exvivo.label \
    --a BA_exvivo
done
```

**31j — `-hyporelabel`**
- Output: `mri/aseg.mgz` (final, with hypointensities)
- Purpose: Identify white matter hypointensities (potential WMH lesions).

```bash
mri_relabel_hypointensities mri/aseg.auto.mgz \
  surf mri/aseg.presurf.hypos.mgz
```

---

## Quick reference: step → flag → QC node

| # | Step | Flag | QC | Edit target |
|---|---|---|---|---|
| 1 | Motion correction | `-motioncor` | — | — |
| 2 | NU correction | `-nuintensitycor` | — | — |
| 3 | Talairach | `-talairach` | — | `talairach.xfm` (rare) |
| 4 | Normalize 1 | `-normalization` | — | — |
| 5 | Skull strip | `-skullstrip` | **QC1** | `brainmask.mgz` |
| 6 | EM register | `-gcareg` | — | — |
| 7 | CA normalize | `-canorm` | — | `ctrl_pts.mgz` |
| 8 | CA register | `-careg` | — | — |
| 9 | aseg label | `-calabel` | — | — |
| 10 | CC seg | `-calabel` | — | — |
| 11 | Normalize 2 | `-normalization2` | — | — |
| 12 | Mask BFS | `-maskbfs` | — | — |
| 13 | WM seg | `-segmentation` | — | — |
| 14 | WM aseg edit | `-segmentation` | **QC2** | `wm.mgz`, `ctrl_pts.mgz` |
| 15 | Fill | `-fill` | — | `filled.mgz` (rare) |
| 16 | Tessellate | `-tessellate` | — | — |
| 17 | Smooth1 | `-smooth1` | — | — |
| 18 | Inflate1 | `-inflate1` | — | — |
| 19 | QSphere | `-qsphere` | — | — |
| 20 | Fix topology | `-fix` | — | — |
| 21 | White surface | `-white` | **QC3** | `wm.mgz` (back to 14) |
| 22 | Smooth2 | `-smooth2` | — | — |
| 23 | Inflate2 | `-inflate2` | — | — |
| 24 | Sphere | `-sphere` | — | — |
| 25 | Surface reg | `-surfreg` | — | — |
| 26 | Jacobian | `-jacobian_white` | — | — |
| 27 | AvgCurv | `-avgcurv` | — | — |
| 28 | DK parcellation | `-cortparc` | — | — |
| 29 | Pial surface | `-pial` | **QC4** | `brain.finalsurfs.mgz` |
| 30 | Cortical ribbon | `-cortribbon` | — | — |
| 31a | DK stats | `-parcstats` | — | — |
| 31b | Destrieux parc | `-cortparc2` | — | — |
| 31c | Destrieux stats | `-parcstats2` | — | — |
| 31d | DKT parc | `-cortparc3` | — | — |
| 31e | DKT stats | `-parcstats3` | — | — |
| 31f | aparc2aseg | `-aparc2aseg` | — | — |
| 31g | seg stats | `-segstats` | — | — |
| 31h | wmparc | `-wmparc` | — | — |
| 31i | BA labels | `-balabels` | — | — |
| 31j | Hypo relabel | `-hyporelabel` | — | — |

---

## Notes on running individual steps

**Re-running a step:** Just call `recon-all -s <subject> -<flag>`. recon-all
will check for required inputs and run only that step. Subsequent steps that
depend on it will need to be re-run manually.

**Resume from a step:** Use `-make all` after a partial run to continue from
where it stopped (recon-all parses `recon-all-status.log` to determine
position).

**Manual command vs flag form:** The full commands above are useful for
debugging or substituting custom algorithms, but the atlas filenames
(`RB_all_*.gca`, `?h.folding.atlas.*.tif`) have date suffixes that change
between FreeSurfer releases. The `recon-all -<flag>` form auto-resolves these
paths and is more robust across versions. Prefer flags unless you have a
specific reason for raw commands.

**Per-step timing (approximate, modern CPU, single-threaded):**
- Steps 1-5 (autorecon1): 10-20 min total
- Steps 6-23 (autorecon2): 3-6 hours (Step 8 dominates at 1-2h)
- Steps 24-31 (autorecon3): 1-2 hours
- Total: 5-10 hours; 2-4 hours with `-parallel -openmp 4`
