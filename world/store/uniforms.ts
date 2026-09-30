import {
  Color,
  Vector2,
  Vector3,
  type Texture,
  type WebGLRenderer,
} from "three";
import { worldTime } from "@/world/store/worldTime";
import { sceneAtmosphere } from "@/world/store/atmosphere";
import { interaction } from "@/world/store/interaction";

/** Shared uniform objects. Materials reference these; the clock writes them once per frame. */
export const worldUniforms = {
  uTime: { value: 0 },
  uSunDir: { value: new Vector3(0, 1, 0) },
  uMoonDir: { value: new Vector3(0, -1, 0) },
  uSunColor: { value: new Color(1, 1, 1) },
  uMoonColor: { value: new Color(0.62, 0.7, 0.95) },
  uZenith: { value: new Color(0.2, 0.42, 0.78) },
  uHorizon: { value: new Color(0.66, 0.74, 0.82) },
  uFogColor: { value: new Color(0.66, 0.74, 0.82) },
  uAmbientSky: { value: new Color(0.45, 0.52, 0.64) },
  uAmbientGround: { value: new Color(0.18, 0.15, 0.16) },
  uDay: { value: 1 },
  uNight: { value: 0 },
  uTwilight: { value: 0 },
  uSunVis: { value: 1 },
  uFogDensity: { value: 0.008 },
  uWaveEnergy: { value: 1 },
  uWindAngle: { value: 0 },
  uWindStrength: { value: 1 },
  uCloudOffset: { value: new Vector2() },
  uCloudCoverage: { value: 0.45 },
  uStarRot: { value: 0 },
  uCursor: { value: new Vector3() },
  uCursorOn: { value: 0 },
  uResolution: { value: new Vector2(1, 1) },
  uAspect: { value: 1 },
  uSkyMap: { value: null as Texture | null },
  uHasSkyMap: { value: 0 },
};

export function syncWorldUniforms(gl: WebGLRenderer, width: number, height: number) {
  const s = worldTime.get();
  worldUniforms.uTime.value = s.elapsed;
  worldUniforms.uSunDir.value.set(s.sunDir.x, s.sunDir.y, s.sunDir.z);
  worldUniforms.uMoonDir.value.set(s.moonDir.x, s.moonDir.y, s.moonDir.z);
  worldUniforms.uSunColor.value.setRGB(s.sunColor[0], s.sunColor[1], s.sunColor[2]);
  worldUniforms.uMoonColor.value.setRGB(s.moonColor[0], s.moonColor[1], s.moonColor[2]);
  worldUniforms.uZenith.value.setRGB(s.zenith[0], s.zenith[1], s.zenith[2]);
  worldUniforms.uHorizon.value.setRGB(s.horizon[0], s.horizon[1], s.horizon[2]);
  worldUniforms.uFogColor.value.setRGB(s.fogColor[0], s.fogColor[1], s.fogColor[2]);
  worldUniforms.uAmbientSky.value.setRGB(s.ambientSky[0], s.ambientSky[1], s.ambientSky[2]);
  worldUniforms.uAmbientGround.value.setRGB(
    s.ambientGround[0],
    s.ambientGround[1],
    s.ambientGround[2],
  );
  worldUniforms.uDay.value = s.dayFactor;
  worldUniforms.uNight.value = s.night;
  worldUniforms.uTwilight.value = s.twilight;
  worldUniforms.uSunVis.value = Math.min(1, Math.max(0, (s.sunDir.y + 0.05) / 0.2));
  worldUniforms.uFogDensity.value = sceneAtmosphere.fogDensity;
  worldUniforms.uWaveEnergy.value = s.waveEnergy;
  worldUniforms.uWindAngle.value = s.windAngle;
  worldUniforms.uWindStrength.value = s.windStrength;
  worldUniforms.uCloudOffset.value.set(
    Math.cos(s.windAngle) * s.elapsed * 0.35,
    Math.sin(s.windAngle) * s.elapsed * 0.22,
  );
  worldUniforms.uCloudCoverage.value = sceneAtmosphere.cloudCoverage;
  worldUniforms.uStarRot.value = s.timeOfDay * Math.PI * 2;
  const cursor = interaction.get();
  worldUniforms.uCursor.value.set(cursor.cursorX, cursor.cursorY, cursor.cursorZ);
  worldUniforms.uCursorOn.value = cursor.cursorOn;
  const pixelRatio = gl.getPixelRatio();
  worldUniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
  worldUniforms.uAspect.value = width / Math.max(1, height);
  gl.toneMappingExposure = s.exposure;
}
