import {
  CubeCamera,
  LinearFilter,
  LinearSRGBColorSpace,
  NoToneMapping,
  type Scene,
  WebGLCubeRenderTarget,
  type WebGLRenderer,
} from "three";
import { worldUniforms } from "@/world/store/uniforms";

let target: WebGLCubeRenderTarget | null = null;
let camera: CubeCamera | null = null;

/** Shade the sky once into a cubemap. The on-screen dome and the ocean then sample it. */
export function renderSkyToCube(gl: WebGLRenderer, skyScene: Scene) {
  if (!target || !camera) {
    target = new WebGLCubeRenderTarget(256, {
      generateMipmaps: false,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
    });
    target.texture.colorSpace = LinearSRGBColorSpace;
    camera = new CubeCamera(0.1, 80, target);
  }
  const tone = gl.toneMapping;
  const exposure = gl.toneMappingExposure;
  gl.toneMapping = NoToneMapping;
  gl.toneMappingExposure = 1;
  camera.update(gl, skyScene);
  gl.toneMapping = tone;
  gl.toneMappingExposure = exposure;
  worldUniforms.uSkyMap.value = target.texture;
  worldUniforms.uHasSkyMap.value = 1;
}

export function disposeSkyCube() {
  target?.dispose();
  target = null;
  camera = null;
  worldUniforms.uSkyMap.value = null;
  worldUniforms.uHasSkyMap.value = 0;
}
