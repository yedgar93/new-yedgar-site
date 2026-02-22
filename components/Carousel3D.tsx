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

  // Dynamically adjust emissive based on sun cycle
  // Grey layer fades out whenever the sun is above the horizon, not just at noon
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * ((Math.PI * 2) / 60);
    const sunY = Math.sin(t) * 400 + 345; // -55 … 745
    // sunOut: 0 when sun is below horizon, ramps to 1 quickly as it rises
    // Using a low threshold (100) so it reaches full brightness early in the day
    const sunOut = Math.max(0, Math.min(1, sunY / 100));
    const e = (active ? 0x1a : 0x10) / 255;
    faceMaterial.emissive.setRGB(e, e, e);
    // Full grey (0.4) at night → near-zero (0.05) whenever sun is out
    faceMaterial.emissiveIntensity = 0.4 - sunOut * 0.35;
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

function ActiveCard({
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
        color="#000000a6"
        outlineWidth={0.025}
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
        outlineWidth={0.012}
        outlineColor="black"
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
  radius = 5.25,
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
      <ActiveCard hovered={hovered} release={active} />
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
      <ActiveCard
        hovered={activeIndex}
        release={activeRelease}
        isMobile
        onClick={handleActiveClick}
      />
    </group>
  );
}

function AnimatedSky() {
  const skyRef = useRef<any>(null);
  const lightRef = useRef<any>(null);

  useFrame(({ clock }) => {
    if (!skyRef.current?.material?.uniforms?.sunPosition) return;
    const t = clock.elapsedTime * ((Math.PI * 2) / 60);
    const sunY = Math.sin(t) * 400 + 345;
    skyRef.current.material.uniforms.sunPosition.value.set(
      Math.cos(t) * 2500,
      sunY,
      -1000,
    );
    if (lightRef.current) {
      lightRef.current.intensity = Math.max(0.15, sunY / 400);
    }
  });

  return (
    <>
      <ambientLight ref={lightRef} intensity={1.8} />
      <Sky
        ref={skyRef}
        sunPosition={[3500, 300, -1000]}
        turbidity={0.08}
        rayleigh={0.03451231401125}
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
