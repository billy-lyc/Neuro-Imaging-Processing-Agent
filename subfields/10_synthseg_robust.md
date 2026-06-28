# Tool 10: mri_synthseg --robust

The robust variant of SynthSeg. Uses an additional iterative refinement
step that improves segmentation quality on low-quality inputs at the
cost of longer runtime.

**Type:** Deep learning (no recon-all required)

**Atlas / model:** Billot et al. 2023 (SynthSeg+)

**Runtime:** 3-5 minutes (CPU); ~30 seconds (GPU)

---

## When to use this over standard SynthSeg (#9)

Use `--robust` when:
- Input has motion artifacts
- Input has severe bias field (uncorrected)
- Input has unusual contrast (e.g., very old MR, atypical sequences)
- Input has partial coverage (cropped FOV)
- Standard SynthSeg (#9) gave noisy or implausible results

For high-quality 1mm T1 inputs, standard SynthSeg (#9) is sufficient
and faster.

---

## Prerequisites

- Any structural MR NIfTI file
- FreeSurfer 7.3 or newer

---

## Command

```bash
mri_synthseg \
  --i T1.nii.gz \
  --o synthseg_robust_out.nii.gz \
  --vol synthseg_robust_volumes.csv \
  --robust
```

The `--robust` flag is the only difference from tool #9.

### Combine with other flags

```bash
# Robust + force CPU
mri_synthseg --i T1.nii.gz --o seg.nii.gz --robust --cpu

# Robust + batch processing
mri_synthseg --i /input_dir/ --o /output_dir/ --vol vols.csv --robust
```

---

## Outputs

Same format as #9:
- Segmentation NIfTI
- Optional CSV with volumes

The labels are identical to #9 (32 standard aseg labels).

---

## What "robust" does internally

The robust mode adds:
1. An additional iterative refinement using a different network
2. Resampling to 1mm³ as part of preprocessing
3. More aggressive bias field handling

The result is more reliable on edge-case inputs, with slightly
different but generally consistent volumes vs #9.

---

## QC

Same as tool #9. See `09_synthseg.md`.

---

## Choosing between #9 and #10 (decision rules)

| Input characteristic | Use |
|---|---|
| Standard 1mm T1, healthy adult | #9 (faster) |
| Standard 1mm T1, motion artifacts | #10 |
| Sub-millimeter T1 | #9 |
| 7T T1 (different contrast) | #10 |
| Pediatric / neonate | #10 |
| Atrophy patient | #10 |
| Cropped or partial-coverage scan | #10 |
| T2 or FLAIR input | Either; #10 if uncertain |
| Need fastest possible processing | #9 |

---

## Common issues

Same as #9 (see `09_synthseg.md`).

Additional:

**"Output looks similar to #9, just slower"**
- Expected on high-quality inputs; #10's advantage shows on
  difficult inputs
- For standard inputs, use #9

**"Output looks worse than #9 on a clean scan"**
- Rare; the robust pipeline can over-smooth in some cases
- Solution: prefer #9 for clean inputs, use #10 only when needed

---

## Aggregate stats

Same as #9.

---

## Notes

**`--robust` and `--parc` together:** Currently `--robust` and `--parc`
(cortical parcellation, tool #11) cannot be combined. Choose one.

**Don't mix #9 and #10 results in the same study cohort.** The two
algorithms produce slightly different volumes; mixing introduces
systematic bias. Choose one based on the worst-quality scan in your
cohort.
