"use client";

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  Color,
  Matrix4,
  PerspectiveCamera,
  Vector3,
  WebGLRenderTarget,
  type ShaderMaterial,
} from "three";
import { drawPlanarReflection } from "@/world/runtime/mutations";

/** Planar mirror of layer 2 (cards + sky). High tier only. */
export function Reflection({ material }: { material: ShaderMaterial }) {
  const { gl, scene, camera, size } = useThree();
  const mirror = useMemo(() => new PerspectiveCamera(40, 1, 0.15, 900), []);
  const direction = useMemo(() => new Vector3(), []);
  const look = useMemo(() => new Vector3(), []);
  const clear = useMemo(() => new Color(), []);
  const matrix = useMemo(() => new Matrix4(), []);
  const rt = useMemo(() => {
    const half =
      Boolean(gl.getContext().getExtension("EXT_color_buffer_float")) ||
      Boolean(gl.getContext().getExtension("EXT_color_buffer_half_float"));
    const buffer = new WebGLRenderTarget(2, 2, {
      type: half ? HalfFloatType : undefined,
      depthBuffer: true,
    });
    buffer.texture.colorSpace = LinearSRGBColorSpace;
    buffer.texture.minFilter = LinearFilter;
    buffer.texture.magFilter = LinearFilter;
    buffer.texture.generateMipmaps = false;
    return buffer;
  }, [gl]);

  useFrame(() => {
    const pixelRatio = gl.getPixelRatio();
    drawPlanarReflection({
      gl,
      scene,
      camera,
      width: Math.max(2, Math.floor(size.width * pixelRatio * 0.5)),
      height: Math.max(2, Math.floor(size.height * pixelRatio * 0.5)),
      mirror,
      direction,
      look,
      clear,
      matrix,
      target: rt,
      material,
    });
  }, 0);

  return null;
}
