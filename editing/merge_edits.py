#!/usr/bin/env python3
"""
merge_edits.py — Merge a NIfTI edit overlay into a FreeSurfer MGZ volume.

Merge logic:
  - Where nii.gz voxel != 0  →  overwrite mgz voxel with that value
  - Where nii.gz voxel == 0  →  keep original mgz voxel unchanged

Usage:
  # Auto mode: scan directory, find all .nii.gz / .mgz pairs by base name
  python merge_edits.py /path/to/subject/mri/

  # Explicit mode: specify files directly
  python merge_edits.py wm.nii.gz wm.mgz
"""

import sys, shutil
import numpy as np
import nibabel as nib
from pathlib import Path


def base_name(p: Path) -> str:
    name = p.name
    for ext in (".nii.gz", ".nii", ".mgz", ".mgh"):
        if name.endswith(ext):
            return name[: -len(ext)]
    return p.stem


def find_pairs(directory: Path):
    pairs = []
    for nii in sorted(directory.glob("*.nii.gz")):
        mgz = directory / f"{base_name(nii)}.mgz"
        if mgz.exists():
            pairs.append((nii, mgz))
    return pairs


def merge(nii_path: Path, mgz_path: Path) -> bool:
    print(f"\n  {nii_path.name}  →  {mgz_path.name}")

    nii_img = nib.load(nii_path)
    mgz_img = nib.load(mgz_path)

    nii_data = np.asarray(nii_img.dataobj).squeeze()
    mgz_data = np.asarray(mgz_img.dataobj).squeeze()

    # Dimension check
    if nii_data.shape != mgz_data.shape:
        print(f"  SKIP — dimension mismatch: {nii_data.shape} vs {mgz_data.shape}")
        return False

    edited = np.count_nonzero(nii_data)
    if edited == 0:
        print(f"  SKIP — edit file has no non-zero voxels")
        return False

    print(f"  Shape : {mgz_data.shape}")
    print(f"  Edited voxels : {edited:,}")

    # Backup
    backup = mgz_path.with_name(mgz_path.name + ".premerge")
    shutil.copy2(mgz_path, backup)
    print(f"  Backup: {backup.name}")

    # Apply edits
    merged = mgz_data.copy().astype(np.float32)
    mask = nii_data != 0
    merged[mask] = nii_data[mask]
    print(f"  Voxels changed: {int(mask.sum()):,}")

    # Save back as MGZ, preserving original affine + header
    out = nib.freesurfer.mghformat.MGHImage(
        merged.astype(mgz_data.dtype),
        mgz_img.affine,
        mgz_img.header,
    )
    nib.save(out, str(mgz_path))
    print(f"  Saved  → {mgz_path.name}")
    return True


def main():
    if len(sys.argv) == 2:
        directory = Path(sys.argv[1])
        if not directory.is_dir():
            sys.exit(f"ERROR: not a directory: {directory}")
        pairs = find_pairs(directory)
        if not pairs:
            print(f"No matching .nii.gz / .mgz pairs found in {directory}")
            return
        print(f"Found {len(pairs)} pair(s):")
        for nii, mgz in pairs:
            print(f"  {nii.name}  +  {mgz.name}")
        ok = sum(merge(nii, mgz) for nii, mgz in pairs)
        print(f"\nDone: {ok}/{len(pairs)} merged.")

    elif len(sys.argv) == 3:
        nii_path, mgz_path = Path(sys.argv[1]), Path(sys.argv[2])
        for p in (nii_path, mgz_path):
            if not p.exists():
                sys.exit(f"ERROR: not found: {p}")
        merge(nii_path, mgz_path)

    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
