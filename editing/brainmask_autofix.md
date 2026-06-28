# Brainmask Autofix (automatic, no manual painting)

Fully-automatic correction of a bad `brainmask.mgz` / `brainmask.auto.mgz`
using **SynthStrip** + morphological post-processing. Use this instead of
`recon_edit.md` (manual brush) when the user wants the fix done
automatically and just delivered.

**Script:** `editing/brainmask_autofix.py`
**Viewer:** FreeView Online (to pick the boundary)

---

## When to invoke

- "Fix the brainmask automatically / without manual editing"
- Skull strip left **scalp / dura / face / neck** in the mask (over-inclusion)
- Skull strip **cut into the brain** — temporal poles, orbitofrontal,
  **cerebellum**, brainstem (under-inclusion)
- Mask has **internal holes** (dark voxels / ventricles punched out)
- Batch "clean up all my brainmasks"

Needs only the conformed **`T1.mgz`** (recon-all does not have to be
finished). Writes candidates next to `brainmask.mgz`; never overwrites it.

---

## The one idea: a tightness ladder, user picks

There is **no single right tightness** — it is subject-dependent (atrophied
/ large-CSF brains read very inclusive). So the script regenerates the mask
at several boundaries and the **user picks** in the viewer.

| Symptom user reports | Direction | Lever |
|---|---|---|
| Scalp / dura / face still in mask (over-included) | **tighter** | lower `--border` (0, −1, −2) or `--nocsf` |
| Brain cut off / missing (under-included) | **looser** | higher `--border` (1, 2) |
| Internal holes / ventricles punched out | use **default mode** (not `--nocsf`) | default mode keeps ventricles solid |

### Why these levers (baked-in lessons)

- **Default-mode SynthStrip keeps CSF**, so ventricles are interior → the
  mask is **already solid, no internal holes**. Tune the edge with
  `-b/--border` (mm; smaller/negative = tighter).
- **`--no-csf` is the tightest scalp removal** but it (a) punches out the
  ventricles — they connect to the exterior through CSF channels so a plain
  3-D fill can't refill them — and (b) can **shave cortex**. The script
  refills its ventricles from the with-CSF interior (erode 3 mm, add only
  the deep part → scalp edge stays put). Reach for `--nocsf` only when the
  default ladder is still too loose.
- **Never reduce to the single largest component** — that silently drops the
  **cerebellum** (often a separate blob). The script keeps *all* components
  ≥ 1000 vox.

---

## Run it

```bash
# 1) FreeSurfer env (mri_synthstrip must be on PATH)
export FREESURFER_HOME=/nas/longleaf/home/limeiw/freesurfer   # no FS module on this host
source $FREESURFER_HOME/SetUpFreeSurfer.sh
export FS_LICENSE=$FREESURFER_HOME/license.txt

# 2) default ladder (border 1, 0, -1)
python3 "${SKILL_DIR}/editing/brainmask_autofix.py" --mri $SUBJECTS_DIR/$SUBJECT/mri

# tighter options / add the very-tight --no-csf candidate:
python3 "${SKILL_DIR}/editing/brainmask_autofix.py" --mri .../mri --borders 1 0 -1 -2 --nocsf
```

Outputs in `mri/` (live `brainmask.mgz` untouched):

- `brainmask.autofix_b1.mgz`, `brainmask.autofix_b0.mgz`, … (+ `mask.autofix_b*_BINARY.mgz`)
- `brainmask.autofix_nocsf.mgz` if `--nocsf`
- QC montage `autofix_ladder.png` (top row = original, below = each candidate)

The script prints each candidate's volume, component count, and remaining
internal holes (should be 0).

---

## Let the user pick (FreeView web viewer)

Symlink the candidates + T1 + original into a folder and launch the viewer
(see `workflows/view_freeview.md`; this host uses **port 9090**):

```bash
VD=$(mktemp -d); M=$SUBJECTS_DIR/$SUBJECT/mri
ln -s $M/T1.mgz $M/brainmask.auto.mgz $M/brainmask.autofix_*.mgz $M/mask.autofix_*_BINARY.mgz "$VD"/
lsof -ti:9090 | xargs -r kill -9          # free the port first
bash "${SKILL_DIR}/freeview_skill/start_viewer.sh" "$VD" 9090 &
```

Tell the user: load `T1.mgz`, overlay the `mask.autofix_*_BINARY.mgz`
candidates, and say which tightness they want — or "tighter" / "looser" and
re-run with adjusted `--borders`. Have them check the **binary** masks
(the intensity ones show dark CSF/sulci that *look* like holes but aren't).

---

## Escalation tiers (auto first, manual last)

Try the cheaper tier first; only escalate when the user is still unsatisfied.

1. **Pick a ladder candidate** (above).
2. **Still off globally?** Re-run with adjusted `--borders` / `--nocsf` — a
   uniform tightness problem is usually one border step away.
3. **Off only in a spot** the boundary can't reach (e.g. a single dura tag, a
   bit of brain clipped at one gyrus) — morphology/border can't fix a local
   defect without harming the rest. **Escalate to manual editing in FreeView:**
   start from the best candidate, then hand-paint just that region.
   → **`editing/recon_edit.md`** (brainmask.mgz: pen **255** add brain, **1**
   remove non-brain). Overwrite `brainmask.mgz` with the chosen candidate
   first so the user paints on top of the good auto result, not the bad
   original.

So the full path is: **autofix ladder → re-run with new borders → manual
FreeView touch-up** (`recon_edit.md`), in that order.

---

## Apply the chosen candidate

Mask-only delivery is the default. To propagate into the recon:

```bash
cp $M/brainmask.mgz $M/brainmask.mgz.preEdit            # backup
cp $M/brainmask.autofix_<chosen>.mgz $M/brainmask.mgz   # overwrite
recon-all -s $SUBJECT -autorecon2-volonly -autorecon3   # rebuild surfaces/stats
```

(`brainmask.auto.mgz` is the regenerated reference — never edit it directly;
edit/overwrite `brainmask.mgz`.)

---

## Cheat sheet

| User says | Do |
|---|---|
| "scalp still in it" | lower `--border` (0 → −1 → −2), or `--nocsf` |
| "you cut the brain" | raise `--border` (1 → 2) |
| "holes inside" | use default-mode candidates (not `--nocsf`); they're solid |
| "cerebellum missing" | already handled (keeps all components ≥1000 vox) — raise border if still clipped |
| "still wrong after trying borders" | escalate to manual paint → `editing/recon_edit.md` (overwrite `brainmask.mgz` with best candidate first) |
| "good, use it" | overwrite `brainmask.mgz` (+ `.preEdit`) → `-autorecon2-volonly -autorecon3` |
