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
    height: number;
    /** Multiplier on blade width. Software uses wide clumps, not hairlines. */
    width: number;
    /** Three crossed blades per instance, so a few instances read as tufts. */
    tuft: boolean;
    alphaToCoverage: boolean;
    cloudShadows: boolean;
  };
  skyOctaves: 2 | 4 | 5;
  /** Render the sky into a cubemap and sample it, instead of shading clouds per pixel. */
  skyBake: boolean;
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
      grass: {
        blades: 0,
        radius: 1,
        segments: 1,
        height: 1,
        width: 1,
        tuft: false,
        alphaToCoverage: false,
        cloudShadows: false,
      },
      skyOctaves: 2,
      skyBake: false,
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
      dprMin: potato ? 0.6 : 0.75,
      dprMax: potato ? 1 : 1.15,
      dpr: potato ? 0.8 : 1,
      nativeAntialias: !potato,
      composer: null,
      envSize: potato ? 64 : 64,
      envInterval: potato ? 30 : 30,
      ocean: {
        waves: 3,
        segments: potato ? 36 : 48,
        foam: false,
        reflection: false,
        cloudReflect: false,
      },
      cards: { material: "lambert", anisotropy: potato ? 4 : 4 },
      grass: {
        blades: potato ? 2400 : 22000,
        radius: potato ? 42 : 56,
        segments: 1,
        height: potato ? 1.35 : 1.5,
        width: potato ? 2.4 : 1.15,
        tuft: true,
        alphaToCoverage: !potato,
        cloudShadows: false,
      },
      skyOctaves: 2,
      skyBake: potato,
      maxFps: potato ? 0 : 60,
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
        blades: 48000,
        radius: 56,
        segments: 2,
        height: 1.55,
        width: 1,
        tuft: false,
        alphaToCoverage: false,
        cloudShadows: true,
      },
      skyOctaves: 4,
      skyBake: false,
      maxFps: 0,
      ldrOutput: false,
    };
  }

  return {
    tier: "high",
    software,
    reducedMotion,
    dprMin: 1,
    dprMax: 1.5,
    dpr: 1,
    nativeAntialias: false,
    composer: {
      multisampling: 4,
      smaa: true,
      halfFloat: true,
      bloomLevels: 6,
      bloomScale: 0.6,
      ao: true,
      dof: false,
    },
    envSize: 256,
    envInterval: 3,
    ocean: { waves: 8, segments: 128, foam: true, reflection: true, cloudReflect: true },
    cards: { material: "physical", anisotropy: 8 },
    grass: {
      blades: 85000,
      radius: 64,
      segments: 2,
      height: 1.65,
      width: 1,
      tuft: false,
      alphaToCoverage: true,
      cloudShadows: true,
    },
    skyOctaves: 5,
    skyBake: false,
    maxFps: 0,
    ldrOutput: false,
  };
}
