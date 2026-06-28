#!/usr/bin/env python3
"""
brainmask_autofix.py — Fully-automatic FreeSurfer brainmask correction via SynthStrip.

Regenerates a clean brainmask from the conformed T1 using SynthStrip, then post-
processes it (cerebellum-safe component cleanup + 3D hole fill, optional ventricle
refill). Produces a *tightness ladder* of candidates plus a QC montage so the user
can pick the boundary they want in the FreeView web viewer. Never overwrites the
live brainmask.mgz — writes candidates alongside it.

Why a ladder (lessons baked in):
  * SynthStrip DEFAULT mode keeps CSF, so the ventricles are interior -> the mask
    is already SOLID (no internal holes). Tune the boundary with -b/--border
    (smaller/negative = tighter, trims dura/CSF; larger = looser).
  * --no-csf gives the tightest scalp removal BUT punches out the ventricles
    (they connect to the exterior via CSF channels, so binary_fill_holes can't
    refill them) AND can shave cortex. Only use it when you need a very tight
    boundary; this script refills its ventricles from the with-CSF interior.
  * Optimal tightness is subject-dependent (atrophied/large-CSF brains read very
    inclusive even at border=1) -> generate several, let the user choose.
  * Over-inclusion (scalp/dura/face) -> go tighter (lower border / --no-csf).
    Under-inclusion (missing brain) -> go looser (higher border).

Usage:
  # needs mri_synthstrip on PATH (source $FREESURFER_HOME/SetUpFreeSurfer.sh first)
  python3 brainmask_autofix.py --mri SUBJ/mri                       # default ladder b=1,0,-1
  python3 brainmask_autofix.py --mri SUBJ/mri --borders 1 0 -1 -2   # custom ladder
  python3 brainmask_autofix.py --mri SUBJ/mri --nocsf               # add tight --no-csf (refilled)
  python3 brainmask_autofix.py --mri SUBJ/mri --threads 8 --out SUBJ/qc_autofix

Outputs (in <mri>/):
  brainmask.autofix_b{B}.mgz + mask.autofix_b{B}_BINARY.mgz   for each border B
  brainmask.autofix_nocsf.mgz + ...                            if --nocsf
  QC montage + per-candidate volumes printed to stdout
"""

import argparse, os, subprocess, sys
from pathlib import Path
import numpy as np
import nibabel as nib
from scipy import ndimage as ndi

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def ball(r):
    L = np.arange(-r, r + 1); X, Y, Z = np.meshgrid(L, L, L, indexing="ij")
    return (X * X + Y * Y + Z * Z) <= r * r


def keep_components(mask, minvox):
    """Keep ALL connected components >= minvox (cerebellum-safe; NOT largest-only)."""
    lab, n = ndi.label(mask)
    if n == 0:
        return mask
    sz = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
    return np.isin(lab, np.where(sz >= minvox)[0] + 1)


def run_synthstrip(t1, out_mask, border, nocsf, threads):
    cmd = ["mri_synthstrip", "-i", str(t1), "-m", str(out_mask),
           "-b", str(border), "-t", str(threads)]
    if nocsf:
        cmd.append("--no-csf")
    print("  $", " ".join(cmd))
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)


def fill_ventricles(clean, withcsf):
    """Refill interior ventricles into a tight (--no-csf) mask WITHOUT loosening the
    scalp: take the solid with-CSF brain envelope, erode 3 mm to drop the near-boundary
    band, and add only the deep interior that `clean` lacks. Erosion guarantees nothing
    is added within 3 mm of the brain exterior, so the scalp edge is untouched."""
    solid = ndi.binary_fill_holes(withcsf)
    inner = ndi.binary_erosion(solid, structure=ball(3))
    vent = keep_components(inner & ~clean, 100)
    return ndi.binary_fill_holes(clean | vent)


def cleanup(mask, minvox=1000):
    m = keep_components(mask, minvox)
    return ndi.binary_fill_holes(m)


def save_candidate(binary, t1img, ref, mri, tag):
    nib.save(nib.freesurfer.mghformat.MGHImage(binary.astype(np.uint8), ref.affine, ref.header),
             str(mri / f"mask.autofix_{tag}_BINARY.mgz"))
    inten = np.asarray(t1img.dataobj).copy()
    inten[~binary] = 0
    nib.save(nib.freesurfer.mghformat.MGHImage(
        np.asarray(inten, dtype=t1img.get_data_dtype()), t1img.affine, t1img.header),
        str(mri / f"brainmask.autofix_{tag}.mgz"))


def qc_montage(t1, candidates, original, out_png):
    rows = [("orig brainmask", original, (1, 1, 0, 0.40))]
    rows += [(tag, m, (1, 0, 0, 0.45)) for tag, m in candidates]
    any_mask = candidates[0][1]
    idx = np.where(any_mask.any(axis=(0, 2)))[0]; lo, hi = idx.min(), idx.max()
    sl = np.linspace(lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.8, 5).astype(int)
    fig, axes = plt.subplots(len(rows), 5, figsize=(20, 4 * len(rows)))
    axes = np.atleast_2d(axes)
    for r, (tag, mk, col) in enumerate(rows):
        for c, i in enumerate(sl):
            a = axes[r, c]; bg = np.rot90(np.take(t1, i, axis=1)); a.imshow(bg, cmap="gray")
            ov = np.zeros(bg.shape + (4,)); ov[np.rot90(np.take(mk, i, axis=1)) > 0] = col
            a.imshow(ov); a.set_title(f"{tag} ax{i}", fontsize=8); a.axis("off")
    fig.suptitle("brainmask autofix tightness ladder (top = original)", fontsize=13)
    fig.tight_layout(); fig.savefig(out_png, dpi=95, bbox_inches="tight"); plt.close(fig)


def main():
    ap = argparse.ArgumentParser(description="Automatic SynthStrip brainmask correction")
    ap.add_argument("--mri", required=True, help="subject mri/ dir (must contain T1.mgz)")
    ap.add_argument("--borders", type=float, nargs="+", default=[1, 0, -1],
                    help="default-mode SynthStrip border levels (tightness ladder)")
    ap.add_argument("--nocsf", action="store_true", help="also produce a tight --no-csf candidate (ventricles refilled)")
    ap.add_argument("--threads", type=int, default=8)
    ap.add_argument("--out", default=None, help="QC output dir (default <mri>/../qc_brainmask_autofix)")
    a = ap.parse_args()

    mri = Path(a.mri).resolve()
    t1 = mri / "T1.mgz"
    if not t1.exists():
        sys.exit(f"ERROR: {t1} not found (need the conformed T1).")
    ref_path = mri / "brainmask.mgz"
    if not ref_path.exists():
        ref_path = mri / "brainmask.auto.mgz"
    out = Path(a.out) if a.out else mri.parent / "qc_brainmask_autofix"
    out.mkdir(parents=True, exist_ok=True)
    if subprocess.run(["which", "mri_synthstrip"], stdout=subprocess.DEVNULL).returncode != 0:
        sys.exit("ERROR: mri_synthstrip not on PATH. Source $FREESURFER_HOME/SetUpFreeSurfer.sh first.")

    t1img = nib.load(str(t1)); t1arr = t1img.get_fdata()
    ref = nib.load(str(ref_path)); original = ref.get_fdata() > 0
    print(f"T1={t1}  reference={ref_path.name}  out={out}")
    print(f"original mask: {int(original.sum())} vox ({original.sum()/1000:.1f} cm^3)\n")

    candidates = []

    # with-CSF reference for ventricle refill (border=1 default)
    withcsf_mask = mri / "mask.autofix_withcsf_tmp.mgz"
    print("SynthStrip with-CSF reference (b=1):")
    run_synthstrip(t1, withcsf_mask, 1, False, a.threads)
    withcsf = nib.load(str(withcsf_mask)).get_fdata() > 0

    for b in a.borders:
        tag = f"b{b:g}"
        print(f"\nDefault-mode ladder, border={b:g}:")
        mfile = mri / f"mask.autofix_{tag}_raw.mgz"
        run_synthstrip(t1, mfile, b, False, a.threads)
        m = cleanup(nib.load(str(mfile)).get_fdata() > 0)
        save_candidate(m, t1img, ref, mri, tag)
        candidates.append((tag, m))
        print(f"  -> {int(m.sum())} vox ({m.sum()/1000:.1f} cm^3), "
              f"comps={ndi.label(m)[1]}, holes={int((ndi.binary_fill_holes(m)&~m).sum())}")
        mfile.unlink(missing_ok=True)

    if a.nocsf:
        print("\nTight --no-csf candidate (ventricles refilled):")
        mfile = mri / "mask.autofix_nocsf_raw.mgz"
        run_synthstrip(t1, mfile, 1, True, a.threads)
        clean = cleanup(nib.load(str(mfile)).get_fdata() > 0)
        m = fill_ventricles(clean, withcsf)
        save_candidate(m, t1img, ref, mri, "nocsf")
        candidates.append(("nocsf", m))
        print(f"  -> {int(m.sum())} vox ({m.sum()/1000:.1f} cm^3), "
              f"comps={ndi.label(m)[1]}, holes={int((ndi.binary_fill_holes(m)&~m).sum())}")
        mfile.unlink(missing_ok=True)

    withcsf_mask.unlink(missing_ok=True)
    qc_png = out / "autofix_ladder.png"
    qc_montage(t1arr, candidates, original, str(qc_png))
    print(f"\nQC montage: {qc_png}")
    print("Candidates written to", mri, "as brainmask.autofix_<tag>.mgz (+ *_BINARY.mgz).")
    print("Load them in the FreeView web viewer, pick the tightness, then overwrite "
          "brainmask.mgz (back up to .preEdit) and resume with `recon-all -s <subj> -autorecon2-volonly`.")


if __name__ == "__main__":
    main()
