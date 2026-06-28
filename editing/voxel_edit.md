# Voxel Edit

Free-form voxel annotation for marking regions of interest, flagging
errors, or creating reference overlays. Results are saved as a new
overlay volume (`.nii.gz`) — the source file is never modified.

**Viewer:** FreeView Online (web-based, runs on the cluster)
**Mode to use:** Voxel Edit

---

## When to use

- Marking regions to inspect or discuss (e.g., "this temporal pole looks
  wrong — here's where")
- Creating a reference annotation alongside a Recon Edit
- Labeling specific structures for downstream analysis
- Any free-form annotation that should NOT overwrite a FreeSurfer file

---

## Starting the viewer

**On the cluster:**
```bash
# SKILL_DIR: set to the freesurfer skill base directory (from skill invocation context)
VIEWER="${SKILL_DIR}/freeview_skill/start_viewer.sh"
bash "$VIEWER" "$SUBJECTS_DIR/$SUBJECT/mri"
```

**On your local machine:**
```bash
ssh -L 8888:127.0.0.1:8888 <user>@<login-node>
# <user>: run `whoami` on the cluster; <login-node>: run `hostname` on the cluster
```

Open **`http://localhost:8888/`**.

---

## Editing

1. Load any number of volumes in Scene Details (e.g., `data/T1.mgz`, `data/brainmask.mgz`, etc.)
2. Click **Create Drawing Layer** → select **Voxel Edit** mode
3. Assign pen values 1–255 to label different structures
4. Use the **Labels** panel to give each value a name and color
5. Click **Save Drawing** — saves as a new `.nii.gz` overlay, does not
   touch the source

---

## Notes

- Voxel Edit output is a separate file, safe to delete or ignore
- Use labels to organize: e.g., value 1 = "missing cortex", value 2 =
  "skull residual"
- Can be combined with Recon Edit: annotate first to plan the edit, then
  switch to Recon Edit to fix
