# View Images / Surfaces in the Visualization Panel

**Use this workflow when** the user wants to inspect imaging volumes (MGZ/NIfTI)
or FreeSurfer surfaces — without running `recon-all`. The platform's **Medical
Image Viewer panel** loads the file directly (it SCPs/streams from Longleaf for
you). Do **NOT** start a local viewer, an `uvicorn`/`start_viewer.sh` server, or
print SSH-tunnel / `localhost:PORT` instructions — that is the old local-dev
flow and no longer applies.

---

## Step 1 — Classify each file

- **Imaging volume** — `.mgz`, `.mgh`, `.nii`, `.nii.gz`
  (e.g. `brainmask.mgz`, `wm.mgz`, `aseg.mgz`, `T1.mgz`, `orig.mgz`)
- **FreeSurfer surface / overlay** — `lh.white`, `?h.pial`, `?h.inflated`,
  `?h.white.preaparc`, `*.annot`, `*.thickness`, `*.curv`, `*.sulc`

---

## Step 2 — Open it in the panel (the file is injected automatically)

### Imaging volume → FreeView Online
Call the dispatcher with `tool="freeview"` and the absolute path(s):

```
medical_viewer_open(tool="freeview", files=["<abs path>", ...])
```

The Medical Image Viewer panel opens with the volume(s) **already loaded** in the
FreeView image viewer — exactly like "open `<file>` in FreeView". Pass Longleaf
absolute paths, e.g. `$SUBJECTS_DIR/<subject>/mri/brainmask.mgz`. Several volumes
can be passed together (they layer as overlays).

> ⚠️ **`files` is REQUIRED.** `medical_viewer_open(tool="freeview")` **without**
> `files` opens an EMPTY FreeView (nothing injected). Always pass every volume,
> e.g. `medical_viewer_open(tool="freeview", files=["$SUBJECTS_DIR/<subj>/mri/T1.mgz", "$SUBJECTS_DIR/<subj>/mri/wm.mgz"])`.

### FreeSurfer surface / parcellation / scalar → PyVista
FreeView Online is NiiVue-based and **cannot read FreeSurfer binary surfaces**
(`lh.pial`, `*.annot`, …). Render those with PyVista instead:

```
# a single mesh/surface
medical_viewer_open(tool="pyvista", files=["<abs path to .pial / .vtk / .gii>"])

# parcellation or scalar overlay on a subject's surface
viz_api(endpoint="api/pyvista/qc-overlay",
        body={"subcommand": "annot",   "fs-dir": "$SUBJECTS_DIR/<subject>"})   # .annot parcellation
viz_api(endpoint="api/pyvista/qc-overlay",
        body={"subcommand": "fsstat",  "fs-dir": "$SUBJECTS_DIR/<subject>",
              "scalar": "thickness"})                                          # thickness/curv/sulc
```

(For an interactive native FreeView with surfaces overlaid on the volume, use the
`vnc-tools` skill to launch FreeView in VNC — but for plain volume/surface
inspection prefer the panel calls above.)

---

## Step 3 — Tell the user what opened

State plainly which file(s) opened in which viewer (FreeView Online for volumes,
PyVista for surfaces/parcellations) and that the panel switched to it
automatically. No tunnels, no ports, no manual file-loading steps.
