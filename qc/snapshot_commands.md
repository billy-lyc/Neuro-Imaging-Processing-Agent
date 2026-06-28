# QC Viewer Setup

Which files to inspect at each of the 4 QC nodes, and how to open them in the
platform's **Medical Image Viewer panel**. The panel SCPs/streams the files from
Longleaf for you — just pass absolute paths.

**FreeSurfer version:** 7.x

Do **NOT** use `start_viewer.sh`, `uvicorn`, SSH tunnels, or `localhost:PORT` —
that is the retired local-dev flow.

Routing per node:
- **QC1 / QC2** are volume-on-volume overlays → **FreeView Online** via
  `medical_viewer_open(tool="freeview", files=[...])` (loads both volumes, layered).
- **QC3 / QC4** overlay a FreeSurfer **surface** on a volume. FreeView Online is
  NiiVue-based and cannot load FreeSurfer binary surfaces, so use **native FreeView
  in VNC** (real surface-edge-on-slice QC) via the `vnc-tools` skill, or a 3D
  **PyVista** surface render.

---

## QC1: Skull Strip (after autorecon1)
**Goal:** brainmask covers all brain tissue and excludes skull/dura.
```
medical_viewer_open(tool="freeview", files=[
  "$SUBJECTS_DIR/$SUBJECT/mri/T1.mgz",
  "$SUBJECTS_DIR/$SUBJECT/mri/brainmask.mgz"])
```
Tell the user: set `brainmask.mgz` to a heat colormap at ~0.3 opacity over the
grayscale `T1.mgz`, and review in **coronal** (most informative for temporal poles).

---

## QC2: White Matter Segmentation (after autorecon2-volonly)
**Goal:** `wm.mgz` captures all white matter, no subcortical/ventricle.
```
medical_viewer_open(tool="freeview", files=[
  "$SUBJECTS_DIR/$SUBJECT/mri/brain.mgz",
  "$SUBJECTS_DIR/$SUBJECT/mri/wm.mgz"])
```
Tell the user: `wm.mgz` as lut/heat colormap at ~0.4 opacity, review **coronal**
(insular and temporal WM).

---

## QC3: White Surface (after autorecon2-wm)
**Goal:** the white surface follows the GM/WM boundary smoothly.
FreeView Online can't overlay surfaces — open **native FreeView in VNC** with the
brain volume + both white surfaces, via the `vnc-tools` skill:
```
viz_api(endpoint="api/vnc/switch", body={"app": "freeview"})
# then the panel's FreeView (VNC) loads:
#   $SUBJECTS_DIR/$SUBJECT/mri/brain.mgz  (volume)
#   surf/lh.white.preaparc, surf/rh.white.preaparc  (yellow edges, thickness 2)
```
Review in **coronal**. (Alternative quick 3D look:
`medical_viewer_open(tool="pyvista", files=["$SUBJECTS_DIR/$SUBJECT/surf/lh.white.preaparc"])`.)

---

## QC4: Pial Surface (after autorecon3)
**Goal:** the pial surface follows the GM/CSF boundary, no dura/vessel leak, no
sulcal-CSF cutting.
Open **native FreeView in VNC** with `brain.finalsurfs.mgz` + white(yellow) +
pial(red) surfaces for both hemispheres (`vnc-tools` skill, app `freeview`).
Review in **coronal**.

---

## After the user has inspected the viewer
1. Relay the relevant checklist from `qc/qc_checklist.md` for this node.
2. Wait for the user's verdict (OK / edit / re-run / reject).
3. Branch on verdict per `qc/qc_protocol.md`.
4. Log the verdict to `$QC_DIR/qc_log.txt`.

The user drives all pass/fail decisions — the agent only opens the viewer with
the right files and presents the checklist.
