import { NVImage, type Niivue } from "@niivue/niivue";
import type { DrawingOptions } from "@/store/types";

export async function saveAsNewVolume(
  nv: Niivue,
  options: DrawingOptions,
): Promise<void> {
  const drawingData = (await nv.saveImage({
    filename: "",
    isSaveDrawing: true,
    volumeByIndex: 0,
  })) as Uint8Array;

  const drawingFile = new File([drawingData as unknown as ArrayBuffer], options.filename, {
    type: "application/octet-stream",
  });

  nv.setDrawingEnabled(false);
  nv.setPenValue(0, false);
  nv.opts.clickToSegment = false;
  nv.closeDrawing();

  const nvimage = await NVImage.loadFromFile({
    file: drawingFile,
    name: options.filename,
  });

  nvimage.colormap = options.colormap || "red";
  if (nvimage.hdr && options.labels && options.labels.length > 0) {
    nvimage.hdr.intent_code = 1002;
  }
  nvimage.opacity = 1.0;
  nv.addVolume(nvimage);
}

export async function saveReconEdit(
  nv: Niivue,
  options: DrawingOptions,
  originalVolume: NVImage | null,
): Promise<void> {
  if (!nv.drawBitmap) {
    throw new Error("Drawing bitmap is empty");
  }

  // Prefer the original NVImage (pencil case): it carries the correct header,
  // data type, and permRAS so the inverse orientation transform is exact.
  // Fall back to a remaining scene volume for the blank-drawing case.
  const refVol: NVImage | null =
    originalVolume ??
    (nv.volumes.length > 0
      ? nv.volumes[options.referenceVolumeIndex ?? 0]
      : null);

  if (!refVol) {
    throw new Error("No reference volume available for recon save");
  }

  // Drawing bitmap encodes FreeSurfer convention directly:
  // value 0 = background, value 1 = deletion marker, value 255 = WM addition.
  // saveToDisk("", bitmap) returns raw NIfTI bytes using refVol's header
  // and applies the correct inverse permRAS transform to restore native orientation.
  const rawBytes = await refVol.saveToDisk("", nv.drawBitmap);

  nv.setDrawingEnabled(false);
  nv.setPenValue(0, false);
  nv.opts.clickToSegment = false;
  nv.closeDrawing();

  // Load result back and add to scene so the user sees the edit immediately.
  const displayName = refVol.name || options.filename;
  // saveToDisk returns uncompressed NIfTI bytes, so use .nii extension for loading.
  const loadName = displayName.replace(/\.(mgz|mgh|nii\.gz)$/i, ".nii");
  const file = new File([rawBytes as unknown as ArrayBuffer], loadName, {
    type: "application/octet-stream",
  });
  const editedVol = await NVImage.loadFromFile({ file, name: displayName });
  editedVol.colormap = refVol.colormap || "gray";
  editedVol.opacity = refVol.opacity ?? 1.0;
  nv.addVolume(editedVol);

  // Write back to server: POST NIfTI bytes + original file path.
  // The server converts to the original format (.mgz) and overwrites the file.
  const refUrl: string = (refVol as unknown as { url?: string }).url ?? "";
  if (refUrl && !refUrl.startsWith("blob:")) {
    let originalPath: string;
    try {
      originalPath = new URL(refUrl).pathname.replace(/^\//, "");
    } catch {
      originalPath = refUrl.replace(/^\//, "");
    }

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([rawBytes as unknown as ArrayBuffer], { type: "application/octet-stream" }),
      "edited.nii",
    );
    formData.append("originalPath", originalPath);

    const res = await fetch("/api/save-volume", { method: "POST", body: formData });
    if (!res.ok) {
      throw new Error(`Server write-back failed: ${res.status} ${res.statusText}`);
    }
  }
}
