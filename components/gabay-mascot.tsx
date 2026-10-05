"use client";

import { useId } from "react";

import { gabayMascotClassName, type GabayMascotSize } from "@/lib/gabay-mascot";

const armShape = "M 396 356 C 402 342 399 326 399 309 C 399 285 399 264 407 245 C 419 218 444 215 462 229 C 476 243 470 272 459 297 C 447 323 430 346 410 363 C 403 369 398 366 396 356 Z";

type GabayMascotProps = {
  size?: GabayMascotSize;
  motion?: boolean;
  speaking?: boolean;
};

export function GabayMascot({ size = "medium", motion = true, speaking = false }: GabayMascotProps) {
  const instanceId = useId().replaceAll(":", "");
  const bodyMaskId = `gabay-body-mask-${instanceId}`;
  const armClipId = `gabay-arm-clip-${instanceId}`;
  const auraGradientId = `gabay-aura-${instanceId}`;

  return (
    <span className={gabayMascotClassName(size, motion, speaking)} aria-hidden="true">
      <svg className="gabay-mascot-art" viewBox="0 0 512 512" focusable="false">
        <defs>
          <radialGradient id={auraGradientId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffd875" stopOpacity="0.48" />
            <stop offset="58%" stopColor="#ffc954" stopOpacity="0.21" />
            <stop offset="84%" stopColor="#ffc954" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ffc954" stopOpacity="0" />
          </radialGradient>
          <mask id={bodyMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
            <rect width="512" height="512" fill="white" />
            <path d={armShape} fill="black" />
          </mask>
          <clipPath id={armClipId} clipPathUnits="userSpaceOnUse">
            <path d={armShape} />
          </clipPath>
        </defs>
        <ellipse className="gabay-mascot-aura" cx="256" cy="282" rx="220" ry="210" fill={`url(#${auraGradientId})`} />
        <g className="gabay-mascot-character">
          <image className="gabay-mascot-body" href="/gabay-guiding-lamp-wave.png" width="512" height="512" mask={`url(#${bodyMaskId})`} />
          <g className="gabay-mascot-arm" clipPath={`url(#${armClipId})`}>
            <image href="/gabay-guiding-lamp-wave.png" width="512" height="512" />
          </g>
        </g>
      </svg>
    </span>
  );
}
