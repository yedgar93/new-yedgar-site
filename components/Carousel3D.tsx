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
  useTexture,
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

// Shared ref so CursorSun can update the water's sunDirection for reflections
const waterMeshRef: { current: any } = { current: null };

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

  const geom = useMemo(() => new THREE.PlaneGeometry(2000, 2000, 32, 32), []);

  const config = useMemo(
    () => ({
      textureWidth: 128,
      textureHeight: 128,
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
    if (ref.current) {
      ref.current.material.uniforms.time.value += delta * 0.5;
    }
  });

  // Expose water mesh for cursor reflection
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

// Shared across all cards — created once
const sharedBoxGeometry = new THREE.BoxGeometry(1, 1, 0.01, 1, 1, 1);
const sharedSideMaterial = new THREE.MeshLambertMaterial({
  color: "#111111",
  emissive: 0x111111,
  toneMapped: false,
});

function CardMesh({
  url,
  onClick,
  active,
}: {
  url: string;
  onClick: (e: any) => void;
  active?: boolean;
}) {
  const texture = useLoader(THREE.TextureLoader, url, (loader: any) => {
    try {
      loader.crossOrigin = "anonymous";
    } catch (e) {}
  }) as THREE.Texture;
  try {
    texture.colorSpace = THREE.SRGBColorSpace;
  } catch (e) {}
  const faceMaterial = useMemo(() => {
    if (!texture)
      return new THREE.MeshLambertMaterial({
        color: "#333",
        toneMapped: false,
      });
    return new THREE.MeshLambertMaterial({ map: texture, toneMapped: false });
  }, [texture]);

  const duplicateMaterial = useMemo(() => {
    if (!texture)
      return new THREE.MeshBasicMaterial({
        color: "#333",
        toneMapped: false,
      });
    return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  }, [texture]);

  // Dynamically adjust emissive based on sun cycle
  // Cards should look natural in daylight and simply darken at night (not grey)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * ((Math.PI * 2) / 60);
    const sunY = Math.sin(t) * 400 + 345; // -55 … 745
    const sunOut = Math.max(0, Math.min(1, sunY / 100));
    const e = (active ? 0x1a : 0x10) / 255;
    faceMaterial.emissive.setRGB(e, e, e);
    faceMaterial.emissiveIntensity = 0.2 + sunOut * 0.005; // Reduced sunOut impact to half
    faceMaterial.transparent = true;
    faceMaterial.opacity = 0.5; // Set original cards to 50% opacity
  });

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

  const duplicateMaterials = useMemo(
    () => [
      sharedSideMaterial,
      sharedSideMaterial,
      sharedSideMaterial,
      sharedSideMaterial,
      duplicateMaterial,
      duplicateMaterial,
    ],
    [duplicateMaterial],
  );

  return (
    <>
      {/* Original card affected by lighting */}
      <mesh
        geometry={sharedBoxGeometry}
        material={materials}
        onClick={onClick}
      />
      {/* Duplicate card unaffected by lighting */}
      <mesh geometry={sharedBoxGeometry} material={duplicateMaterials} />
    </>
  );
}

function Card({
  url,
  active,
  hovered,
  onClick,
  pointerPos,
  angle,
  cardScale = 1,
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
  const { camera, viewport, gl } = useThree();

  useFrame((_s, delta) => {
    const f = hovered ? 1.4 : active ? 1.25 : 1;
    const s = cardScale * f;
    easing.damp3(ref.current.position, [0, hovered ? 0.25 : 0, 0], 0.1, delta);
    easing.damp3(ref.current.scale, [s, s, 1], 0.15, delta);
  });

  return (
    <group {...props}>
      <group ref={ref}>
        <CardMesh url={url} onClick={onClick} active={active || hovered} />
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
      {/* Outer outline layer (rendered behind) */}
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
      {/* Main text with inner outline */}
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
  radius = 4.75,
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
            rotation={[0, Math.PI / 2 + angle, 0]}
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

function Scene(props: any) {
  const router = useRouter();

  const ref = useRef<any>(null!);
  const scroll = useScroll();
  const [hovered, setHovered] = useState<number | null>(null);
  const pointerPosRef = useRef({ x: 0, y: 0 });
  const { viewport } = useThree();
  const active = hovered !== null ? (cardList[hovered] ?? null) : null;

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
        from={0}
        len={Math.PI * 2}
        onPointerOver={setHovered}
        onPointerOut={() => setHovered(null)}
        onCardClick={(i) => {
          const r = cardList[i];
          if (r?.id) {
            router.push(`/music?track=${r.id}&autoplay=true`);
          }
        }}
        pointerPos={pointerPosRef.current}
      />
      <LocalActiveCard hovered={hovered} release={active} />
    </group>
  );
}

function MobileScene({
  activeIndex,
  ...props
}: {
  activeIndex: number;
  position: [number, number, number];
}) {
  const router = useRouter();
  const ref = useRef<any>(null!);
  const pointerPosRef = useRef({ x: 0, y: 0 });
  const n = cardList.length;
  const cumulativeRotRef = useRef(0);
  const prevIndexRef = useRef(activeIndex);

  useFrame((state, delta) => {
    // Compute shortest-path rotation delta when index changes
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
    if (activeRelease?.id) {
      router.push(`/music?track=${activeRelease.id}&autoplay=true`);
    }
  }, [activeRelease, router]);

  return (
    <group ref={ref} {...props}>
      <Cards
        from={0}
        len={Math.PI * 2}
        onPointerOver={() => {}}
        onPointerOut={() => {}}
        onCardClick={(i) => {
          const r = cardList[i];
          if (r?.id) {
            router.push(`/music?track=${r.id}&autoplay=true`);
          }
        }}
        pointerPos={pointerPosRef.current}
        activeIndex={activeIndex}
        cardScale={0.75}
      />
      <LocalActiveCard
        hovered={activeIndex}
        release={activeRelease}
        isMobile
        onClick={handleActiveClick}
      />
    </group>
  );
}

const _cursorWorldPos = new THREE.Vector3();
const _sunDir = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointerNDC = new THREE.Vector2();
const _waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.75); // card level y=1.75

function CursorSun() {
  const lightRef = useRef<any>(null);
  const meshRef = useRef<any>(null);

  useFrame((state) => {
    // Raycast from camera through pointer onto a plane at card height (y=1.75)
    _pointerNDC.set(state.pointer.x, state.pointer.y);
    _raycaster.setFromCamera(_pointerNDC, state.camera);
    const hit = _raycaster.ray.intersectPlane(_waterPlane, _cursorWorldPos);

    if (hit) {
      // Clamp distance so it doesn't fly off to infinity at shallow angles
      const maxDist = 50;
      const dist = _cursorWorldPos.length();
      if (dist > maxDist) _cursorWorldPos.multiplyScalar(maxDist / dist);

      if (lightRef.current) {
        lightRef.current.position.copy(_cursorWorldPos);
        lightRef.current.position.y += 1; // lift light above cards so it illuminates from above
      }
      if (meshRef.current) {
        meshRef.current.position.copy(_cursorWorldPos);
      }

      // Update water sunDirection to point toward cursor for specular reflections
      if (waterMeshRef.current?.material?.uniforms?.sunDirection) {
        _sunDir.copy(_cursorWorldPos).normalize();
        waterMeshRef.current.material.uniforms.sunDirection.value.copy(_sunDir);
      }
    }
  });

  return (
    <>
      <pointLight
        ref={lightRef}
        color={0xffeedd}
        intensity={10}
        distance={100}
        decay={1.6}
      />
    </>
  );
}

function AnimatedSky() {
  const skyRef = useRef<any>(null);
  const lightRef = useRef<any>(null);

  useFrame(({ clock }) => {
    // t goes 0→2π over DAY_NIGHT_PERIOD seconds
    const t = clock.elapsedTime * ((Math.PI * 2) / DAY_NIGHT_PERIOD);
    // sunY: sin curve — positive = day, negative = night
    // Range: ~-45 to ~55 (centered around 5)
    const sunY = Math.sin(t) * 50 + 5;

    // sunNorm: 0 at night, 1 at noon
    const sunNorm = Math.max(0, Math.min(0.5, (sunY + 10) / 65)); // Adjusted for smoother transition

    const fadeDuration = 30; // Further increased fade duration for smoother transition

    const isNight = sunY < -10; // Determine if it's night
    const fadeFactor = isNight
      ? Math.min(1, Math.max(0, (Math.abs(sunY) - 10) / fadeDuration)) // Gradual fade to night
      : Math.max(0, Math.min(1, (sunY + 10) / fadeDuration)); // Gradual fade to day

    // Ensure cards are not overly affected by lighting
    const cardMeshes: THREE.Mesh[] = []; // Replace with actual references to your card meshes
    cardMeshes.forEach((cardMesh) => {
      if (cardMesh.material instanceof THREE.MeshStandardMaterial) {
        const cardBrightness = isNight ? 0.9 : 1; // Increased brightness at night
        cardMesh.material.emissiveIntensity = cardBrightness; // Adjust emissive intensity directly
      }
    });

    if (lightRef.current) {
      const baseIntensity = 0.3; // Increased base light intensity at night
      const peakIntensity = 0.8;
      const horizonBoost = Math.max(0, Math.sin(t) * 0.15);
      lightRef.current.intensity =
        baseIntensity +
        sunNorm * (peakIntensity - baseIntensity) +
        horizonBoost; // Smooth fade-out with light peaking at sunrise

      // Smoothly interpolate light color during transitions
      const dayColor = new THREE.Color(1, 0.78, 0.59); // Daylight color (RGB normalized)
      const nightColor = new THREE.Color(0.1, 0.1, 0.2); // Nighttime color (dark blueish)
      const interpolatedColor = dayColor.lerp(nightColor, 1 - sunNorm); // Interpolate based on sunNorm
      lightRef.current.color = interpolatedColor;
    }

    // Gradual darkening of the sky at night
    if (skyRef.current?.material?.uniforms?.rayleigh) {
      const maxRayleigh = 1.5; // Maximum darkness at night
      const minRayleigh = 0.5; // Minimum darkness during the day
      skyRef.current.material.uniforms.rayleigh.value =
        minRayleigh + (1 - sunNorm) * (maxRayleigh - minRayleigh); // Gradual darkening over a few seconds
    }

    // Gradual fade-out of pink in the sky during sunset
    if (skyRef.current?.material?.uniforms?.mieDirectionalG) {
      const sunsetPink = 0.5; // Intensity of pink during sunset
      const nightBlue = 0.2; // Intensity of blue at night
      skyRef.current.material.uniforms.mieDirectionalG.value =
        nightBlue + sunNorm * (sunsetPink - nightBlue); // Gradual fade from pink to blue
    }

    // Remove color from the sky at night
    if (skyRef.current?.material?.uniforms?.mieCoefficient) {
      skyRef.current.material.uniforms.mieCoefficient.value =
        0.02 + (1 - sunNorm) * 0.03; // Further increase mieCoefficient to remove color
    }

    // Adjust turbidity: low at noon (blue sky), higher at sunrise/sunset
    if (skyRef.current?.material?.uniforms?.turbidity) {
      // sunEdge: 1 near horizon, 0 at noon — drives warmer sunset look
      const sunEdge = 1 - Math.min(1, Math.max(0, sunY / 90));
      // Day: 1.0 (cool blue), Horizon: ~5 (warm haze), Night: ~12
      skyRef.current.material.uniforms.turbidity.value =
        1.0 + sunEdge * 4 + (1 - sunNorm) * 11; // Increase turbidity at night for a darker sky
    }

    if (skyRef.current?.material?.uniforms?.sunPosition) {
      // Update the sun's position dynamically
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

// Define the DAY_NIGHT_PERIOD constant
const DAY_NIGHT_PERIOD = 60; // Adjust this value as needed for the day-night cycle duration

export default function Carousel3D() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setIsMobile(window.matchMedia("(pointer: coarse)").matches);
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

      // Only trigger if horizontal swipe is dominant and exceeds threshold
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) {
          // Swipe left → next card
          setActiveIndex((prev) => (prev + 1) % n);
        } else {
          // Swipe right → previous card
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
            ? [1, 1.5]
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
            waterColor={0x252255}
            sunColor={0x252255}
            distortionScale={2.5}
          />
          <AnimatedSky />
          {!isMobile && <CursorSun />}
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
