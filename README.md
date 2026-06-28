# FreeSurfer Skill for Claude Code

A Claude Code skill that guides you through FreeSurfer's `recon-all` cortical reconstruction pipeline — from environment setup through QC checkpoints to subfield segmentation.

**FreeSurfer version:** 7.x | **Skill version:** v1

---

## What this skill does

Invoke this skill when you want to:

- Run `recon-all` on a T1 MRI (single subject or batch)
- Generate cortical thickness, surface area, volume stats
- Produce cortical parcellations (Desikan-Killiany, Destrieux, DKT) or subcortical segmentation (aseg)
- Recover from a crashed or interrupted FreeSurfer run
- Edit intermediate files (`brainmask.mgz`, `wm.mgz`, surfaces)
- QC output at any of the 4 standard checkpoints
- Run subfield/subregion segmentation (hippocampus, amygdala, brainstem, thalamus, limbic, SynthSeg, SAMSEG)
- View MRI volumes or FreeSurfer surfaces in the FreeView web viewer

**Out of scope:** fMRI preprocessing, diffusion/TRACULA, lesion segmentation, longitudinal pipeline, group-level GLM.

---

## Trigger phrases

```
"Run FreeSurfer on sub-01"
"recon-all with QC"
"my pipeline crashed at step 14"
"edit the brainmask"
"segment hippocampus subfields"
"show me the pial surface"
"view this MGZ in freeview"
```

---

## Three execution modes

| Level | Mode | When |
|---|---|---|
| 1 | `recon-all -all` | Fire-and-forget, batch, validated subjects |
| 2 | `-autorecon1` / `-autorecon2*` / `-autorecon3` | Standard research with QC checkpoints |
| 3 | 31 individual step flags | Debugging, editing, custom substitution |

Modes are nested — real workflows mix levels freely.

---

## Default workflow: Level 2 with 4 QC checkpoints

Unless told otherwise, the skill runs the **standard single-subject workflow** (`workflows/default.md`):

```
autorecon1 → QC1 → autorecon2 → QC2 → (QC3) → autorecon3 → QC4 → stats
```

| QC node | After step | What to inspect |
|---|---|---|
| QC1 | Step 5 — skull strip | `mri/brainmask.mgz` |
| QC2 | Step 14 — WM segmentation | `mri/wm.mgz` |
| QC3 | Step 21 — white surface | `surf/?h.white.preaparc` |
| QC4 | Step 29 — pial surface | `surf/?h.pial` |

At each checkpoint the skill opens the web viewer, tells you what to look for, and waits for your verdict. **You decide pass/fail — the agent never does.**

---

## Subfield segmentation tools (12 supported)

After `recon-all` completes (or standalone with SynthSeg/SAMSEG):

| Tool | Script / command |
|---|---|
| Hippocampus + amygdala (T1) | `segmentHA_T1.sh` |
| Hippocampus + amygdala (T2-enhanced) | `segmentHA_T2.sh` |
| Brainstem (Gen 1) | `segmentBS.sh` |
| Thalamic nuclei (Gen 1) | `segmentThalamicNuclei.sh` |
| Thalamus / brainstem / hippo-amyg (Gen 2) | `segment_subregions` |
| Limbic structures / NAc / BNST | `mri_sclimbic_seg` |
| SynthSeg whole-brain | `mri_synthseg` |
| SynthSeg robust (low-quality input) | `mri_synthseg --robust` |
| SynthSeg + cortical parcellation | `mri_synthseg --parc` |
| Multi-contrast / lesions | `samseg` |

---

## Workflow routing

| Your intent | Workflow file |
|---|---|
| Single subject, standard + QC | `workflows/default.md` |
| Single subject, no QC | `recon-all -all` end-to-end |
| Many subjects | `workflows/batch.md` |
| Pipeline crashed | `workflows/resume.md` |
| Edit intermediate file | `editing/recon_edit.md` → resume |
| Run one specific step | `workflows/single_step.md` |
| View volumes/surfaces | `workflows/view_freeview.md` |
| Choose a subfield tool | `subfields/overview.md` |

---

## Key environment variables

The skill sets these at the start of every session:

```bash
$FREESURFER_HOME     # FreeSurfer installation root
$SUBJECTS_DIR        # Subject output directory
$SUBJECT             # Current subject ID
$QC_DIR              # /mnt/user-data/outputs/<subject>_qc/
```

`SetUpFreeSurfer.sh` is sourced automatically to put tools on PATH.

---

## Output locations

| Artifact | Path |
|---|---|
| Subject directory | `$SUBJECTS_DIR/<subject>/` |
| Surface + volume stats | `$SUBJECTS_DIR/<subject>/stats/*.stats` |
| QC audit log | `$QC_DIR/qc_log.txt` |

---

## Skill file layout

```
freesurfer/
├── SKILL.md                   Entry point and decision hub
├── reference/                 Command reference (all 31 steps, 3 modes, mapping)
├── qc/                        QC protocol, checklists, viewer commands
├── editing/                   brainmask / wm / surface / ROI edit procedures
├── workflows/                 Orchestration (default, batch, resume, single-step, view)
└── subfields/                 12 subfield segmentation tool guides
```

---

## What the skill will never do

- Decide QC pass/fail on your behalf
- Skip QC checkpoints silently in the default workflow
- Run `-all` without confirming you don't want QC
- Edit `brainmask.auto.mgz` (regenerated automatically; always edit `brainmask.mgz`)
- Start processing without verifying environment variables are set
