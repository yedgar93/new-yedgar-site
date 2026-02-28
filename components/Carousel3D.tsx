"use client";

import * as THREE from "three";
import {
  useRef,
  useState,
  useMemo,
  useLayoutEffect,
  useEffect,
  useCallback,
  Suspense,
} from "react";
import {
  Canvas,
  extend,
  useThree,
  useLoader,
  useFrame,
} from "@react-three/fiber";
import {
  Image,
  ScrollControls,
  useScroll,
  Billboard,
  Text,
  Sky,
} from "@react-three/drei";
import { easing } from "maath";
import { Water } from "three-stdlib";
import { releases } from "@/data/releases";
import type { Release } from "@/types";
import { useRouter } from "next/navigation";

extend({ Water });

declare module "@react-three/fiber" {
  interface ThreeElements {
    water: any;
  }
}

const cardList = releases.filter((r) => r.artwork);

const waterMeshRef: { current: any } = { current: null };

// Module-level — never allocated per-frame
const _dayColor = new THREE.Color(1, 0.78, 0.59);
const _nightColor = new THREE.Color(0.1, 0.1, 0.2);
const _interpColor = new THREE.Color();

const DAY_NIGHT_PERIOD = 60;

// Wave states: calm → big → medium → repeat
// distortionScale drives how choppy the water looks
const WAVE_STATES = [
  { distortionScale: 0.4, duration: 20 }, // calm
  { distortionScale: 3.5, duration: 30 }, // large waves
  { distortionScale: 1.5, duration: 20 }, // medium waves
];
const WAVE_CYCLE_TOTAL = WAVE_STATES.reduce((a, s) => a + s.duration, 0);

function Ocean({
  waterColor = 0x001e0f,
  sunColor = 0xffffff,
  distortionScale = 2.5,
}: {
  waterColor?: number;
  sunColor?: number;
  distortionScale?: number;
}) {
  const ref = useRef<any>(null);
  const waterNormals = useLoader(THREE.TextureLoader, "/waternormals.jpeg");
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
  waterNormals.minFilter = THREE.LinearFilter;
  waterNormals.generateMipmaps = false;

  // 10x10 is sufficient — Water shader handles wave animation on the GPU
  const geom = useMemo(() => new THREE.PlaneGeometry(600, 900, 50, 50), []);

  const config = useMemo(
    () => ({
      textureWidth: 464,
      textureHeight: 464,
      waterNormals,
      sunDirection: new THREE.Vector3(),
      sunColor,
      waterColor,
      distortionScale,
      fog: true,
    }),
    [waterNormals, sunColor, waterColor, distortionScale],
  );

  useFrame((_state, delta) => {
    if (!ref.current?.material?.uniforms) return;
    const uniforms = ref.current.material.uniforms;

    // Advance water animation time
    uniforms.time.value += delta * 0.5;

    // Wave state cycling — lerp distortionScale toward current target
    const t = uniforms.time.value % WAVE_CYCLE_TOTAL;
    let accumulated = 0;
    let target = WAVE_STATES[0].distortionScale;
    for (const state of WAVE_STATES) {
      accumulated += state.duration;
      if (t < accumulated) {
        target = state.distortionScale;
        break;
      }
    }
    // Smooth transition between states
    uniforms.distortionScale.value = THREE.MathUtils.lerp(
      uniforms.distortionScale.value,
      target,
      delta * 0.3,
    );

    // Vertex wave displacement — drives actual geometry height
    const waveAmp = uniforms.distortionScale.value * 0.38;
    const pos = geom.attributes.position;
    const time = uniforms.time.value;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z =
        Math.sin(x * 0.04 + time * 1.1) *
          Math.cos(y * 0.03 + time * 0.7) *
          waveAmp +
        Math.sin(x * 0.09 + time * 0.6) *
          Math.cos(y * 0.07 + time * 1.3) *
          waveAmp *
          0.4;
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
  });

  useEffect(() => {
    waterMeshRef.current = ref.current;
    return () => {
      waterMeshRef.current = null;
    };
  });

  return <water ref={ref} args={[geom, config]} rotation-x={-Math.PI / 2} />;
}

function proxyUrl(url: string) {
  try {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      const isLocal =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.startsWith("192.168.") ||
        host.startsWith("10.") ||
        host.startsWith("172.");
      if (isLocal) {
        if (url.startsWith("https://f4.bcbits.com/")) {
          return `/api/proxy-image?url=${encodeURIComponent(url)}`;
        }
        return url;
      }
      if (url.startsWith("https://f4.bcbits.com/")) {
        try {
          return `/.netlify/functions/proxy-image?url=${encodeURIComponent(url)}`;
        } catch (e) {
          const compact = url.replace(/^https?:\/\//, "");
          return `https://images.weserv.nl/?url=${encodeURIComponent(compact)}`;
        }
      }
    }
  } catch (e) {}
  return url;
}

const sharedBoxGeometry = new THREE.BoxGeometry(1, 1, 0.01, 1, 1, 1);
const sharedSideMaterial = new THREE.MeshLambertMaterial({
  color: "#111111",
  emissive: 0x555555,
  toneMapped: false,
});

function CardMesh({
  url,
  onClick,
}: {
  url: string;
  onClick: (e: any) => void;
}) {
  const texture = useLoader(THREE.TextureLoader, url, (loader: any) => {
    try {
      loader.crossOrigin = "anonymous";
    } catch (e) {}
  }) as THREE.Texture;

  try {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
  } catch (e) {}

  const faceMaterial = useMemo(() => {
    if (!texture)
      return new THREE.MeshLambertMaterial({
        color: "#333",
        toneMapped: false,
      });
    return new THREE.MeshLambertMaterial({
      map: texture,
      toneMapped: false,
      emissive: new THREE.Color(0x020202),
      emissiveIntensity: 1,
    });
  }, [texture]);

  const materials = useMemo(
    () => [
      sharedSideMaterial,
      sharedSideMaterial,
      sharedSideMaterial,
      sharedSideMaterial,
      faceMaterial,
      faceMaterial,
    ],
    [faceMaterial],
  );

  return (
    <mesh geometry={sharedBoxGeometry} material={materials} onClick={onClick} />
  );
}

function Card({
  url,
  active,
  hovered,
  onClick,
  pointerPos,
  angle,
  cardScale = 0.7,
  ...props
}: {
  url: string;
  active: boolean;
  hovered: boolean;
  onClick: (e: any) => void;
  pointerPos: { x: number; y: number };
  angle: number;
  cardScale?: number;
  position: [number, number, number];
  rotation: [number, number, number];
  onPointerOver: (e: any) => void;
  onPointerOut: () => void;
}) {
  const ref = useRef<any>(null!);

  useFrame((_s, delta) => {
    const f = hovered ? 1.4 : active ? 1.25 : 1;
    const s = cardScale * f;
    easing.damp3(ref.current.position, [0, hovered ? 0.25 : 0, 0], 0.1, delta);
    easing.damp3(ref.current.scale, [s, s, 1], 0.15, delta);
  });

  return (
    <group {...props}>
      <group ref={ref}>
        <CardMesh url={url} onClick={onClick} />
      </group>
    </group>
  );
}

function LocalActiveCard({
  hovered,
  release,
  isMobile,
  onClick,
}: {
  hovered: number | null;
  release: Release | null;
  isMobile?: boolean;
  onClick?: () => void;
}) {
  const ref = useRef<any>(null!);
  useLayoutEffect(() => {
    if (ref.current?.material) ref.current.material.zoom = 0.8;
  }, [hovered]);
  useFrame((_s, delta) => {
    if (!ref.current?.material) return;
    easing.damp(ref.current.material, "zoom", 1, 0.5, delta);
    easing.damp(
      ref.current.material,
      "opacity",
      hovered !== null ? 1 : 0,
      0.3,
      delta,
    );
  });
  const label = release
    ? `${release.title}\n${release.type} · ${release.releaseDate}${release.label ? "\n" + release.label : ""}`
    : "";
  return (
    <Billboard>
      <Text
        font="/Roboto-Thin.ttf"
        fontSize={isMobile ? 0.28 : 0.3}
        position={isMobile ? [0, -0.3, -0.01] : [2.15, 2.65, -0.01]}
        anchorX={isMobile ? "center" : "left"}
        anchorY={isMobile ? "top" : undefined}
        textAlign={isMobile ? "center" : undefined}
        color="white"
        outlineWidth={0.035}
        outlineColor="black"
        outlineOpacity={0.1}
        lineHeight={1.4}
        letterSpacing={0.15}
      >
        {hovered !== null ? label.toUpperCase() : ""}
      </Text>
      <Text
        font="/Roboto-Thin.ttf"
        fontSize={isMobile ? 0.28 : 0.3}
        position={isMobile ? [0, -0.3, 0] : [2.15, 2.65, 0]}
        anchorX={isMobile ? "center" : "left"}
        anchorY={isMobile ? "top" : undefined}
        textAlign={isMobile ? "center" : undefined}
        color="white"
        outlineWidth={0.015}
        outlineColor="white"
        outlineOpacity={0.12}
        lineHeight={1.4}
        letterSpacing={0.15}
        onClick={onClick}
      >
        {hovered !== null ? label.toUpperCase() : ""}
      </Text>
      {hovered !== null && release?.artwork && (
        <Image
          ref={ref}
          transparent
          position={isMobile ? [0, 1.6, 0] : [0, 1.5, 0]}
          scale={(isMobile ? [3.5, 3.5, 1] : [3.5, 3.5, 1]) as any}
          url={proxyUrl(release.artwork)}
          onClick={onClick}
        />
      )}
    </Billboard>
  );
}

function Cards({
  from = 0,
  len = Math.PI * 2,
  radius = 4.9,
  onPointerOver,
  onPointerOut,
  onCardClick,
  pointerPos,
  activeIndex,
  cardScale,
  ...props
}: {
  from?: number;
  len?: number;
  radius?: number;
  onPointerOver: (i: number) => void;
  onPointerOut: () => void;
  onCardClick: (i: number) => void;
  pointerPos: { x: number; y: number };
  activeIndex?: number;
  cardScale?: number;
}) {
  const [hov, setHov] = useState<number | null>(null);
  const n = cardList.length;
  return (
    <group {...props}>
      {cardList.map((rel, i) => {
        const angle = from + (i / n) * len;
        return (
          <Card
            key={rel.id}
            onPointerOver={(e: any) => {
              e.stopPropagation();
              setHov(i);
              onPointerOver(i);
            }}
            onPointerOut={() => {
              setHov(null);
              onPointerOut();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onCardClick(i);
            }}
            position={[Math.sin(angle) * radius, 0, Math.cos(angle) * radius]}
            rotation={[0, Math.PI / 120 + angle, 0]}
            active={activeIndex !== undefined ? activeIndex === i : hov === i}
            hovered={hov === i}
            url={proxyUrl(rel.artwork!)}
            pointerPos={pointerPos}
            angle={angle}
            cardScale={cardScale}
          />
        );
      })}
    </group>
  );
}

const Scene = (props: any) => {
  const router = useRouter();
  const ref = useRef<any>(null!);
  const scroll = useScroll();
  const [hovered, setHovered] = useState<number | null>(null);
  const pointerPosRef = useRef({ x: 0, y: 0 });
  const { viewport } = useThree();
  const active = hovered !== null ? (cardList[hovered] ?? null) : null;

  const handlePointerOver = useCallback((i: number) => setHovered(i), []);
  const handlePointerOut = useCallback(() => setHovered(null), []);

  useFrame((state, delta) => {
    ref.current.rotation.y = -scroll.offset * (Math.PI * 2);
    state.events.update?.();
    easing.damp3(
      state.camera.position,
      [-state.pointer.x * 2, state.pointer.y * 2 + 4.5, 9],
      0.3,
      delta,
    );
    state.camera.lookAt(0, 0, 0);
    pointerPosRef.current.x = state.pointer.x * viewport.width;
    pointerPosRef.current.y = state.pointer.y * viewport.height;
  });

  return (
    <group ref={ref} {...props}>
      <Cards
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        from={0}
        len={Math.PI * 2}
        onCardClick={(i) => {
          const r = cardList[i];
          if (r?.id) router.push(`/music?track=${r.id}&autoplay=true`);
        }}
        pointerPos={pointerPosRef.current}
      />
      <LocalActiveCard hovered={hovered} release={active} />
    </group>
  );
};

const MobileScene = ({
  activeIndex,
  ...props
}: {
  activeIndex: number;
  position: [number, number, number];
}) => {
  const router = useRouter();
  const ref = useRef<any>(null!);
  const pointerPosRef = useRef({ x: 0, y: 0 });
  const n = cardList.length;
  const cumulativeRotRef = useRef(0);
  const prevIndexRef = useRef(activeIndex);

  const handlePointerOver = useCallback((_i: number) => {}, []);
  const handlePointerOut = useCallback(() => {}, []);

  useFrame((state, delta) => {
    if (prevIndexRef.current !== activeIndex) {
      const step = (Math.PI * 2) / n;
      let diff = activeIndex - prevIndexRef.current;
      if (diff > n / 2) diff -= n;
      if (diff < -n / 2) diff += n;
      cumulativeRotRef.current -= diff * step;
      prevIndexRef.current = activeIndex;
    }
    easing.damp(
      ref.current.rotation,
      "y",
      cumulativeRotRef.current,
      0.4,
      delta,
    );
    easing.damp3(state.camera.position, [0, 4.5, 9], 0.3, delta);
    state.camera.lookAt(0, 0, 0);
  });

  const activeRelease = cardList[activeIndex] ?? null;

  const handleActiveClick = useCallback(() => {
    if (activeRelease?.id)
      router.push(`/music?track=${activeRelease.id}&autoplay=true`);
  }, [activeRelease, router]);

  return (
    <group ref={ref} {...props}>
      <Cards
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        from={0}
        len={Math.PI * 2}
        onCardClick={(i) => {
          const r = cardList[i];
          if (r?.id) router.push(`/music?track=${r.id}&autoplay=true`);
        }}
        pointerPos={pointerPosRef.current}
        activeIndex={activeIndex}
        cardScale={0.77}
      />
      <LocalActiveCard
        hovered={activeIndex}
        release={activeRelease}
        isMobile
        onClick={handleActiveClick}
      />
    </group>
  );
};

const _cursorWorldPos = new THREE.Vector3();
const _sunDir = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointerNDC = new THREE.Vector2();
const _waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.75);

function CursorSun({
  isMobile,
  activeIndex,
}: {
  isMobile: boolean;
  activeIndex: number;
}) {
  const lightRef = useRef<any>(null);

  useFrame((state) => {
    if (isMobile) {
      // On mobile, park the light in front of the active card
      if (lightRef.current) {
        const angle = (activeIndex / cardList.length) * Math.PI * 2;
        lightRef.current.position.set(
          Math.sin(angle) * 4.9,
          1,
          Math.cos(angle) * 4.9 + 1,
        );
      }
    } else {
      // On desktop, follow the cursor
      _pointerNDC.set(state.pointer.x, state.pointer.y);
      _raycaster.setFromCamera(_pointerNDC, state.camera);
      const hit = _raycaster.ray.intersectPlane(_waterPlane, _cursorWorldPos);

      if (hit) {
        const maxDist = 50;
        const dist = _cursorWorldPos.length();
        if (dist > maxDist) _cursorWorldPos.multiplyScalar(maxDist / dist);

        if (lightRef.current) {
          lightRef.current.position.copy(_cursorWorldPos);
          lightRef.current.position.y += 1;
        }

        if (waterMeshRef.current?.material?.uniforms?.sunDirection) {
          _sunDir.copy(_cursorWorldPos).normalize();
          waterMeshRef.current.material.uniforms.sunDirection.value.copy(
            _sunDir,
          );
        }
      }
    }
  });

  return (
    <pointLight
      ref={lightRef}
      color={0xffeedd}
      intensity={10}
      distance={100}
      decay={1.6}
    />
  );
}

let _lastSunY = 9999;

function AnimatedSky() {
  const skyRef = useRef<any>(null);
  const lightRef = useRef<any>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * ((Math.PI * 2) / DAY_NIGHT_PERIOD);
    const sunY = Math.sin(t) * 50 + 5;
    const sunNorm = Math.max(0, Math.min(0.5, (sunY + 10) / 65));

    if (lightRef.current) {
      const baseIntensity = 0.69;
      const peakIntensity = 1.93;
      const horizonBoost = Math.max(0, Math.sin(t) * 0.15);
      lightRef.current.intensity =
        baseIntensity +
        sunNorm * (peakIntensity - baseIntensity) +
        horizonBoost;
      _interpColor.copy(_dayColor).lerp(_nightColor, 1 - sunNorm);
      lightRef.current.color.copy(_interpColor);
    }

    if (Math.abs(sunY - _lastSunY) < 0.05) return;
    _lastSunY = sunY;

    if (skyRef.current?.material?.uniforms?.rayleigh) {
      skyRef.current.material.uniforms.rayleigh.value =
        0.5 + (1 - sunNorm) * 1.0;
    }
    if (skyRef.current?.material?.uniforms?.mieDirectionalG) {
      skyRef.current.material.uniforms.mieDirectionalG.value =
        0.2 + sunNorm * 0.3;
    }
    if (skyRef.current?.material?.uniforms?.mieCoefficient) {
      skyRef.current.material.uniforms.mieCoefficient.value =
        0.02 + (1 - sunNorm) * 0.03;
    }
    if (skyRef.current?.material?.uniforms?.turbidity) {
      const sunEdge = 1 - Math.min(1, Math.max(0, sunY / 90));
      skyRef.current.material.uniforms.turbidity.value =
        1.0 + sunEdge * 4 + (1 - sunNorm) * 11;
    }
    if (skyRef.current?.material?.uniforms?.sunPosition) {
      const sunX = Math.cos(t) * 500;
      const sunZ = Math.sin(t) * 500;
      skyRef.current.material.uniforms.sunPosition.value.set(sunX, sunY, sunZ);
    }
  });

  return (
    <>
      <ambientLight ref={lightRef} intensity={1.8} />
      <Sky
        ref={skyRef}
        sunPosition={[2500, 300, -1000]}
        turbidity={0.08}
        rayleigh={0.00003451231401125}
        mieCoefficient={0}
        mieDirectionalG={0.31495}
      />
    </>
  );
}

export default function Carousel3D() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => setIsVisible(e.isIntersecting)),
      { threshold: 0.05 },
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const n = cardList.length;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
      const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
      touchStartRef.current = null;
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) {
          setActiveIndex((prev) => (prev + 1) % n);
        } else {
          setActiveIndex((prev) => (prev - 1 + n) % n);
        }
      }
    },
    [n],
  );

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        touchAction: isMobile ? "none" : "auto",
      }}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
    >
      <Canvas
        dpr={
          typeof window !== "undefined" && window.devicePixelRatio > 1.5
            ? [1, 1.25]
            : [1, 1]
        }
        frameloop={isVisible ? "always" : "demand"}
        gl={{
          toneMapping: THREE.NoToneMapping,
          powerPreference: "low-power",
          antialias: true,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <Suspense fallback={null}>
          <Ocean
            waterColor={0x292154}
            sunColor={0x3a2b69}
            distortionScale={2.25}
          />
          <AnimatedSky />
          <CursorSun isMobile={isMobile} activeIndex={activeIndex} />
          {isMobile ? (
            <MobileScene activeIndex={activeIndex} position={[0, 1.75, 0]} />
          ) : (
            <ScrollControls pages={5} infinite>
              <Scene position={[0, 1.75, 0]} />
            </ScrollControls>
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
