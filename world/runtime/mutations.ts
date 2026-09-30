import { perfStats } from "@/world/debug/perfStats";
import {
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  NoColorSpace,
  SRGBColorSpace,
  type Camera,
  type Color,
  type Matrix4,
  type MeshLambertMaterial,
  type MeshStandardMaterial,
  type PerspectiveCamera,
  type Scene,
  type ShaderMaterial,
  type Texture,
  type Vector3,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";
import { transitionMotion } from "@/world/store/transition";
import { worldTime } from "@/world/store/worldTime";

export function watchRender(gl: WebGLRenderer) {
  const marked = gl as WebGLRenderer & { __yedgarWatch?: boolean };
  if (marked.__yedgarWatch) return;
  marked.__yedgarWatch = true;
  const original = gl.render.bind(gl);
  gl.render = (scene: Scene, camera: Parameters<WebGLRenderer["render"]>[1]) => {
    const start = performance.now();
    original(scene, camera);
    perfStats.renderMs = performance.now() - start;
  };
}

export function setExposure(gl: WebGLRenderer) {
  gl.toneMappingExposure = worldTime.get().exposure * (1 - transitionMotion.dip * 0.85);
}

export function fitPerspective(camera: PerspectiveCamera, fov: number, aspect: number) {
  camera.fov = fov;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}

export function prepareArtTexture(texture: Texture, anisotropy: number) {
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
}

export function assignArtMap(material: MeshStandardMaterial | MeshLambertMaterial, texture: Texture) {
  material.map = texture;
  material.emissiveMap = texture;
  material.needsUpdate = true;
}

export function setEmissiveIntensity(material: { emissiveIntensity: number }, value: number) {
  material.emissiveIntensity = value;
}

export function prepareNormalMap(texture: Texture) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = NoColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
}

export function setUniformTexture(material: ShaderMaterial, name: string, texture: Texture) {
  const slot = material.uniforms[name];
  if (slot) slot.value = texture;
}

export function publishEnvironment(scene: Scene, texture: Texture | null, day: number) {
  scene.environment = texture;
  scene.environmentIntensity = 0.9 + day * 0.65;
}

const waterY = 0;

export function drawPlanarReflection(args: {
  gl: WebGLRenderer;
  scene: Scene;
  camera: Camera;
  width: number;
  height: number;
  mirror: PerspectiveCamera;
  direction: Vector3;
  look: Vector3;
  clear: Color;
  matrix: Matrix4;
  target: WebGLRenderTarget;
  material: ShaderMaterial;
}) {
  const { gl, scene, camera, width, height, mirror, direction, look, clear, matrix, target, material } = args;
  const persp = camera as PerspectiveCamera;
  if (target.width !== width || target.height !== height) target.setSize(width, height);
  mirror.fov = persp.fov;
  mirror.aspect = persp.aspect;
  mirror.near = persp.near;
  mirror.far = persp.far;
  mirror.position.set(persp.position.x, waterY * 2 - persp.position.y, persp.position.z);
  persp.getWorldDirection(direction);
  look.copy(persp.position).add(direction);
  look.set(look.x, waterY * 2 - look.y, look.z);
  mirror.up.set(0, -1, 0);
  mirror.lookAt(look);
  mirror.layers.set(2);
  mirror.updateProjectionMatrix();
  mirror.updateMatrixWorld();

  matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  matrix.multiply(mirror.projectionMatrix);
  matrix.multiply(mirror.matrixWorldInverse);

  const previousTarget = gl.getRenderTarget();
  const previousAutoClear = gl.autoClear;
  const previousColor = gl.getClearColor(clear);
  const previousAlpha = gl.getClearAlpha();
  gl.setRenderTarget(target);
  gl.autoClear = true;
  gl.setClearColor(0x000000, 0);
  gl.clear(true, true, true);
  gl.render(scene, mirror);
  gl.setRenderTarget(previousTarget);
  gl.setClearColor(previousColor, previousAlpha);
  gl.autoClear = previousAutoClear;

  const reflection = material.uniforms.uReflection;
  const reflMatrix = material.uniforms.uReflMatrix;
  const has = material.uniforms.uHasReflection;
  if (reflection) reflection.value = target.texture;
  if (reflMatrix) reflMatrix.value = matrix;
  if (has) has.value = 1;
}
