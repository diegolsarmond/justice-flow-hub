import { useEffect } from 'react'
import { cn } from "@/lib/utils"

interface SplineSceneProps {
  scene: string
  className?: string
}

const VIEWER_SCRIPT_ID = "spline-viewer-script";
const VIEWER_SCRIPT_SRC = "https://unpkg.com/@splinetool/viewer@1.9.395/build/spline-viewer.js";

const ensureViewerScript = () => {
  if (document.getElementById(VIEWER_SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = VIEWER_SCRIPT_ID;
  script.src = VIEWER_SCRIPT_SRC;
  script.type = "module";
  script.async = true;
  document.head.appendChild(script);
};

export function SplineScene({ scene, className }: SplineSceneProps) {
  useEffect(() => { ensureViewerScript(); }, []);

  return (
    <spline-viewer
      url={scene}
      className={cn("block w-full h-full", className)}
      events-target="global"
      loading-anim="spinner"
    />
  );
}
