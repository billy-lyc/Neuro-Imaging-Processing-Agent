#!/usr/bin/env python3
"""
wm_autofix.py — Automatic topology cleanup of a FreeSurfer wm.mgz (white-matter seg).

White-matter defects are NOT the same as brainmask defects. The two that hurt the
white-surface reconstruction (and inflate the Euler number) are:
  * tiny INTERNAL HOLES — dark voxels inside otherwise-solid WM (intensity dips) that
    become topological handles/holes in ?h.white. -> fill them (set to 255).
  * small ISLANDS — isolated WM blobs disconnected from the main sheet (false
    positives). -> delete them (set to 0).

What it deliberately does NOT do (unlike brainmask autofix):
  * It does NOT fill every hole — that would swallow the ventricles into WM. Only
    holes strictly smaller than --hole-max are filled; bigger cavities (likely real
    CSF / ventricle pockets, or large defects) are KEPT and reported for review.
  * It does NOT touch the main sheet or the existing 110/250 WM values.

Edits use FreeSurfer conventions: added WM = 255 (WM_EDITED_ON_VAL), removed = 0.
Writes wm.autofix.mgz next to wm.mgz; never overwrites wm.mgz.

Usage (pure python; nibabel + scipy, no FreeSurfer env needed):
  python3 wm_autofix.py --mri SUBJ/mri
  python3 wm_autofix.py --mri SUBJ/mri --hole-max 50 --island-min 200
  python3 wm_autofix.py --mri SUBJ/mri --fill-big        # also fill the big holes

Resume after applying:  recon-all -s <subj> -autorecon2-wm
"""

import argparse, os, sys
import numpy as np
import nibabel as nib
from scipy import ndimage as ndi
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ST = np.ones((3, 3, 3))   # 26-connectivity


def components(mask):
    lab, n = ndi.label(mask, structure=ST)
    sz = ndi.sum(np.ones_like(lab), lab, range(1, n + 1)) if n else np.array([])
    return lab, n, sz


def main():
    ap = argparse.ArgumentParser(description="Automatic wm.mgz topology cleanup")
    ap.add_argument("--mri", required=True, help="subject mri/ dir (must contain wm.mgz + T1.mgz)")
    ap.add_argument("--hole-max", type=int, default=50, help="fill internal holes strictly smaller than this (vox)")
    ap.add_argument("--island-min", type=int, default=200, help="delete WM blobs smaller than this (vox)")
    ap.add_argument("--fill-big", action="store_true", help="also fill holes >= hole-max (use with care)")
    ap.add_argument("--out", default=None, help="QC dir (default <mri>/../qc_wm)")
    a = ap.parse_args()

    M = a.mri.rstrip("/")
    wmp = os.path.join(M, "wm.mgz")
    if not os.path.exists(wmp):
        sys.exit(f"ERROR: {wmp} not found.")
    out = a.out or os.path.join(os.path.dirname(M), "qc_wm")
    os.makedirs(out, exist_ok=True)

    wmimg = nib.load(wmp); wm = wmimg.get_fdata().astype(np.uint8)
    t1 = nib.load(os.path.join(M, "T1.mgz")).get_fdata()
    bw = wm > 0
    print(f"WM: {int(bw.sum())} vox ({bw.sum()/1000:.1f} cm^3)")

    # islands: keep components >= island-min, delete the rest
    lab, n, sz = components(bw)
    keep = np.isin(lab, np.where(sz >= a.island_min)[0] + 1)
    remove_islands = bw & ~keep
    print(f"components={n}; islands<{a.island_min}: {int((sz < a.island_min).sum())} blobs "
          f"({int(remove_islands.sum())} vox)")

    # holes: enclosed cavities; fill the small ones, optionally the big ones
    holes = ndi.binary_fill_holes(bw) & ~bw
    hl, hn, hsz = components(holes)
    small = np.isin(hl, np.where(hsz < a.hole_max)[0] + 1)
    big = np.isin(hl, np.where(hsz >= a.hole_max)[0] + 1)
    fill = (small | big) if a.fill_big else small
    print(f"holes={hn} ({int(holes.sum())} vox); fill<{a.hole_max}: "
          f"{int((hsz < a.hole_max).sum())} cavities ({int(small.sum())} vox); "
          f"{'ALSO filling' if a.fill_big else 'KEEPING'} big>={a.hole_max}: "
          f"{int((hsz >= a.hole_max).sum())} cavities ({int(big.sum())} vox)")
    if hn and (hsz >= a.hole_max).any() and not a.fill_big:
        for k in np.where(hsz >= a.hole_max)[0]:
            cz = int(np.round(ndi.center_of_mass(hl == (k + 1))[1]))   # axial (axis1) slice
            print(f"   big hole: {int(hsz[k])} vox near axial slice {cz} — review")

    new = wm.copy()
    new[remove_islands] = 0
    new[fill] = 255
    outp = os.path.join(M, "wm.autofix.mgz")
    nib.save(nib.freesurfer.mghformat.MGHImage(new, wmimg.affine, wmimg.header), outp)
    print(f"WM {int(bw.sum())} -> {int((new>0).sum())} vox; wrote {outp}")

    # QC montage
    ax = 1; idx = np.where((new > 0).any(axis=(0, 2)))[0]; lo, hi = idx.min(), idx.max()
    sl = np.linspace(lo + (hi - lo) * 0.3, lo + (hi - lo) * 0.72, 5).astype(int)
    fig, axes = plt.subplots(1, 5, figsize=(22, 5))
    for ax_, i in zip(axes, sl):
        bg = np.rot90(np.take(t1, i, axis=ax)); ax_.imshow(bg, cmap="gray")
        ov = np.zeros(bg.shape + (4,))
        ov[np.rot90(np.take(bw, i, axis=ax)) > 0] = [0.3, 0.4, 1, 0.25]
        ov[np.rot90(np.take(fill, i, axis=ax)) > 0] = [0, 1, 0, 0.95]
        ov[np.rot90(np.take(remove_islands, i, axis=ax)) > 0] = [1, 0, 0, 0.95]
        if not a.fill_big:
            ov[np.rot90(np.take(big, i, axis=ax)) > 0] = [1, 0.5, 0, 0.95]
        ax_.imshow(ov); ax_.set_title(f"ax{i}", fontsize=9); ax_.axis("off")
    fig.suptitle("wm autofix: green=filled small holes  red=removed islands  orange=big holes kept", fontsize=11)
    fig.tight_layout()
    png = os.path.join(out, "wm_autofix.png")
    fig.savefig(png, dpi=95, bbox_inches="tight"); plt.close(fig)
    print(f"QC montage: {png}")
    print("Review, then apply:  cp wm.mgz wm.mgz.preEdit && cp wm.autofix.mgz wm.mgz "
          "&& recon-all -s <subj> -autorecon2-wm")


if __name__ == "__main__":
    main()
