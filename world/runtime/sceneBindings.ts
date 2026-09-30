import { FogExp2, type Scene } from "three";
import { sceneAtmosphere } from "@/world/store/atmosphere";
import { worldUniforms } from "@/world/store/uniforms";

export function attachFog(scene: Scene) {
  const fog = new FogExp2(worldUniforms.uFogColor.value.getHex(), sceneAtmosphere.exp2Density);
  scene.fog = fog;
  return () => {
    if (scene.fog === fog) scene.fog = null;
  };
}

export function syncFog(scene: Scene) {
  const fog = scene.fog;
  if (!(fog instanceof FogExp2)) return;
  fog.color.copy(worldUniforms.uFogColor.value);
  fog.density = sceneAtmosphere.exp2Density;
}
