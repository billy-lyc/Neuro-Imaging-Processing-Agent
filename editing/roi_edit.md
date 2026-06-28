# ROI Edit

Binary mask drawing for defining regions of interest. Results are saved
as a new `.nii.gz` overlay — the source file is never modified.

**Viewer:** FreeView Online (web-based, runs on the cluster)
**Mode to use:** ROI Edit

---

## When to use

- Demonstrating a specific region to another person
- Defining an ROI for downstream analysis (e.g., masking, stats)
- Creating a binary inclusion/exclusion mask
- Illustrating a FreeSurfer error region for discussion

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
2. Click **Create Drawing Layer** → select **ROI Edit** mode
3. Pen value is fixed at **1** (binary mask)
4. Draw the region in any slice view
5. Click **Save Drawing** — saves as a new `.nii.gz` file

---

## Notes

- ROI Edit output is always binary (0/1)
- Use Voxel Edit instead if you need multiple labeled regions
- The saved `.nii.gz` can be loaded into other tools (FSL, ANTs, Python)
  for further analysis
