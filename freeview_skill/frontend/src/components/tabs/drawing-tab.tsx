import { useState } from "react";
import { useFreeBrowseStore } from "@/store";
import { cmapper } from "@niivue/niivue";
import {
  Save,
  Pencil,
  Undo,
  X as XIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { LabeledSliderWithInput } from "@/components/ui/labeled-slider-with-input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { EditIntent, Label as LabelType, ReconMode, ReconTarget } from "@/store/types";
import { FREESURFER_STRUCTURES } from "@/lib/freesurfer-structures";
import { createPortal } from "react-dom";

interface DrawingTabProps {
  onEditIntentChange: (intent: EditIntent) => Promise<void>;
  onReconModeChange: (mode: ReconMode) => void;
  onReconTargetChange: (target: ReconTarget) => void;
  onDrawModeChange: (mode: "none" | "pen" | "wand") => void;
  onPenFillChange: (checked: boolean) => void;
  onPenErasesChange: (checked: boolean) => void;
  onPenValueChange: (value: number) => void;
  onDrawingOpacityChange: (value: number) => void;
  onMagicWand2dOnlyChange: (checked: boolean) => void;
  onMagicWandMaxDistanceChange: (value: number) => void;
  onMagicWandThresholdChange: (value: number) => void;
  onDiscardDrawing: () => void;
  onDrawUndo: () => void;
  onSaveDrawing: () => void;
  getVolumes: () => Array<{ name?: string; id?: string }>;
}

// The freesurfer LUT only defines colors at these 49 specific indices.
// All other indices map to transparent in makeDrawLut.
const FREESURFER_PALETTE_VALUES = [
  2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 24, 26, 28, 30, 31,
  41, 42, 43, 44, 46, 47, 49, 50, 51, 52, 53, 54, 58, 60, 62, 63, 72, 77, 78,
  79, 80, 81, 82, 85, 251, 252, 253, 254, 255,
];

function freesurferColor(value: number): string {
  const lut = cmapper.colormap("freesurfer");
  const i = Math.max(0, Math.min(255, value)) * 4;
  return `rgb(${lut[i]},${lut[i + 1]},${lut[i + 2]})`;
}

export default function DrawingTab({
  onEditIntentChange,
  onReconModeChange,
  onReconTargetChange,
  onDrawModeChange,
  onPenFillChange,
  onPenErasesChange,
  onPenValueChange,
  onDrawingOpacityChange,
  onMagicWand2dOnlyChange,
  onMagicWandMaxDistanceChange,
  onMagicWandThresholdChange,
  onDrawUndo,
  onSaveDrawing,
  onDiscardDrawing,
  getVolumes,
}: DrawingTabProps) {
  const drawingOptions = useFreeBrowseStore((s) => s.drawingOptions);
  const setDrawingOptions = useFreeBrowseStore((s) => s.setDrawingOptions);

  // Add-Label inline form state
  const [showAddLabel, setShowAddLabel] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showReconStructurePicker, setShowReconStructurePicker] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<EditIntent | null>(null);
  const volumes = getVolumes();

  // Remove value depends on target: wm uses 1, brainmask uses 0
  const binaryRemoveValue = drawingOptions.reconTarget === "brainmask" ? 0 : 1;

  const reconModeDescription =
    drawingOptions.reconMode === "multilabel"
      ? "Paint individual brain structures by label (aseg.presurf.mgz). Erase=0 (background)."
      : drawingOptions.reconTarget === "brainmask"
      ? "Add brain tissue (255) or Remove (0) for brainmask.mgz."
      : "Add white matter (255) or Remove / mark for deletion (1) for wm.mgz.";

  const intentInfo: Record<EditIntent, string> = {
    voxel:
      "Free editing. Pick any pen value 1–255 (use labels for organization). Saves as a new overlay volume.",
    recon: reconModeDescription,
    roi: "Binary ROI mask. Pen=1. Saves as a new overlay volume.",
  };

  const saveBtnLabel =
    drawingOptions.editIntent === "recon" ? "Save & Write Back" : "Save Drawing";

  const resetAddForm = () => {
    setShowAddLabel(false);
    setShowColorPicker(false);
    setNewName("");
    setNewValue("");
    setFormError(null);
  };

  const handleSaveLabel = () => {
    const trimmed = newName.trim();
    const valueNum = parseInt(newValue, 10);
    if (!trimmed) {
      setFormError("Name is required");
      return;
    }
    if (isNaN(valueNum) || valueNum < 1 || valueNum > 255) {
      setFormError("Please choose a brain region");
      return;
    }
    if (drawingOptions.labels.some((l) => l.value === valueNum)) {
      setFormError(`Value ${valueNum} already in use`);
      return;
    }

    const newLabel: LabelType = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `label-${Date.now()}-${Math.random()}`,
      name: trimmed,
      value: valueNum,
    };

    setDrawingOptions((prev) => ({
      ...prev,
      labels: [...prev.labels, newLabel],
      activeLabelId: newLabel.id,
    }));
    onPenValueChange(valueNum);
    resetAddForm();
  };

  const handleActivateLabel = (label: LabelType) => {
    setDrawingOptions((prev) => ({ ...prev, activeLabelId: label.id }));
    onPenValueChange(label.value);
  };

  const handleDeleteLabel = (id: string) => {
    setDrawingOptions((prev) => ({
      ...prev,
      labels: prev.labels.filter((l) => l.id !== id),
      activeLabelId: prev.activeLabelId === id ? null : prev.activeLabelId,
    }));
  };

  const handleIntentSelectChange = (newIntent: EditIntent) => {
    if (newIntent === drawingOptions.editIntent) return;
    if (drawingOptions.isDirty) {
      setPendingIntent(newIntent);
    } else {
      onEditIntentChange(newIntent);
    }
  };

  const handleDialogSave = async () => {
    const target = pendingIntent;
    if (!target) return;
    setPendingIntent(null);
    onSaveDrawing();
    await onEditIntentChange(target);
  };

  const handleDialogDiscard = async () => {
    const target = pendingIntent;
    if (!target) return;
    setPendingIntent(null);
    onDiscardDrawing();
    await onEditIntentChange(target);
  };

  const handleDialogCancel = () => {
    setPendingIntent(null);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b px-4 py-3 shrink-0">
        <h2 className="text-lg font-semibold">Drawing Tools</h2>
        <p className="text-sm text-muted-foreground">Edit annotations</p>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {drawingOptions.enabled ? (
            <>
              {/* ====== Edit Intent Selector ====== */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Edit Mode</Label>
                <Select
                  value={drawingOptions.editIntent}
                  onChange={(e) =>
                    handleIntentSelectChange(e.target.value as EditIntent)
                  }
                >
                  <option value="voxel">Voxel Edit (general)</option>
                  <option value="recon">Recon Edit (FreeSurfer)</option>
                  <option value="roi">ROI Edit (binary mask)</option>
                </Select>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {intentInfo[drawingOptions.editIntent]}
                </p>
              </div>

              {/* ====== Recon: editing target volume ====== */}
              {drawingOptions.editIntent === "recon" && (
                <div className="space-y-2">
                  {drawingOptions.originalVolumeName ? (
                    <>
                      <Label className="text-sm font-medium">Editing</Label>
                      <p className="text-sm text-muted-foreground">
                        {drawingOptions.originalVolumeName}
                      </p>
                    </>
                  ) : (
                    <>
                      <Label className="text-sm font-medium">Reference Volume</Label>
                      {volumes.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No volumes loaded.</p>
                      ) : (
                        <>
                          <Select
                            value={String(drawingOptions.referenceVolumeIndex ?? 0)}
                            onChange={(e) => {
                              const idx = parseInt(e.target.value, 10);
                              setDrawingOptions((prev) => ({
                                ...prev,
                                referenceVolumeIndex: isNaN(idx) ? 0 : idx,
                              }));
                            }}
                          >
                            {volumes.map((vol, idx) => (
                              <option key={vol.id ?? idx} value={String(idx)}>
                                [{idx}] {vol.name ?? `Volume ${idx}`}
                              </option>
                            ))}
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Edits will be written back to this volume on save.
                          </p>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ====== Recon sub-mode: Binary vs Multi-label ====== */}
              {drawingOptions.editIntent === "recon" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Sub-mode</Label>
                  <div className="flex rounded-md border overflow-hidden text-sm">
                    <button
                      type="button"
                      onClick={() => onReconModeChange("binary")}
                      className={cn(
                        "flex-1 py-1.5 transition-colors",
                        drawingOptions.reconMode === "binary"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      Binary
                    </button>
                    <button
                      type="button"
                      onClick={() => onReconModeChange("multilabel")}
                      className={cn(
                        "flex-1 py-1.5 border-l transition-colors",
                        drawingOptions.reconMode === "multilabel"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      Multi-label
                    </button>
                  </div>
                </div>
              )}

              {/* ====== Recon Binary: file target (wm vs brainmask) ====== */}
              {drawingOptions.editIntent === "recon" && drawingOptions.reconMode === "binary" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">File</Label>
                  <div className="flex rounded-md border overflow-hidden text-sm">
                    <button
                      type="button"
                      onClick={() => onReconTargetChange("wm")}
                      className={cn(
                        "flex-1 py-1.5 transition-colors",
                        drawingOptions.reconTarget === "wm"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      wm.mgz
                    </button>
                    <button
                      type="button"
                      onClick={() => onReconTargetChange("brainmask")}
                      className={cn(
                        "flex-1 py-1.5 border-l transition-colors",
                        drawingOptions.reconTarget === "brainmask"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      brainmask.mgz
                    </button>
                  </div>
                </div>
              )}

              {/* ====== Labels (voxel only) ====== */}
              {drawingOptions.editIntent === "voxel" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Labels</Label>

                  {drawingOptions.labels.length > 0 ? (
                    <div className="border rounded-md divide-y">
                      {drawingOptions.labels.map((label) => {
                        const isActive =
                          label.id === drawingOptions.activeLabelId;
                        return (
                          <div
                            key={label.id}
                            className={cn(
                              "flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-muted/50 transition-colors",
                              isActive && "bg-muted",
                            )}
                            onClick={() => handleActivateLabel(label)}
                          >
                            <div
                              className="w-4 h-4 rounded border border-border flex-shrink-0"
                              style={{ backgroundColor: freesurferColor(label.value) }}
                            />
                            <span className="flex-1 text-sm truncate">
                              {label.name}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {label.value}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLabel(label.id);
                              }}
                              className="text-muted-foreground hover:text-destructive p-0.5"
                              aria-label="Delete label"
                            >
                              <XIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No labels yet. Add one to organize your edits.
                    </p>
                  )}

                  {showAddLabel ? (
                    showColorPicker ? (
                      /* ── Structure picker secondary page ── */
                      <div className="border rounded-md bg-muted/30 overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 border-b bg-background">
                          <button
                            type="button"
                            onClick={() => setShowColorPicker(false)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="text-sm font-medium flex-1">Choose Brain Region</span>
                          {newValue && (
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-4 h-4 rounded-sm border border-border"
                                style={{ backgroundColor: freesurferColor(parseInt(newValue, 10)) }}
                              />
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {newValue}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="overflow-y-auto max-h-72 divide-y divide-border/50">
                          {FREESURFER_STRUCTURES.map((s) => {
                            const alreadyUsed = drawingOptions.labels.some((l) => l.value === s.value);
                            const isSelected = newValue === String(s.value);
                            return (
                              <button
                                key={s.value}
                                type="button"
                                disabled={alreadyUsed}
                                onClick={() => {
                                  setNewValue(String(s.value));
                                  setNewName(s.name);
                                  setFormError(null);
                                  setShowColorPicker(false);
                                }}
                                className={cn(
                                  "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                                  isSelected && "bg-muted",
                                  alreadyUsed
                                    ? "opacity-40 cursor-not-allowed"
                                    : "hover:bg-muted cursor-pointer",
                                )}
                              >
                                <div
                                  className="w-4 h-4 rounded-sm border border-border flex-shrink-0"
                                  style={{ backgroundColor: freesurferColor(s.value) }}
                                />
                                <span className="flex-1 truncate">{s.name}</span>
                                <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                                  {alreadyUsed ? "✓" : s.value}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* ── Main add-label form ── */
                      <div className="border rounded-md p-3 space-y-2 bg-muted/30">
                        <Input
                          placeholder="Label name (editable)"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowColorPicker(true)}
                          className="w-full flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-muted transition-colors text-sm"
                        >
                          {newValue ? (
                            <>
                              <div
                                className="w-4 h-4 rounded-sm border border-border flex-shrink-0"
                                style={{ backgroundColor: freesurferColor(parseInt(newValue, 10)) }}
                              />
                              <span className="flex-1 truncate text-left">
                                {FREESURFER_STRUCTURES.find((s) => String(s.value) === newValue)?.name ?? `Value ${newValue}`}
                              </span>
                              <span className="text-xs text-muted-foreground flex-shrink-0">{newValue}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Choose a brain region…</span>
                          )}
                          <ChevronRight className="h-4 w-4 ml-2 text-muted-foreground flex-shrink-0" />
                        </button>
                        {formError && (
                          <p className="text-xs text-destructive">{formError}</p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveLabel}
                            className="flex-1"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={resetAddForm}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowAddLabel(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Label
                    </Button>
                  )}
                </div>
              )}

              {/* ====== Color Palette (ROI only) ====== */}
              {drawingOptions.editIntent === "roi" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Pen Color</Label>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded border border-border flex-shrink-0"
                      style={{ backgroundColor: freesurferColor(drawingOptions.penValue) }}
                    />
                    <span className="text-xs text-muted-foreground">
                      Value: {drawingOptions.penValue}
                    </span>
                  </div>
                  <div className="grid grid-cols-8 gap-1">
                    {FREESURFER_PALETTE_VALUES.map((v) => (
                      <button
                        key={v}
                        type="button"
                        title={`Value ${v}`}
                        onClick={() => onPenValueChange(v)}
                        className={cn(
                          "w-full aspect-square rounded-sm border-2 transition-colors",
                          drawingOptions.penValue === v
                            ? "border-foreground scale-110"
                            : "border-transparent hover:border-muted-foreground",
                        )}
                        style={{ backgroundColor: freesurferColor(v) }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Drawing Filename */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Filename</Label>
                <Input
                  type="text"
                  value={drawingOptions.filename}
                  onChange={(e) =>
                    setDrawingOptions((prev) => ({
                      ...prev,
                      filename: e.target.value,
                    }))
                  }
                  placeholder="Enter filename..."
                />
              </div>

              {/* Drawing Opacity */}
              <LabeledSliderWithInput
                label="Drawing Opacity"
                value={drawingOptions.opacity}
                onValueChange={onDrawingOpacityChange}
                min={0}
                max={1}
                step={0.01}
              />

              {/* Draw Mode — hidden in voxel mode until at least one label exists */}
              {(drawingOptions.editIntent !== "voxel" || drawingOptions.labels.length > 0) && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Draw Mode</Label>
                  <Select
                    value={drawingOptions.mode}
                    onChange={(e) =>
                      onDrawModeChange(
                        e.target.value as "none" | "pen" | "wand",
                      )
                    }
                  >
                    <option value="none">None</option>
                    <option value="pen">Pen</option>
                    <option value="wand">Magic Wand</option>
                  </Select>
                </div>
              )}

              {/* Undo */}
              {(drawingOptions.editIntent !== "voxel" || drawingOptions.labels.length > 0) &&
                (drawingOptions.mode === "pen" || drawingOptions.mode === "wand") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={onDrawUndo}
                >
                  <Undo className="mr-2 h-4 w-4" />
                  Undo
                </Button>
              )}

              {/* Pen-related controls */}
              {(drawingOptions.editIntent !== "voxel" || drawingOptions.labels.length > 0) &&
                (drawingOptions.mode === "pen" || drawingOptions.mode === "wand") && (
                <>
                  {/* Add / Remove — binary recon only */}
                  {drawingOptions.editIntent === "recon" && drawingOptions.reconMode === "binary" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Action</Label>
                      <div className="flex rounded-md border overflow-hidden text-sm">
                        <button
                          type="button"
                          onClick={() => onPenValueChange(255)}
                          className={cn(
                            "flex-1 py-1.5 transition-colors",
                            drawingOptions.penValue === 255
                              ? "bg-green-600 text-white"
                              : "hover:bg-muted",
                          )}
                        >
                          Add (255)
                        </button>
                        <button
                          type="button"
                          onClick={() => onPenValueChange(binaryRemoveValue)}
                          className={cn(
                            "flex-1 py-1.5 border-l transition-colors",
                            drawingOptions.penValue === binaryRemoveValue
                              ? "bg-red-600 text-white"
                              : "hover:bg-muted",
                          )}
                        >
                          Remove ({binaryRemoveValue})
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Structure picker — multi-label recon only */}
                  {drawingOptions.editIntent === "recon" && drawingOptions.reconMode === "multilabel" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Structure</Label>
                      {showReconStructurePicker ? (
                        <div className="border rounded-md bg-muted/30 overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-2 border-b bg-background">
                            <button
                              type="button"
                              onClick={() => setShowReconStructurePicker(false)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="text-sm font-medium flex-1">Choose Brain Region</span>
                            {drawingOptions.penValue > 0 && (
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="w-4 h-4 rounded-sm border border-border"
                                  style={{ backgroundColor: freesurferColor(drawingOptions.penValue) }}
                                />
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {drawingOptions.penValue}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="overflow-y-auto max-h-72 divide-y divide-border/50">
                            {FREESURFER_STRUCTURES.map((s) => {
                              const isSelected = drawingOptions.penValue === s.value;
                              return (
                                <button
                                  key={s.value}
                                  type="button"
                                  onClick={() => {
                                    onPenValueChange(s.value);
                                    setShowReconStructurePicker(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors cursor-pointer",
                                    isSelected ? "bg-muted" : "hover:bg-muted",
                                  )}
                                >
                                  <div
                                    className="w-4 h-4 rounded-sm border border-border flex-shrink-0"
                                    style={{ backgroundColor: freesurferColor(s.value) }}
                                  />
                                  <span className="flex-1 truncate">{s.name}</span>
                                  <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                                    {s.value}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => setShowReconStructurePicker(true)}
                            className="w-full flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-muted transition-colors text-sm"
                          >
                            {drawingOptions.penValue > 0 ? (
                              <>
                                <div
                                  className="w-4 h-4 rounded-sm border border-border flex-shrink-0"
                                  style={{ backgroundColor: freesurferColor(drawingOptions.penValue) }}
                                />
                                <span className="flex-1 truncate text-left">
                                  {FREESURFER_STRUCTURES.find((s) => s.value === drawingOptions.penValue)?.name ?? `Value ${drawingOptions.penValue}`}
                                </span>
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  {drawingOptions.penValue}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Choose a structure…</span>
                            )}
                            <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground flex-shrink-0" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onPenValueChange(0)}
                            className={cn(
                              "w-full py-1.5 border rounded-md text-sm transition-colors",
                              drawingOptions.penValue === 0
                                ? "bg-destructive/20 border-destructive text-destructive"
                                : "hover:bg-muted",
                            )}
                          >
                            Erase (background)
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {drawingOptions.mode === "pen" && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="pen-fill"
                        checked={drawingOptions.penFill}
                        onCheckedChange={onPenFillChange}
                      />
                      <Label htmlFor="pen-fill" className="text-sm font-medium">
                        Pen Fill
                      </Label>
                    </div>
                  )}

                  {drawingOptions.mode === "pen" && drawingOptions.editIntent !== "recon" && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="pen-erases"
                        checked={drawingOptions.penErases}
                        onCheckedChange={onPenErasesChange}
                      />
                      <Label htmlFor="pen-erases" className="text-sm font-medium">
                        Pen Erases
                      </Label>
                    </div>
                  )}

                  {drawingOptions.mode === "wand" && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="magic-wand-2d-only"
                        checked={drawingOptions.magicWand2dOnly}
                        onCheckedChange={onMagicWand2dOnlyChange}
                      />
                      <Label
                        htmlFor="magic-wand-2d-only"
                        className="text-sm font-medium"
                      >
                        2D Only
                      </Label>
                    </div>
                  )}

                  {drawingOptions.mode === "wand" && (
                    <LabeledSliderWithInput
                      label="Max Distance (mm)"
                      value={drawingOptions.magicWandMaxDistanceMM}
                      onValueChange={onMagicWandMaxDistanceChange}
                      min={2}
                      max={500}
                      step={1}
                    />
                  )}

                  {drawingOptions.mode === "wand" && (
                    <LabeledSliderWithInput
                      label="Threshold Percentage"
                      value={drawingOptions.magicWandThresholdPercent}
                      onValueChange={onMagicWandThresholdChange}
                      min={0.0}
                      max={1.0}
                      step={0.01}
                    />
                  )}
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center text-muted-foreground">
              <Pencil className="h-8 w-8 mb-2" />
              <p>No drawing layer active</p>
              <p className="text-xs">
                Create a drawing layer to access drawing tools
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ====== Sticky Save Footer ====== */}
      {drawingOptions.enabled && (
        <div className="border-t p-3 shrink-0 bg-background">
          <Button
            variant="default"
            size="sm"
            className="w-full"
            onClick={onSaveDrawing}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveBtnLabel}
          </Button>
        </div>
      )}

      {/* ====== Unsaved-changes Confirm Dialog ====== */}
      {pendingIntent &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={handleDialogCancel}
          >
            <div
              className="bg-background border rounded-lg shadow-2xl max-w-md w-full mx-4 p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-1.5">
                <h3 className="text-lg font-semibold">Unsaved changes</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  You have unsaved drawing changes. What would you like to do before
                  switching to{" "}
                  <span className="font-medium text-foreground">
                    {pendingIntent === "voxel" && "Voxel Edit"}
                    {pendingIntent === "recon" && "Recon Edit"}
                    {pendingIntent === "roi" && "ROI Edit"}
                  </span>
                  ?
                </p>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
                <Button variant="ghost" onClick={handleDialogCancel}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDialogDiscard}>
                  Discard
                </Button>
                <Button onClick={handleDialogSave}>Save &amp; Switch</Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
