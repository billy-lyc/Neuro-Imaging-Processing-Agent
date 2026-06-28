# Recon Edit

Fix FreeSurfer intermediate volumes when the pipeline fails or produces
incorrect output. Edits are written back in place; the pipeline resumes
from the corrected file.

**Viewer:** FreeView Online (web-based, runs on the cluster)
**Mode to use:** Recon Edit

---

## When to invoke

At any pipeline stage where a volume is wrong:

| Failure at | File to edit | Resume command |
|---|---|---|
| QC1 — skull strip bad | `mri/brainmask.mgz` | `recon-all -s $SUBJECT -autorecon2-volonly` |
| QC2 — WM holes/over-seg | `mri/wm.mgz` | `recon-all -s $SUBJECT -autorecon2-wm` |
| QC3 — white surface wrong | `mri/wm.mgz` | `recon-all -s $SUBJECT -autorecon2-wm` |
| QC4 — pial leaking | `mri/brain.finalsurfs.mgz` | `recon-all -s $SUBJECT -pial -autorecon3` |
| Subcortical segmentation wrong | `mri/aseg.mgz` | `recon-all -s $SUBJECT -segstats` |
| Post-completion review | any of the above | see table above |

---

## Starting the viewer

**On the cluster**, run:
```bash
# SKILL_DIR: set to the freesurfer skill base directory (from skill invocation context)
VIEWER="${SKILL_DIR}/freeview_skill/start_viewer.sh"
bash "$VIEWER" "$SUBJECTS_DIR/$SUBJECT/mri"
```

**On your local machine**, open an SSH tunnel:
```bash
ssh -L 8888:127.0.0.1:8888 <user>@<login-node>
# <user>: run `whoami` on the cluster; <login-node>: run `hostname` on the cluster
```

Then open **`http://localhost:8888/`** in your browser.

---

## Loading files

In the viewer, go to the **Scene Details** tab and add volumes by URL.
You can load as many files as needed — there is no limit. Common URLs:

| File | URL |
|---|---|
| T1 | `data/T1.mgz` |
| Brainmask | `data/brainmask.mgz` |
| White matter | `data/wm.mgz` |
| Brain finalsurfs | `data/brain.finalsurfs.mgz` |
| Brain (normalized) | `data/brain.mgz` |
| Any other file | `data/<filename>` |

Load T1 first as the background reference, then add whichever additional
volumes are relevant for the current edit. For example, when fixing the
pial surface you might load T1 + brain.finalsurfs + brainmask all at once
to have full context.

---

## Editing

1. Click the **pencil icon** next to the volume you want to edit, or click
   **Create Drawing Layer** and select **Recon Edit** mode
2. Brush values follow FreeSurfer convention:
   - **255** — add tissue (include this voxel)
   - **1** — remove tissue (exclude this voxel)
3. Use all three slice views (axial, coronal, sagittal) to verify edits
4. Click **Save & Write Back** when done — this overwrites the original file

---

## Per-file guidance

### brainmask.mgz

**Over-stripping** (brain tissue removed — temporal poles, orbitofrontal, cerebellum):
- Paint with value **255** over the missing tissue, following T1 intensity

**Under-stripping** (skull, dura, eye visible):
- Paint with value **1** over non-brain tissue

Backup before editing:
```bash
cp mri/brainmask.mgz mri/brainmask.mgz.preEdit
```

Reference: `brainmask.auto.mgz` is the original auto-generated version.

---

### wm.mgz

**WM holes** (dark gaps inside the white matter mask):
- Paint with value **255** over the missing WM
- Use coronal view; verify in axial

**Over-segmentation** (thalamus, ventricle, non-WM included):
- Paint with value **1** to remove those voxels

Control points alternative: if holes are intensity-driven (inhomogeneity),
use control points instead of direct paint and resume with `-autorecon2-cp`.

Backup:
```bash
cp mri/wm.mgz mri/wm.mgz.preEdit
```

---

### aseg.mgz / aparc+aseg.mgz

Multi-label subcortical segmentation. Each structure has a unique integer
label ID displayed as a distinct color. Edit when subcortical boundaries
are wrong — hippocampus cut short, thalamus leaking into adjacent tissue,
ventricles over- or under-segmented.

**Key difference from binary edits:** pen value = the FreeSurfer label ID
of the structure you want to assign, not just 255/1. To fix a mislabeled
voxel, paint it with the correct label ID.

**Common label IDs:**

| Structure | Left | Right |
|---|---|---|
| Cerebral white matter | 2 | 41 |
| Lateral ventricle | 4 | 43 |
| Thalamus | 10 | 49 |
| Caudate | 11 | 50 |
| Putamen | 12 | 51 |
| Pallidum | 13 | 52 |
| Hippocampus | 17 | 53 |
| Amygdala | 18 | 54 |
| Accumbens | 26 | 58 |
| Background / erase | 0 | 0 |

**Procedure:**
1. Load `data/T1.mgz` as background, then `data/aseg.mgz` (or `data/aparc+aseg.mgz`)
2. Create Drawing Layer → **Recon Edit**
3. Look up the label ID of the target structure (table above or FreeSurfer LUT)
4. Set pen value to that label ID
5. Paint over the incorrectly labeled region
6. To erase mislabeled voxels back to background, set pen value to **0**
7. Click **Save & Write Back**

**Resume after aseg edit:**
```bash
# Regenerate stats from the edited segmentation
mri_segstats --seg mri/aseg.mgz --sum stats/aseg.stats \
  --pv mri/norm.mgz --empty --brainmask mri/brainmask.mgz \
  --brain-vol-from-seg --excludeid 0 --excl-ctxgmwm \
  --supratent --subcortgray --in mri/norm.mgz --in-intensity-name norm \
  --in-intensity-units MR --etiv --surf-wm-vol --surf-ctx-vol \
  --totalgray --euler --ctab $FREESURFER_HOME/ASegStatsLUT.txt \
  --subject $SUBJECT
```
Or simply re-run the stats step:
```bash
recon-all -s $SUBJECT -segstats
```

Backup:
```bash
cp mri/aseg.mgz mri/aseg.mgz.preEdit
```

---

### brain.finalsurfs.mgz

**Pial leaking into dura or vessels:**
- Paint with value **1** over the dura/vessel between white and pial surfaces
- Do NOT paint over actual cortex

Load the white and pial surfaces alongside the volume to see where the
surface is going wrong:
- `data/../surf/lh.white`, `data/../surf/lh.pial` (if the viewer supports surface overlays)

Backup:
```bash
cp mri/brain.finalsurfs.mgz mri/brain.finalsurfs.mgz.preEdit
```

---

## After editing

Tell the agent "edits done". The agent then runs the resume command for
the affected file (see table at top) and continues the pipeline.

---

## Cheat sheet

| Symptom | File | Pen value | Resume |
|---|---|---|---|
| Missing cortex | brainmask.mgz | 255 (add) | `-autorecon2-volonly` |
| Skull/dura in mask | brainmask.mgz | 1 (remove) | `-autorecon2-volonly` |
| WM holes | wm.mgz | 255 (add) | `-autorecon2-wm` |
| Non-WM included | wm.mgz | 1 (remove) | `-autorecon2-wm` |
| Pial leaking | brain.finalsurfs.mgz | 1 (remove) | `-pial -autorecon3` |
| Wrong subcortical label | aseg.mgz | label ID (e.g. 17 = L.hippo) | `-segstats` |
| Erase wrong label | aseg.mgz | 0 (background) | `-segstats` |
