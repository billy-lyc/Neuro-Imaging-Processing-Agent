import type { DragMode } from "@/components/drag-mode-selector";

export type SurfaceDetails = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  rgba255: [number, number, number, number];
  meshShaderIndex: number;
};

export type ViewMode = "axial" | "coronal" | "sagittal" | "ACS" | "ACSR" | "render";

export type ViewerOptions = {
  viewMode: ViewMode;
  crosshairWidth: number;
  crosshairGap: number;
  crosshairVisible: boolean;
  crosshairColor: [number, number, number, number];
  rulerWidth: number;
  rulerVisible: boolean;
  interpolateVoxels: boolean;
  dragMode: DragMode;
  overlayOutlineWidth: number;
};

// === NEW: 架构第一步 ===
export type EditIntent = "voxel" | "recon" | "roi";

export type ReconMode = "binary" | "multilabel";
export type ReconTarget = "wm" | "brainmask";

export type Label = {
  id: string;
  name: string;
  value: number;
};
// === END NEW ===

export type DrawingOptions = {
  enabled: boolean;
  mode: "none" | "pen" | "wand";
  penValue: number;
  penFill: boolean;
  penErases: boolean;
  opacity: number;
  magicWand2dOnly: boolean;
  magicWandMaxDistanceMM: number;
  magicWandThresholdPercent: number;
  filename: string;
  colormap: string;

  // === NEW: 架构第一步 ===
  editIntent: EditIntent;
  labels: Label[];
  activeLabelId: string | null;
  referenceVolumeIndex: number | null;
  originalVolumeName: string | null;
  isDirty: boolean;
  reconMode: ReconMode;
  reconTarget: ReconTarget;
  // === END NEW ===
};

export type LocationData = {
  mm: [number, number, number];
  voxels: Array<{
    name: string;
    voxel: [number, number, number];
    value: number;
  }>;
  drawValue: number | null;
};

export type SaveVolumeState = {
  enabled: boolean;
  isExternal: boolean;
  url: string;
};

export type SaveState = {
  isDownloadMode: boolean;
  document: {
    enabled: boolean;
    location: string;
  };
  volumes: SaveVolumeState[];
};
