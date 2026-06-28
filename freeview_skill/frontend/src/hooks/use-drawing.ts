import { useCallback, useEffect } from "react";
import { useFreeBrowseStore } from "@/store";
import { NVImage, type Niivue } from "@niivue/niivue";
import type { EditIntent, ReconMode, ReconTarget } from "@/store/types";
import { applyIntentPreset } from "@/lib/edit-intent-presets";
import { saveAsNewVolume, saveReconEdit } from "@/lib/save-drawing";

const RECON_COLORMAP = {
  R: [0, 255,   0],
  G: [0,   0, 180],
  B: [0,   0,   0],
  A: [0, 255, 255],
  I: [0,   1, 255],
};

export function useDrawing(
  nvRef: React.RefObject<Niivue | null>,
  debouncedGLUpdate: () => void,
  originalVolumeRef: React.RefObject<NVImage | null>,
) {
  const drawingOptions = useFreeBrowseStore((s) => s.drawingOptions);
  const incrementVolumeVersion = useFreeBrowseStore((s) => s.incrementVolumeVersion);
  const setDrawingOptions = useFreeBrowseStore((s) => s.setDrawingOptions);
  const setActiveTab = useFreeBrowseStore((s) => s.setActiveTab);

  const syncDrawingOptionsFromNiivue = useCallback(() => {
    if (nvRef.current && drawingOptions.mode === "wand") {
      const nv = nvRef.current;
      if (
        nv.opts.clickToSegmentPercent !==
          drawingOptions.magicWandThresholdPercent ||
        nv.opts.clickToSegmentMaxDistanceMM !==
          drawingOptions.magicWandMaxDistanceMM
      ) {
        setDrawingOptions((prev) => ({
          ...prev,
          magicWandThresholdPercent: nv.opts.clickToSegmentPercent,
          magicWandMaxDistanceMM: nv.opts.clickToSegmentMaxDistanceMM,
        }));
      }
    }
  }, [
    nvRef,
    drawingOptions.mode,
    drawingOptions.magicWandThresholdPercent,
    drawingOptions.magicWandMaxDistanceMM,
    setDrawingOptions,
  ]);

  const handleCreateDrawingLayer = useCallback(() => {
    if (nvRef.current) {
      nvRef.current.setDrawingEnabled(false);

      const penValue = drawingOptions.penErases ? 0 : drawingOptions.penValue;
      nvRef.current.setPenValue(penValue, drawingOptions.penFill);
      nvRef.current.setDrawOpacity(drawingOptions.opacity);

      setDrawingOptions((prev) => ({ ...prev, enabled: true, mode: "none" }));
      setActiveTab("drawing");
    }
  }, [nvRef, drawingOptions, setDrawingOptions, setActiveTab]);

  const handleDrawingColormapChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newColormap = event.target.value;
      setDrawingOptions((prev) => ({ ...prev, colormap: newColormap }));
      if (nvRef.current && nvRef.current.drawBitmap) {
        nvRef.current.setDrawColormap(newColormap);
        nvRef.current.updateGLVolume();
      }
    },
    [nvRef, setDrawingOptions],
  );

  const handleDrawModeChange = useCallback(
    (mode: "none" | "pen" | "wand") => {
      setDrawingOptions((prev) => ({
        ...prev,
        mode,
        penErases: mode === "wand" ? false : prev.penErases,
      }));
      if (nvRef.current) {
        if (mode === "pen") {
          const penValue = drawingOptions.penErases
            ? 0
            : drawingOptions.penValue;
          nvRef.current.setPenValue(penValue, drawingOptions.penFill);
          nvRef.current.setDrawingEnabled(true);
          nvRef.current.opts.clickToSegment = false;
        } else if (mode === "wand") {
          nvRef.current.setDrawingEnabled(true);
          nvRef.current.opts.clickToSegment = true;
          nvRef.current.opts.clickToSegmentIs2D =
            drawingOptions.magicWand2dOnly;
          nvRef.current.opts.clickToSegmentAutoIntensity = true;
          nvRef.current.opts.clickToSegmentMaxDistanceMM =
            drawingOptions.magicWandMaxDistanceMM;
          nvRef.current.opts.clickToSegmentPercent =
            drawingOptions.magicWandThresholdPercent;
          const penValue = drawingOptions.penValue;
          nvRef.current.setPenValue(penValue, false);
        } else if (mode === "none") {
          nvRef.current.setDrawingEnabled(false);
          nvRef.current.opts.clickToSegment = false;
        }
        // setDrawingEnabled(true) calls createEmptyDrawing which sets up the
        // draw texture but does NOT reset drawLut. Apply the LUT explicitly
        // here so Remove (value 1) and Add (value 255) render with correct
        // colors from the moment drawing is enabled.
        if (mode !== "none") {
          const cmapArg =
            drawingOptions.colormap === "recon-edit"
              ? (RECON_COLORMAP as unknown as string)
              : drawingOptions.colormap;
          nvRef.current.setDrawColormap(cmapArg);
        }
      }
    },
    [nvRef, drawingOptions, setDrawingOptions],
  );

  const handlePenFillChange = useCallback(
    (checked: boolean) => {
      setDrawingOptions((prev) => ({ ...prev, penFill: checked }));
      if (nvRef.current) {
        nvRef.current.drawFillOverwrites = checked;
        console.log(drawingOptions.mode);
        if (drawingOptions.mode === "pen") {
          const penValue = drawingOptions.penErases
            ? 0
            : drawingOptions.penValue;
          nvRef.current.setPenValue(penValue, checked);
        }
      }
    },
    [nvRef, drawingOptions, setDrawingOptions],
  );

  const handlePenErasesChange = useCallback(
    (checked: boolean) => {
      setDrawingOptions((prev) => ({ ...prev, penErases: checked }));
      if (nvRef.current) {
        if (drawingOptions.mode === "pen") {
          const penValue = checked ? 0 : drawingOptions.penValue;
          nvRef.current.setPenValue(penValue, drawingOptions.penFill);
        } else if (drawingOptions.mode === "wand") {
          nvRef.current.setPenValue(checked ? 0 : drawingOptions.penValue, false);
        } else if (drawingOptions.mode === "none") {
          nvRef.current.setDrawingEnabled(false);
        }
      }
    },
    [nvRef, drawingOptions, setDrawingOptions],
  );

  const handlePenValueChange = useCallback(
    (value: number) => {
      setDrawingOptions((prev) => ({ ...prev, penValue: value }));
      if (nvRef.current) {
        if (drawingOptions.mode === "pen" && !drawingOptions.penErases) {
          nvRef.current.setPenValue(value, drawingOptions.penFill);
        } else if (drawingOptions.mode === "wand") {
          nvRef.current.setPenValue(value, false);
        }
      }
    },
    [nvRef, drawingOptions, setDrawingOptions],
  );

  const handleDrawingOpacityChange = useCallback(
    (opacity: number) => {
      setDrawingOptions((prev) => ({ ...prev, opacity }));
      if (nvRef.current) {
        nvRef.current.setDrawOpacity(opacity);
        debouncedGLUpdate();
      }
    },
    [nvRef, debouncedGLUpdate, setDrawingOptions],
  );

  const handleMagicWand2dOnlyChange = useCallback(
    (checked: boolean) => {
      setDrawingOptions((prev) => ({ ...prev, magicWand2dOnly: checked }));
      if (nvRef.current && drawingOptions.mode === "wand") {
        nvRef.current.opts.clickToSegmentIs2D = checked;
      }
    },
    [nvRef, drawingOptions.mode, setDrawingOptions],
  );

  const handleMagicWandMaxDistanceChange = useCallback(
    (value: number) => {
      setDrawingOptions((prev) => ({ ...prev, magicWandMaxDistanceMM: value }));
      if (nvRef.current && drawingOptions.mode === "wand") {
        nvRef.current.opts.clickToSegmentMaxDistanceMM = value;
      }
    },
    [nvRef, drawingOptions.mode, setDrawingOptions],
  );

  const handleMagicWandThresholdChange = useCallback(
    (value: number) => {
      setDrawingOptions((prev) => ({
        ...prev,
        magicWandThresholdPercent: value,
      }));
      if (nvRef.current && drawingOptions.mode === "wand") {
        nvRef.current.opts.clickToSegmentPercent = value;
      }
    },
    [nvRef, drawingOptions.mode, setDrawingOptions],
  );

  const handleDrawUndo = useCallback(() => {
    if (nvRef.current) {
      nvRef.current.drawUndo();
    }
  }, [nvRef]);

  const handleSaveDrawing = useCallback(async () => {
    if (!nvRef.current || !nvRef.current.drawBitmap) return;
    if (nvRef.current.volumes.length === 0) {
      console.error("No reference volume loaded - cannot save drawing");
      return;
    }

    const nv = nvRef.current;

    try {
      if (drawingOptions.editIntent === "recon") {
        await saveReconEdit(nv, drawingOptions, originalVolumeRef.current);
      } else {
        await saveAsNewVolume(nv, drawingOptions);
      }

      originalVolumeRef.current = null;
      setDrawingOptions((prev) => ({
        ...prev,
        enabled: false,
        mode: "none",
        isDirty: false,
        originalVolumeName: null,
      }));

      setActiveTab("sceneDetails");
      incrementVolumeVersion();
    } catch (error) {
      console.error("Error saving drawing:", error);
    }
  }, [
    nvRef,
    drawingOptions,
    setDrawingOptions,
    setActiveTab,
    incrementVolumeVersion,
    originalVolumeRef,
  ]);

  // Switch between Binary and Multi-label sub-modes within Recon Edit.
  const handleReconModeChange = useCallback(
    (mode: ReconMode) => {
      if (drawingOptions.reconMode === mode) return;

      const newPenValue = mode === "binary" ? 255 : 2;
      setDrawingOptions((prev) => ({
        ...prev,
        reconMode: mode,
        penValue: newPenValue,
        penFill: false,
        penErases: false,
      }));

      if (nvRef.current) {
        if (drawingOptions.mode === "pen" || drawingOptions.mode === "wand") {
          nvRef.current.setPenValue(newPenValue, false);
        }
        if (drawingOptions.mode !== "none") {
          const newColormap = mode === "multilabel" ? "freesurfer" : "recon-edit";
          const cmapArg =
            newColormap === "recon-edit"
              ? (RECON_COLORMAP as unknown as string)
              : newColormap;
          nvRef.current.setDrawColormap(cmapArg);
          nvRef.current.updateGLVolume();
        }
      }
    },
    [nvRef, drawingOptions, setDrawingOptions],
  );

  // Switch the binary edit target: wm.mgz (Remove=1) vs brainmask.mgz (Remove=0).
  const handleReconTargetChange = useCallback(
    (target: ReconTarget) => {
      if (drawingOptions.reconTarget === target) return;

      // Remap pen value if the user was currently on the "remove" value
      let newPenValue = drawingOptions.penValue;
      if (drawingOptions.penValue === 1 && target === "brainmask") {
        newPenValue = 0;
      } else if (drawingOptions.penValue === 0 && target === "wm") {
        newPenValue = 1;
      }

      setDrawingOptions((prev) => ({
        ...prev,
        reconTarget: target,
        penValue: newPenValue,
      }));

      if (nvRef.current && (drawingOptions.mode === "pen" || drawingOptions.mode === "wand")) {
        nvRef.current.setPenValue(newPenValue, drawingOptions.penFill);
      }
    },
    [nvRef, drawingOptions, setDrawingOptions],
  );

  // Auto-switch drawing colormap based on intent and reconMode.
  // Note: we do NOT guard on nv.drawBitmap here. Setting drawLut before the
  // bitmap exists is harmless, and ensures the correct colors are in place
  // the instant setDrawingEnabled(true) calls createEmptyDrawing/refreshDrawing.
  useEffect(() => {
    const nv = nvRef.current;
    if (!nv) return;

    let desired: string;
    if (drawingOptions.editIntent === "voxel") {
      desired = drawingOptions.labels.length > 0 ? "freesurfer" : "red";
    } else if (drawingOptions.editIntent === "recon") {
      desired = drawingOptions.reconMode === "multilabel" ? "freesurfer" : "recon-edit";
    } else if (drawingOptions.editIntent === "roi") {
      desired = "freesurfer";
    } else {
      return;
    }

    if (drawingOptions.colormap !== desired) {
      setDrawingOptions((prev) => ({ ...prev, colormap: desired }));
      nv.setDrawColormap(desired === "recon-edit" ? (RECON_COLORMAP as unknown as string) : desired);
      nv.updateGLVolume();
    }
  }, [
    nvRef,
    drawingOptions.editIntent,
    drawingOptions.reconMode,
    drawingOptions.labels.length,
    drawingOptions.colormap,
    setDrawingOptions,
  ]);

  // Mark dirty on stroke/wand completion
  useEffect(() => {
    const nv = nvRef.current;
    if (!nv) return;

    nv.onMouseUp = () => {
      if (drawingOptions.enabled && drawingOptions.mode === "pen") {
        setDrawingOptions((prev) => ({ ...prev, isDirty: true }));
      }
    };

    nv.onClickToSegment = () => {
      if (drawingOptions.enabled && drawingOptions.mode === "wand") {
        setDrawingOptions((prev) => ({ ...prev, isDirty: true }));
      }
    };

    return () => {
      if (nvRef.current) {
        nvRef.current.onMouseUp = () => {};
        nvRef.current.onClickToSegment = () => {};
      }
    };
  }, [nvRef, drawingOptions.enabled, drawingOptions.mode, setDrawingOptions]);

  const handleDiscardDrawing = useCallback(() => {
    const nv = nvRef.current;
    if (nv) {
      nv.setDrawingEnabled(false);
      nv.setPenValue(0, false);
      nv.opts.clickToSegment = false;
      nv.closeDrawing();
      if (originalVolumeRef.current) {
        nv.addVolume(originalVolumeRef.current);
        originalVolumeRef.current = null;
        incrementVolumeVersion();
      }
    }
    setDrawingOptions((prev) => ({
      ...prev,
      enabled: false,
      mode: "none",
      isDirty: false,
      originalVolumeName: null,
    }));
  }, [nvRef, setDrawingOptions, originalVolumeRef, incrementVolumeVersion]);

  const handleEditIntentChange = useCallback(
    async (newIntent: EditIntent) => {
      if (drawingOptions.editIntent === newIntent) return;

      const preset = applyIntentPreset(newIntent, drawingOptions);
      setDrawingOptions((prev) => ({
        ...prev,
        ...preset,
        isDirty: false,
      }));

      if (nvRef.current && drawingOptions.mode === "pen") {
        const effErases =
          preset.penErases !== undefined
            ? preset.penErases
            : drawingOptions.penErases;
        const effValue = effErases
          ? 0
          : preset.penValue !== undefined
            ? preset.penValue
            : drawingOptions.penValue;
        const effFill =
          preset.penFill !== undefined
            ? preset.penFill
            : drawingOptions.penFill;
        nvRef.current.setPenValue(effValue, effFill);
      }

      if (nvRef.current && nvRef.current.drawBitmap && preset.colormap) {
        const cmapArg = preset.colormap === "recon-edit"
          ? (RECON_COLORMAP as unknown as string)
          : preset.colormap;
        nvRef.current.setDrawColormap(cmapArg);
        nvRef.current.updateGLVolume();
      }
    },
    [drawingOptions, setDrawingOptions, nvRef],
  );

  return {
    syncDrawingOptionsFromNiivue,
    handleCreateDrawingLayer,
    handleDrawingColormapChange,
    handleDrawModeChange,
    handlePenFillChange,
    handlePenErasesChange,
    handlePenValueChange,
    handleDrawingOpacityChange,
    handleMagicWand2dOnlyChange,
    handleMagicWandMaxDistanceChange,
    handleMagicWandThresholdChange,
    handleDrawUndo,
    handleSaveDrawing,
    handleEditIntentChange,
    handleReconModeChange,
    handleReconTargetChange,
    handleDiscardDrawing,
  };
}
