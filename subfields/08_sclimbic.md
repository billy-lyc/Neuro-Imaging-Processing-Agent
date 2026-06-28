# Tool 8: mri_sclimbic_seg

Segment 13 limbic system structures using a deep learning model. Includes
nucleus accumbens, basal forebrain, and BNST — structures not covered by
the standard FreeSurfer aseg.

**Type:** Deep learning (no recon-all required)

**Atlas / model:** Greve et al. 2021 (ScLimbic)

**Runtime:** 5-10 minutes (CPU); under 1 minute on GPU

---

## Prerequisites

- T1 NIfTI (does NOT require recon-all)
- FreeSurfer 7.2 or newer

---

## Command

### Single subject

```bash
mri_sclimbic_seg \
  --i T1.nii.gz \
  --o sclimbic_seg.mgz \
  --write_volumes
```

### Using subject directory (after recon-all)

```bash
mri_sclimbic_seg \
  --s $SUBJECT \
  --write_volumes
```

When using `--s`, the input is `$SUBJECTS_DIR/$SUBJECT/mri/orig.mgz`
and outputs go to `$SUBJECTS_DIR/$SUBJECT/mri/`.

### GPU acceleration

```bash
# Use GPU (default if available)
mri_sclimbic_seg --i T1.nii.gz --o sclimbic_seg.mgz --write_volumes

# Force CPU
mri_sclimbic_seg --i T1.nii.gz --o sclimbic_seg.mgz --write_volumes --cpu
```

---

## Outputs

### Standalone mode
- `sclimbic_seg.mgz` — segmentation volume
- `sclimbic_seg.stats` (when `--write_volumes` set) — volume table

### Subject mode (with `--s`)
- `mri/sclimbic.mgz`
- `stats/sclimbic.stats`

---

## Limbic structures (13)

| Label | Structure | Function |
|---|---|---|
| Left-Nucleus-accumbens | NAc (L) | Reward, motivation |
| Right-Nucleus-accumbens | NAc (R) | |
| Left-Basal-Forebrain | BF (L) | Cholinergic system, attention |
| Right-Basal-Forebrain | BF (R) | |
| Left-Septal-Nuclei | Septum (L) | Limbic, autonomic |
| Right-Septal-Nuclei | Septum (R) | |
| Left-Hypothalamus | Hypothalamus (L) | Autonomic, neuroendocrine |
| Right-Hypothalamus | Hypothalamus (R) | |
| Left-Hippocampus-extension | Hippo-ext (L) | Posterior hippocampus continuation |
| Right-Hippocampus-extension | Hippo-ext (R) | |
| Left-Amygdala | Amygdala (L) | Emotion, threat |
| Right-Amygdala | Amygdala (R) | |
| Fornix | Fornix | Hippocampal output tract |

Plus a BNST sub-region in some atlas versions.

---

## Typical volumes (healthy adults, mm³)

| Structure | Per hemisphere |
|---|---|
| Nucleus_accumbens | 400-700 |
| Basal_Forebrain | 350-600 |
| Hypothalamus | 600-900 |
| Amygdala | 1300-1900 |
| Fornix | 80-200 (whole) |

The basal forebrain is particularly important in dementia research
(cholinergic deficit hypothesis).

---

## Why use this tool

This tool is the **only FreeSurfer way** to get:
- **Nucleus accumbens** at all (FreeSurfer's standard aseg lumps it
  with the ventral striatum)
- **Basal forebrain** as a separate structure
- **BNST** (bed nucleus of the stria terminalis) — relevant for
  anxiety/stress research
- **Septal nuclei**

For amygdala and hippocampus, prefer tools #1/#2/#7 which give
sub-nucleus / sub-field detail; #8 gives only whole-structure volumes
for these.

---

## QC

```bash
freeview -v T1.nii.gz \
  sclimbic_seg.mgz:colormap=lut:opacity=0.5 \
  -viewport coronal \
  -ss $QC_DIR/qc_sclimbic_coronal.png 2 -quit

freeview -v T1.nii.gz \
  sclimbic_seg.mgz:colormap=lut:opacity=0.5 \
  -viewport axial \
  -ss $QC_DIR/qc_sclimbic_axial.png 2 -quit
```

In coronal view, scan from anterior (frontal pole) backward. Check:
- NAc visible at the level of the genu of the corpus callosum
- Basal forebrain at the level of the anterior commissure
- Hypothalamus around the third ventricle
- Symmetry between hemispheres

---

## Common issues

**"Volumes implausibly low"**
- Cause: T1 has low resolution or atypical contrast (the model was
  trained on standard 1mm T1; sub-millimeter or non-standard contrasts
  may underperform)
- Fix: try with `--robust` or check input quality

**"Segmentation runs but produces nothing for BNST"**
- Some atlas versions don't include BNST as a separate label
- Check the available labels in the output:
  ```bash
  mri_segstats --seg sclimbic_seg.mgz --sum sclimbic_segstats.txt
  ```

**"GPU out of memory"**
- Force CPU mode: add `--cpu` to the command

---

## Aggregate stats

The standard FreeSurfer stats tools work:

```bash
asegstats2table --subjects $(cat subjects.txt) \
  --statsfile=sclimbic.stats \
  --tablefile=sclimbic_volumes.tsv --skip
```

(Subject mode only; for standalone mode, write a custom script to
parse the .stats files.)

---

## Notes

**Independence from recon-all:** This tool runs directly on a T1; no
prior FreeSurfer processing needed. It's useful as a quick
"limbic-focused" pipeline when you don't need full surface
reconstruction.

**Combining with recon-all:** For most studies, run recon-all + a
hippocampus/amygdala tool (#1, #2, or #7) + this tool. The outputs
complement each other (no overlap in structures except hippocampus
and amygdala, where #1/#2/#7 are more detailed).

**Model versions:** The underlying model is updated periodically.
Check `mri_sclimbic_seg --help` for the version in your installation.
