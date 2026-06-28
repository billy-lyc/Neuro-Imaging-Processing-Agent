# FreeSurfer QC: Protocol

This document describes the **complete QC workflow** at each of the 4 QC
nodes. It ties together:
- Viewer setup (from `snapshot_commands.md`)
- Visual checklist (from `qc_checklist.md`)
- User decision flow (continue / edit / re-run)
- Editing handoff (to `editing/*`)
- Resume after edit (commands from `command_mapping.md`)

This is the canonical reference for the agent during a QC pause.

**FreeSurfer version:** 7.x

---

## Core principle

QC is **human-driven**. The agent's role is:

1. Open the web viewer with the correct files for this QC node
2. Relay the viewer file-loading instructions to the user
3. Relay the relevant checklist items
4. Wait for the user's verdict
5. Execute the appropriate next command based on verdict

The agent does NOT decide pass/fail. The user decides.

---

## Standard QC node procedure

This 5-step procedure is followed at every QC node. Specifics vary per
node (see "Per-node specifics" below).

### Step 1: Start the viewer and load QC files

The agent gives the user the viewer startup command and the exact files
to load for this QC node (from `snapshot_commands.md`). If the viewer
is already running from a previous step, just tell the user which files
to load or reload.

For QC1 and QC2 (volumetric, files in `mri/`):
```bash
# SKILL_DIR: set to the freesurfer skill base directory (from skill invocation context)
VIEWER="${SKILL_DIR}/freeview_skill/start_viewer.sh"
bash "$VIEWER" "$SUBJECTS_DIR/$SUBJECT/mri"
```

For QC3 and QC4 (need surface files from `surf/`):
```bash
$VIEWER $SUBJECTS_DIR/$SUBJECT
```

Then tell the user which `data/` URLs to load in Scene Details (per
`snapshot_commands.md` for this node).

### Step 2: Tell the user what to look at

After giving the viewer instructions, briefly name the views most useful
for this node:
- QC1/QC2 (volumetric): coronal is most informative; also check axial and sagittal
- QC3/QC4 (surface): coronal is most informative for surface QC

### Step 3: Relay the checklist

The agent posts the "What to check, in order" items from `qc_checklist.md`
for this node. Format as a numbered list so the user can step through
them.

Include a sentence at the end:
> "Reply with: **OK** to continue, **edit** to make manual edits, or
> describe what you see if you're unsure."

### Step 4: Wait for user verdict

The agent waits for the user's reply. Possible verdicts:

| User says | Meaning | Agent action |
|---|---|---|
| "OK" / "looks good" / "continue" | Pass | Run resume command for this node |
| "edit" / "needs editing" / describes a fix | Fail, fix needed | Hand off to relevant `editing/*` doc |
| "re-run" / "re-do step X" | Suspect upstream issue | Re-run with `-clean-*` or upstream stage flag |
| "skip this subject" / "reject" | Unrecoverable | Mark subject as failed, stop processing |
| Asks a question | Needs clarification | Answer using `qc_checklist.md`, then re-prompt for verdict |

### Step 5: Branch on verdict

**If pass:**
The agent runs the resume command for the next stage. See "Per-node
specifics" below for the exact command at each node.

**If edit needed:**
The agent points the user to the relevant editing doc. Once user
confirms editing is done, the agent runs the appropriate resume
command (also in "Per-node specifics" below).

**If re-run needed:**
The agent diagnoses the issue (asks the user what looks wrong, or
inspects logs), then runs the upstream stage with appropriate
`-clean-*` flag.

**If rejected:**
The agent stops and reports the failure. No further processing.

---

## Per-node specifics

### QC1 (after autorecon1)

**Input state:** `mri/brainmask.mgz` exists. Subject directory has
autorecon1 outputs.

**Viewer setup:** see `snapshot_commands.md` QC1 section.
Start viewer with `$SUBJECTS_DIR/$SUBJECT/mri`. Load `data/T1.mgz` +
`data/brainmask.mgz` (heat colormap, opacity 0.3). Review axial, coronal,
sagittal — coronal first.

**Checklist relayed from `qc_checklist.md` (QC1 section):**
1. Temporal poles
2. Orbitofrontal cortex
3. Cerebellum and brainstem
4. Superior sagittal sinus / dura
5. Eye and optic nerve

**Verdict branches:**

| Verdict | Resume command |
|---|---|
| OK | `recon-all -s $SUBJECT -autorecon2-volonly` |
| Edit brainmask | Hand off to `editing/brainmask_edit.md`. After edit: `recon-all -s $SUBJECT -autorecon2-volonly` (recon-all auto-detects edited brainmask) |
| Re-run skull strip | `recon-all -s $SUBJECT -clean-bm -gcareg -careg -calabel -normalization2 -maskbfs -autorecon2-volonly` (force-redo skull strip with potentially different params, e.g., `-3T`) |
| Reject | Stop, report failure to user |

### QC2 (after autorecon2-volonly)

**Input state:** `mri/wm.mgz` exists. Subject has autorecon1 + autorecon2
through step 15.

**Viewer setup:** see `snapshot_commands.md` QC2 section.
Start viewer with `$SUBJECTS_DIR/$SUBJECT/mri`. Load `data/brain.mgz` +
`data/wm.mgz` (lut colormap, opacity 0.4). Review coronal, axial,
sagittal — coronal first.

**Checklist relayed from `qc_checklist.md` (QC2 section):**
1. Deep white matter
2. Insular and temporal WM
3. WM near subcortical structures
4. Cerebellum
5. Brainstem

**Verdict branches:**

| Verdict | Resume command |
|---|---|
| OK | `recon-all -s $SUBJECT -autorecon2-wm` (continues to white surface) |
| Edit wm.mgz directly | Hand off to `editing/wm_edit.md`. After edit: `recon-all -s $SUBJECT -autorecon2-wm` |
| Add control points | Hand off to `editing/wm_edit.md` (control point section). After edit: `recon-all -s $SUBJECT -autorecon2-cp` |
| Re-run from intensity normalization | `recon-all -s $SUBJECT -normalization2 -autorecon2-wm` |
| Reject | Stop, report failure |

### QC3 (after autorecon2-wm / end of autorecon2)

**Input state:** `surf/?h.white.preaparc` exists. Subject has full
autorecon2 outputs.

**Viewer setup:** see `snapshot_commands.md` QC3 section.
Start viewer with `$SUBJECTS_DIR/$SUBJECT` (subject root, not mri/).
Load `data/mri/brain.mgz` + both `data/surf/lh.white.preaparc` and
`data/surf/rh.white.preaparc` (yellow edges). Review in coronal.

**Checklist relayed from `qc_checklist.md` (QC3 section):**
1. Smoothness of the boundary
2. Regions of intensity inhomogeneity
3. Insular cortex
4. Temporal pole
5. Cross-hemisphere comparison

**Verdict branches:**

| Verdict | Resume command |
|---|---|
| OK | `recon-all -s $SUBJECT -autorecon3` |
| Local surface error → edit wm.mgz | Hand off back to `editing/wm_edit.md` (this is QC2 territory). After edit: `recon-all -s $SUBJECT -autorecon2-wm` (then re-do QC3) |
| Pervasive issues → check topology | Run `mris_euler_number surf/lh.orig` and `surf/rh.orig`. If not 2, re-run `-fix -white -smooth2 -inflate2`. Then re-do QC3 |
| Severe failure | Go back to QC1 (brainmask) — likely a skull-strip root cause |
| Reject | Stop, report failure |

**Note:** QC3 failures are almost always fixed at QC2 (wm.mgz). Direct
surface edits at this stage are rare.

### QC4 (after autorecon3 pial step / end of autorecon3)

**Input state:** `surf/?h.pial` exists. Subject has full autorecon3
outputs (or at least through `-pial`).

**Viewer setup:** see `snapshot_commands.md` QC4 section.
Start viewer with `$SUBJECTS_DIR/$SUBJECT` (subject root). Load
`data/mri/brain.finalsurfs.mgz` + lh/rh white (yellow) and pial (red)
surfaces. Review in coronal.

**Checklist relayed from `qc_checklist.md` (QC4 section):**
1. Pial in superior frontal/parietal
2. Sulcal depths
3. Thin gyri
4. Vessels and venous sinuses
5. Thickness sanity check

**Verdict branches:**

| Verdict | Resume command |
|---|---|
| OK | Done. Final report. |
| Edit brain.finalsurfs.mgz (local pial fix) | Hand off to `editing/surface_edit.md`. After edit: `recon-all -s $SUBJECT -pial -autorecon3` (re-runs pial + downstream stats) |
| Brainmask root cause | Hand off back to QC1: `editing/brainmask_edit.md`. Then `recon-all -s $SUBJECT -autorecon2 -autorecon3` (full re-process from autorecon2) |
| Try T2/FLAIR for pial | If T2/FLAIR available: `recon-all -s $SUBJECT -T2 T2.nii.gz -T2pial -pial -autorecon3` |
| Mark unreliable | Annotate subject as needing manual ROI exclusion. Continue to final report. |

---

## QC pause framing

When the agent enters a QC pause, it should be explicit about it. Example:

```
QC1 checkpoint: Skull Strip
─────────────────────────────────

Please open the viewer and load the following files:

  Start viewer (on cluster):
    $VIEWER $SUBJECTS_DIR/sub-01/mri

  In Scene Details, load:
    data/T1.mgz             → background (grayscale)
    data/brainmask.mgz      → overlay (heat colormap, opacity 0.3)

  Review in coronal view first, then axial and sagittal.

Things to check:

1. **Temporal poles** — anterior tips of temporal lobes should be
   fully covered. Most common failure: poles cut off.
2. **Orbitofrontal cortex** — frontal lobe above the eyes. Common
   failure: cortex above orbits missing.
3. **Cerebellum and brainstem** — should extend down to foramen
   magnum. Common failure: cerebellar tonsils cut off.
4. **Superior sagittal sinus / dura** — top of brain along midline.
   Common failure: dura included as if it were brain.
5. **Eyes** — should NOT be in the mask. Common failure: eyeball
   included.

Reply with:
- **OK** to continue to white matter segmentation
- **edit** if you want to manually fix the brainmask
- Or describe what you see if you're unsure.
```

This format gives the user everything they need: viewer instructions,
ranked checklist, and explicit verdict prompt.

---

## Special situations

### User wants to skip QC entirely

If the user says "skip QC, just run -all":

- Acknowledge the trade-off: "Skipping QC means errors won't surface
  until the end, after 5+ hours of processing."
- Run `recon-all -s $SUBJECT -i T1.nii.gz -all`
- After completion, optionally run all 4 snapshot blocks and present
  retrospectively (for the user to spot-check finished output).

### User wants to do only some QC nodes

E.g., "QC after autorecon1 and autorecon3, skip the middle ones":

- Honor the user's choice
- Run `recon-all -s $SUBJECT -autorecon1`, do QC1
- Then `recon-all -s $SUBJECT -autorecon2`, skip QC2/QC3
- Then `recon-all -s $SUBJECT -autorecon3`, do QC4
- Note: skipping QC2/QC3 means edits to wm.mgz can't be made before the
  white surface is generated. Edits at QC4 may then require expensive
  re-runs from earlier stages.

### Viewer not accessible

If the user cannot reach the web viewer (tunnel not set up, port conflict,
etc.):

- Help them set up the SSH tunnel: `ssh -L 8888:127.0.0.1:8888 <user>@<login-node>` (use `whoami` and `hostname` on the cluster to fill in)
- As a fallback, generate a quick freeview screenshot using the commands
  in `snapshot_commands.md` (fallback section for that QC node) and
  display the resulting PNG
- Never proceed past a QC node without either viewer access OR an explicit
  user "OK without visual review"

### Multiple sequential edits needed

If the user makes one edit, runs the resume command, and the next QC
still fails:

- Treat each QC pause as a fresh decision point
- Keep snapshots from previous iterations (don't overwrite — append
  iteration number: `qc1_brainmask_coronal_v2.png`)
- After 3+ failed iterations on the same node, suggest the root cause
  may be upstream, or recommend rejecting the subject

---

## Logging the QC trail

For reproducibility, the agent should log the QC verdicts. After each
node, append a line to `$QC_DIR/qc_log.txt`:

```bash
echo "$(date -Iseconds) QC1 verdict: OK (no edits)" >> $QC_DIR/qc_log.txt
echo "$(date -Iseconds) QC1 verdict: edit (brainmask, removed dura at vertex)" >> $QC_DIR/qc_log.txt
```

This produces an audit trail the user can refer to later.

---

## Summary: agent's QC mental loop

```
[At every QC node]
  ↓
Give user viewer startup command + file-loading instructions
(from snapshot_commands.md for this node)
  ↓
User opens viewer and loads files
  ↓
Relay checklist (5 items, ranked)
  ↓
Prompt for verdict
  ↓
Wait for user reply
  ↓
[Verdict in]
  ├─ OK     → resume command, advance to next stage
  ├─ Edit   → editing/* doc handoff, then resume command
  ├─ Re-run → upstream stage with -clean-*, then re-do this QC
  └─ Reject → stop pipeline, report failure
  ↓
Log verdict to qc_log.txt
  ↓
[Continue to next stage or QC node]
```

This loop is the heart of the FreeSurfer skill's QC behavior.
