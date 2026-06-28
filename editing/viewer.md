# FreeBrowse Viewer: Quick Start

Web-based replacement for freeview. Runs on the cluster, accessed via SSH tunnel.

## Start the viewer

**On the cluster:**
```bash
# SKILL_DIR: set to the freesurfer skill base directory (from skill invocation context)
VIEWER="${SKILL_DIR}/freeview_skill/start_viewer.sh"
bash "$VIEWER" "$SUBJECTS_DIR/$SUBJECT/mri/"
```

**On your local machine (separate terminal):**
```bash
ssh -L 8888:127.0.0.1:8888 <user>@<login-node>
# <user>: run `whoami` on the cluster; <login-node>: run `hostname` on the cluster
```

**Then open in browser:**
```
http://localhost:8888/?vol=data/FILE1.mgz&vol=data/FILE2.mgz
```

Replace `FILE1`, `FILE2` with the files needed for the current edit.
Files are relative to the subject's `mri/` directory.

## Editing modes

| Mode | Use for | Pen value | Saves to |
|------|---------|-----------|----------|
| **Recon Edit** | Binary volumes (brainmask, wm, brain.finalsurfs) | 255 = add, 1 = remove | Original file (in place) |
| **Recon Edit** | Multi-label volumes (aseg, aparc+aseg) | label ID = assign structure, 0 = erase | Original file (in place) |
| **Voxel Edit** | Free-form annotation, does not touch source | 1–255 (any label) | New `.nii.gz` overlay |
| **ROI Edit** | Binary region-of-interest mask | Fixed at 1 | New `.nii.gz` overlay |

Use **Recon Edit** for all standard FreeSurfer edits — it writes back
directly to the original file on save. For multi-label volumes, set the
pen value to the FreeSurfer label ID of the target structure.

## Saving

Click **Save & Write Back** when done. This overwrites the original
`.mgz` file in place. Then return to the agent and confirm.
