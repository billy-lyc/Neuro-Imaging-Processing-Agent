import { ScrollArea } from "@/components/ui/scroll-area";
import { FileList, type FileItem } from "@/components/file-list";

interface SurfaceDataTabProps {
  onFileSelect: (file: FileItem) => void;
}

export default function SurfaceDataTab({ onFileSelect }: SurfaceDataTabProps) {
  return (
    <>
      <div className="border-b px-4 py-3">
        <h2 className="text-lg font-semibold">Surface Data</h2>
        <p className="text-sm text-muted-foreground">
          Add surface meshes to the current scene
        </p>
      </div>
      <ScrollArea className="h-full">
        <div className="p-4 pb-6">
          <FileList
            endpoint="/surfaces"
            onFileSelect={onFileSelect}
            emptyMessage="No surface files available."
          />
        </div>
      </ScrollArea>
    </>
  );
}
