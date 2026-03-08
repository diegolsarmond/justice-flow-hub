import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare namespace JSX {
  interface IntrinsicElements {
    "spline-viewer": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
      url: string;
      "events-target"?: string;
      "loading-anim"?: string;
      "loading-anim-type"?: string;
    };
  }
}
