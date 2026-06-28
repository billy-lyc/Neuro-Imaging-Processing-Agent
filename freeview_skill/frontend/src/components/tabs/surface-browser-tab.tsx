import { useFreeBrowseStore } from "@/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileList, type FileItem } from "@/components/file-list";
import type { Niivue } from "@niivue/niivue";
import { apiUrl } from "@/lib/api-url";

interface SurfaceBrowserTabProps {
  nvRef: React.RefObject<Niivue | null>;
}

export default function SurfaceBrowserTab({ nvRef }: SurfaceBrowserTabProps) {
  const showUploader = useFreeBrowseStore((s) => s.showUploader);
  const setShowUploader = useFreeBrowseStore((s) => s.setShowUploader);
  const setSurfaces = useFreeBrowseStore((s) => s.setSurfaces);
  const currentSurfaceIndex = useFreeBrowseStore((s) => s.currentSurfaceIndex);
  const setCurrentSurfaceIndex = useFreeBrowseStore((s) => s.setCurrentSurfaceIndex);

  const handleSelect = async (file: FileItem) => {
    const nv = nvRef.current;
    if (!nv) return;
    try {
      if (showUploader) setShowUploader(false);

      let retries = 0;
      while (!nv.canvas && retries < 20) {
        await new Promise((r) => setTimeout(r, 100));
        retries++;
      }
      if (!nv.canvas) return;

      const name = file.filename.split("/").pop() ?? file.filename;
      await nv.addMeshesFromUrl([{
        url: file.url,
        name,
        rgba255: [255, 255, 0, 255] as [number, number, number, number],
        meshShaderIndex: 14,
      }]);
      nv.updateGLVolume();

      if (nv.meshes) {
        const surfaces = nv.meshes.map((mesh: any, i: number) => {
          const rgba255 = mesh.rgba255 ?? new Uint8Array([255, 255, 0, 255]);
          return {
            id: mesh.id,
            name: mesh.name || `Surface ${i + 1}`,
            visible: mesh.visible !== false,
            opacity: mesh.opacity ?? 1.0,
            rgba255: [rgba255[0], rgba255[1], rgba255[2], rgba255[3]] as [number, number, number, number],
            meshShaderIndex: mesh.meshShaderIndex ?? 14,
          };
        });
        setSurfaces(surfaces);
        if (currentSurfaceIndex === null && surfaces.length > 0) {
          setCurrentSurfaceIndex(surfaces.length - 1);
        }
      }
    } catch (err) {
      console.error("Error loading surface:", err);
    }
  };

  return (
    <>
      <div className="border-b px-4 py-3">
        <h2 className="text-lg font-semibold">Surfaces</h2>
        <p className="text-sm text-muted-foreground">
          Add surfaces to the current scene
        </p>
      </div>
      <ScrollArea className="h-full">
        <div className="p-4 pb-6">
          <FileList
            endpoint={apiUrl("/surfaces")}
            onFileSelect={handleSelect}
            emptyMessage="No surface files found."
          />
        </div>
      </ScrollArea>
    </>
  );
}
