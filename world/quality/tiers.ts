export type QualityTier = "static" | "low" | "medium" | "high";

export interface QualitySettings {
  tier: QualityTier;
  software: boolean;
  reducedMotion: boolean;
  dprMin: number;
  dprMax: number;
  dpr: number;
  nativeAntialias: boolean;
  composer: null | {
    multisampling: 0 | 2 | 4;
    smaa: boolean;
    halfFloat: boolean;
    bloomLevels: number;
    bloomScale: number;
    ao: boolean;
    dof: boolean;
  };
  envSize: 32 | 64 | 128 | 256;
  envInterval: number;
  ocean: {
    waves: 3 | 5 | 8;
    segments: number;
    foam: boolean;
    reflection: boolean;
    cloudReflect: boolean;
  };
  cards: { material: "lambert" | "standard" | "physical"; anisotropy: number };
  grass: {
    blades: number;
    radius: number;
    segments: 1 | 2;
    alphaToCoverage: boolean;
    cloudShadows: boolean;
  };
  skyOctaves: 2 | 4 | 5;
  maxFps: number;
  /** Custom shaders apply AgX + sRGB + grade. Composer tiers leave this to the pipeline. */
  ldrOutput: boolean;
}

export function settingsFor(
  tier: QualityTier,
  software: boolean,
  reducedMotion: boolean,
): QualitySettings {
  if (tier === "static") {
    return {
      tier,
      software,
      reducedMotion,
      dprMin: 1,
      dprMax: 1,
      dpr: 1,
      nativeAntialias: false,
      composer: null,
      envSize: 32,
      envInterval: 60,
      ocean: { waves: 3, segments: 8, foam: false, reflection: false, cloudReflect: false },
      cards: { material: "lambert", anisotropy: 1 },
      grass: { blades: 0, radius: 1, segments: 1, alphaToCoverage: false, cloudShadows: false },
      skyOctaves: 2,
      maxFps: 30,
      ldrOutput: true,
    };
  }

  if (tier === "low") {
    const potato = software;
    return {
      tier,
      software,
      reducedMotion,
      dprMin: potato ? 0.5 : 0.75,
      dprMax: potato ? 0.72 : 1,
      dpr: potato ? 0.66 : 1,
      nativeAntialias: !potato,
      composer: null,
      envSize: potato ? 32 : 64,
      envInterval: potato ? 45 : 30,
      ocean: {
        waves: 3,
        segments: potato ? 40 : 48,
        foam: false,
        reflection: false,
        cloudReflect: false,
      },
      cards: { material: "lambert", anisotropy: potato ? 2 : 4 },
      grass: {
        blades: potato ? 9000 : 15000,
        radius: potato ? 28 : 35,
        segments: 1,
        alphaToCoverage: !potato,
        cloudShadows: false,
      },
      skyOctaves: 2,
      maxFps: potato ? 30 : 60,
      ldrOutput: true,
    };
  }

  if (tier === "medium") {
    return {
      tier,
      software,
      reducedMotion,
      dprMin: 0.85,
      dprMax: 1.5,
      dpr: 1,
      nativeAntialias: false,
      composer: {
        multisampling: 0,
        smaa: true,
        halfFloat: true,
        bloomLevels: 5,
        bloomScale: 0.5,
        ao: false,
        dof: false,
      },
      envSize: 128,
      envInterval: 8,
      ocean: { waves: 5, segments: 80, foam: true, reflection: false, cloudReflect: true },
      cards: { material: "standard", anisotropy: 8 },
      grass: {
        blades: 36000,
        radius: 48,
        segments: 2,
        alphaToCoverage: false,
        cloudShadows: true,
      },
      skyOctaves: 4,
      maxFps: 0,
      ldrOutput: false,
    };
  }

  return {
    tier: "high",
    software,
    reducedMotion,
    dprMin: 1,
    dprMax: 1.75,
    dpr: 1.25,
    nativeAntialias: false,
    composer: {
      multisampling: 4,
      smaa: true,
      halfFloat: true,
      bloomLevels: 6,
      bloomScale: 0.6,
      ao: true,
      dof: true,
    },
    envSize: 256,
    envInterval: 3,
    ocean: { waves: 8, segments: 128, foam: true, reflection: true, cloudReflect: true },
    cards: { material: "physical", anisotropy: 8 },
    grass: {
      blades: 70000,
      radius: 64,
      segments: 2,
      alphaToCoverage: true,
      cloudShadows: true,
    },
    skyOctaves: 5,
    maxFps: 0,
    ldrOutput: false,
  };
}
