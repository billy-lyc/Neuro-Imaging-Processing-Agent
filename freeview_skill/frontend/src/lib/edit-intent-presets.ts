import type { DrawingOptions, EditIntent } from "@/store/types";

export function applyIntentPreset(
  intent: EditIntent,
  current: DrawingOptions,
): Partial<DrawingOptions> {
  switch (intent) {
    case "voxel": {
      const activeLabel = current.labels.find(
        (l) => l.id === current.activeLabelId,
      );
      return {
        editIntent: "voxel",
        penValue: activeLabel?.value ?? current.penValue,
        colormap: current.labels.length > 0 ? "freesurfer" : "red",
      };
    }
    case "recon":
      return {
        editIntent: "recon",
        penValue: 255,
        penFill: false,
        penErases: false,
        activeLabelId: null,
        colormap: "recon-edit",
        referenceVolumeIndex: current.referenceVolumeIndex ?? 0,
        reconMode: "binary",
        reconTarget: "wm",
      };
    case "roi":
      return {
        editIntent: "roi",
        penValue: 2,
        penFill: true,
        penErases: false,
        activeLabelId: null,
        colormap: "freesurfer",
      };
  }
}
