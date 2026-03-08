"use client";

import { Suspense, lazy } from "react";
import { cn } from "@/lib/utils";

const Spline = lazy(() => import("./SplineSceneClient"));

export interface SplineSceneProps {
  scene: string;
  className?: string;
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  return (
    <Suspense
      fallback={
        <div className={cn("flex h-full w-full items-center justify-center", className)}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      }
    >
      <Spline scene={scene} className={className} />
    </Suspense>
  );
}
