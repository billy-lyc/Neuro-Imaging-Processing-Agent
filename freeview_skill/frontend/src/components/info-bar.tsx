import { useEffect, useRef, useState } from "react";
import { useFreeBrowseStore } from "@/store";
import { Pencil, Check, X } from "lucide-react";
import type { Niivue } from "@niivue/niivue";

const INSTITUTION = "The University of North Carolina at Chapel Hill";

function stemFromFilename(name: string): string {
  return name
    .split(/[/\\]/).pop()!
    .replace(/\.(nii\.gz|nii|mgz|mgh|nrrd|mnc|dcm|json)$/i, "");
}

interface InfoBarProps {
  nvRef: React.RefObject<Niivue | null>;
}

export default function InfoBar({ nvRef }: InfoBarProps) {
  const subjectId = useFreeBrowseStore((s) => s.subjectId);
  const setSubjectId = useFreeBrowseStore((s) => s.setSubjectId);
  const volumeVersion = useFreeBrowseStore((s) => s.volumeVersion);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-detect subject from the first loaded volume when none is set yet
  useEffect(() => {
    if (subjectId !== null) return;
    const name = nvRef.current?.volumes?.[0]?.name;
    if (name) setSubjectId(stemFromFilename(name));
  }, [volumeVersion, nvRef, subjectId, setSubjectId]);

  const startEdit = () => {
    setDraft(subjectId ?? "");
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    const trimmed = draft.trim();
    setSubjectId(trimmed || null);
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") cancel();
  };

  return (
    <div className="border-b bg-muted/40 px-6 py-1 flex items-center gap-3 text-xs text-muted-foreground select-none">
      {/* Subject — only shown when known */}
      {(subjectId !== null || editing) && (
        <>
          <span className="font-medium text-foreground/70">Subject:</span>
          {editing ? (
            <span className="flex items-center gap-1">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={commit}
                className="w-32 border-b border-border bg-transparent outline-none text-foreground text-xs px-0.5"
                autoFocus
              />
              <button type="button" onMouseDown={commit} className="hover:text-foreground" tabIndex={-1}>
                <Check className="h-3 w-3" />
              </button>
              <button type="button" onMouseDown={cancel} className="hover:text-foreground" tabIndex={-1}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : (
            <span className="flex items-center gap-1 group cursor-pointer" onClick={startEdit}>
              <span className="text-foreground">{subjectId}</span>
              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
            </span>
          )}
          <span className="text-muted-foreground/50">·</span>
        </>
      )}

      {/* Institution — always shown */}
      <span className="font-medium text-foreground/70">Institution:</span>
      <span>{INSTITUTION}</span>

      {/* If no subject yet, offer a button to add one */}
      {subjectId === null && !editing && (
        <button
          type="button"
          onClick={startEdit}
          className="ml-1 text-muted-foreground/60 hover:text-foreground transition-colors underline underline-offset-2"
        >
          + Add subject
        </button>
      )}
    </div>
  );
}
