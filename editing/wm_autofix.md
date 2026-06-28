# WM Autofix (automatic white-matter topology cleanup)

Fully-automatic cleanup of a `wm.mgz` white-matter segmentation — fills tiny
internal holes and removes small disconnected islands, the two defects that
create topological handles in `?h.white` and inflate the **Euler number**.
Use instead of `recon_edit.md` (manual brush) when the user wants it done
automatically. **Different logic from brainmask autofix** — see below.

**Script:** `editing/wm_autofix.py` (pure python: nibabel + scipy, no FS env needed)
**Resume after applying:** `recon-all -s <subj> -autorecon2-wm`

---

## When to invoke

- "Fix / clean up the white matter (wm.mgz) automatically"
- White surface has many **topological defects** / high Euler number
- `wm.mgz` has **internal holes** (dark gaps inside WM) or **speckle**
  (isolated WM voxels)

Needs `mri/wm.mgz` + `mri/T1.mgz`. Writes `wm.autofix.mgz` next to it;
never overwrites `wm.mgz`.

---

## What it does — and what it must NOT do

| Defect | Action | Lever |
|---|---|---|
| Tiny internal holes (intensity dips in solid WM) | **fill** → 255 | `--hole-max` (default 50 vox) |
| Small isolated WM blobs (false positives) | **delete** → 0 | `--island-min` (default 200 vox) |
| Large cavities (ventricle pockets / big defects) | **keep + report** for review | `--fill-big` to also fill them |

**Key difference from brainmask autofix:** a brainmask should be solid, so you
can fill all interior holes. A `wm.mgz` must **NOT** be fully hole-filled —
that would swallow the ventricles into white matter. So WM autofix only fills
holes **strictly smaller than `--hole-max`**, and prints the location (axial
slice) of every bigger cavity it kept, for the user to eyeball.

Edits follow FreeSurfer conventions: added WM = **255** (WM_EDITED_ON_VAL),
removed = **0**. The existing 110 / 250 WM values are left untouched.

---

## Run it

```bash
python3 "${SKILL_DIR}/editing/wm_autofix.py" --mri $SUBJECTS_DIR/$SUBJECT/mri

# tune the two thresholds, or also fill the big holes:
python3 "${SKILL_DIR}/editing/wm_autofix.py" --mri .../mri --hole-max 80 --island-min 100
python3 "${SKILL_DIR}/editing/wm_autofix.py" --mri .../mri --fill-big
```

Prints island/hole counts + each kept big-hole's size and axial slice; writes
`mri/wm.autofix.mgz` and QC montage `qc_wm/wm_autofix.png` (green = filled
holes, red = removed islands, orange = big holes kept).

---

## Let the user review (FreeView web viewer)

```bash
VD=$(mktemp -d); M=$SUBJECTS_DIR/$SUBJECT/mri
ln -s $M/T1.mgz $M/wm.mgz $M/wm.autofix.mgz "$VD"/
lsof -ti:9090 | xargs -r kill -9
bash "${SKILL_DIR}/freeview_skill/start_viewer.sh" "$VD" 9090 &
```

Have the user load `T1.mgz` + `wm.mgz` + `wm.autofix.mgz` and step through —
especially the **orange big-hole** slices the script reported — to decide
whether those should be filled too.

---

## Escalation tiers (auto first, manual last)

1. **Run with defaults**, review the QC montage.
2. **Threshold off?** Re-run with adjusted `--hole-max` / `--island-min`
   (or `--fill-big`) — most "too much / too little" cases are one knob away.
3. **A specific defect the thresholds can't express** (one real hole to fill,
   one real WM region wrongly deleted) → **manual editing in FreeView:**
   overwrite `wm.mgz` with `wm.autofix.mgz` first, then hand-paint that spot.
   → **`editing/recon_edit.md`** (wm.mgz: pen **255** add WM, **1** remove;
   control points + `-autorecon2-cp` if the hole is intensity-driven).

Full path: **wm_autofix → adjust thresholds → manual FreeView touch-up**.

---

## Apply the chosen result

```bash
cp $M/wm.mgz $M/wm.mgz.preEdit         # backup
cp $M/wm.autofix.mgz $M/wm.mgz         # overwrite
recon-all -s $SUBJECT -autorecon2-wm   # rebuild white/pial surfaces from edited WM
```

---

## Cheat sheet

| User says | Do |
|---|---|
| "still has holes / defects" | raise `--hole-max`, or `--fill-big`, or check the orange big holes |
| "filled a ventricle" | lower `--hole-max` (it filled too large a cavity) |
| "deleted real WM" | lower `--island-min` (it dropped a real small blob) |
| "leftover speckle" | raise `--island-min` |
| "one specific spot wrong" | manual paint → `editing/recon_edit.md` (on top of wm.autofix.mgz) |
| "good, use it" | overwrite `wm.mgz` (+ `.preEdit`) → `-autorecon2-wm` |
