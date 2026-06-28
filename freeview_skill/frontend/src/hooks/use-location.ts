import { useCallback } from "react";
import { useFreeBrowseStore } from "@/store";
import type { Niivue } from "@niivue/niivue";

export function useLocation(nvRef: React.RefObject<Niivue | null>) {
  const setLocationData = useFreeBrowseStore((s) => s.setLocationData);

  const handleLocationChange = useCallback(
    (locationObject: any) => {
      const nv = nvRef.current;
      if (locationObject && nv && nv.volumes.length > 0) {
        const voxelData = nv.volumes.map((volume, index) => {
          const voxel = volume.mm2vox(locationObject.mm);
          const i = Math.round(voxel[0]);
          const j = Math.round(voxel[1]);
          const k = Math.round(voxel[2]);
          const value = volume.getValue(i, j, k, volume.frame4D);

          return {
            name: volume.name || `Volume ${index + 1}`,
            voxel: [i, j, k] as [number, number, number],
            value: value,
          };
        });

        // Read draw bitmap value at crosshair (active drawing case)
        let drawValue: number | null = null;
        if (nv.drawBitmap && nv.back) {
          // convertFrac2Vox uses nvImage.dims, comment in source: "dims === RAS"
          const back = nv.back as any;
          const dims: number[] | undefined = back.dimsRAS ?? back.dims;
          const vox = locationObject.vox; // vec3 from frac2vox, already rounded integers
          if (dims && dims.length >= 4 && vox != null) {
            const nx = dims[1], ny = dims[2];
            const x = Math.round((vox as any)[0]);
            const y = Math.round((vox as any)[1]);
            const z = Math.round((vox as any)[2]);
            const idx = x + y * nx + z * nx * ny;
            if (idx >= 0 && idx < nv.drawBitmap.length) {
              const val = nv.drawBitmap[idx];
              drawValue = val > 0 ? val : null;
            }
          }
        }

        setLocationData({
          mm: locationObject.mm,
          voxels: voxelData,
          drawValue,
        });
      }
    },
    [nvRef, setLocationData],
  );

  return { handleLocationChange };
}
