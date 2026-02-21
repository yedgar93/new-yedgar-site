"use client";

import * as THREE from "three";
import {
  useRef,
  useState,
  useMemo,
  useLayoutEffect,
  useEffect,
  Suspense,
} from "react";
import { usePerformance } from "./usePerformance";
import { Canvas, extend, useThree, useLoader, useFrame } from "@react-three/fiber";
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

function Ocean({
  waterColor = 0x001e0f,
  sunColor = 0xffffff,
  distortionScale = 2.5,
  isLow = false,
}: any) {
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
    if (!ref.current) return;
    const factor = isLow ? 0.15 : 0.5;
    ref.current.material.uniforms.time.value += delta * factor;
  });

  return <water ref={ref} args={[geom, config]} rotation-x={-Math.PI / 2} />;
}

function proxyUrl(url: string) {
  if (url.startsWith("https://f4.bcbits.com/")) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

const sharedBoxGeometry = new THREE.BoxGeometry(1, 1, 0.01, 1, 1, 1);
const sharedSideMaterial = new THREE.MeshBasicMaterial({
  color: "#111111",
  toneMapped: false,
});

function CardMesh({ url, onClick }: { url: string; onClick: (e: any) => void }) {
  const texture = useTexture(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  const faceMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
    [texture],
  );
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
  return <mesh geometry={sharedBoxGeometry} material={materials} onClick={onClick} />;
}

function Card({
  url,
  active,
  hovered,
  onClick,
  pointerPos,
  angle,
  ...props
}: {
  url: string;
  active: boolean;
  hovered: boolean;
  onClick: (e: any) => void;
  pointerPos: { x: number; y: number };
  angle: number;
  position: [number, number, number];
  rotation: [number, number, number];
  onPointerOver: (e: any) => void;
  onPointerOut: () => void;
}) {
  const ref = useRef<any>(null!);
  const { camera, viewport, gl } = useThree();

  useFrame((_s, delta) => {
    const f = hovered ? 1.4 : active ? 1.25 : 1;
    easing.damp3(ref.current.position, [0, hovered ? 0.25 : 0, 0], 0.1, delta);
    easing.damp3(ref.current.scale, [1 * f, 1 * f, 1], 0.15, delta);
  });

  return (
    <group {...props}>
      <group ref={ref}>
        <CardMesh url={url} onClick={onClick} />
      </group>
    </group>
  );
}

function ActiveCard({ hovered, release }: { hovered: number | null; release: Release | null }) {
  const ref = useRef<any>(null!);
  useLayoutEffect(() => {
    if (ref.current?.material) ref.current.material.zoom = 0.8;
  }, [hovered]);
  useFrame((_s, delta) => {
    if (!ref.current?.material) return;
    easing.damp(ref.current.material, "zoom", 1, 0.5, delta);
    easing.damp(ref.current.material, "opacity", hovered !== null ? 1 : 0, 0.3, delta);
  });
  const label = release
    ? `${release.title}\n${release.type} · ${release.releaseDate}${release.label ? "\n" + release.label : ""}`
    : "";
  return (
    <Billboard>
      <Text
        font="/Roboto-Thin.ttf"
        fontSize={0.3}
        position={[2.15, 2.65, 0]}
        anchorX="left"
        color="white"
        lineHeight={1.4}
        letterSpacing={0.15}
      >
        {hovered !== null ? label.toUpperCase() : ""}
      </Text>
      {hovered !== null && release?.artwork && (
        <Image ref={ref} transparent position={[0, 1.5, 0]} scale={[3.5, 3.5, 1] as any} url={proxyUrl(release.artwork)} />
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
  ...props
}: {
  from?: number;
  len?: number;
  radius?: number;
  onPointerOver: (i: number) => void;
  onPointerOut: () => void;
  onCardClick: (i: number) => void;
  pointerPos: { x: number; y: number };
}) {
  const [hov, setHov] = useState<number | null>(null);
  const list = releases.filter((r) => r.artwork);
  const n = list.length;
  return (
    <group {...props}>
      {list.map((rel, i) => {
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
            active={hov === i}
            hovered={hov === i}
            url={proxyUrl(rel.artwork!)}
            pointerPos={pointerPos}
            angle={angle}
          />
        );
      })}
    </group>
  );
}

function Scene({ perf, ...props }: any) {
  const router = useRouter();

  const ref = useRef<any>(null!);
  const scroll = useScroll();
  const [hovered, setHovered] = useState<number | null>(null);
  const pointerPosRef = useRef({ x: 0, y: 0 });
  const { viewport } = useThree();
  const list = useMemo(() => releases.filter((r) => r.artwork), []);
  const active = hovered !== null ? (list[hovered] ?? null) : null;

  useFrame((state, delta) => {
    const sdelta = perf?.isLow ? delta * 0.5 : delta;
    ref.current.rotation.y = -scroll.offset * (Math.PI * 2);
    state.events.update?.();
    easing.damp3(state.camera.position, [-state.pointer.x * 2, state.pointer.y * 2 + 4.5, 9], 0.3, sdelta);
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
          const r = list[i];
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

export default function Carousel3D() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const perf = usePerformance();

  // If device is in low-performance mode, render a lightweight placeholder
  // to avoid mounting the heavy Three.js Canvas and reduce CPU usage.
  if (perf.isLow) {
    return (
      <div
        ref={containerRef}
        className="canvas-placeholder carousel-placeholder"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
    );
  }

  const getDPR = () => {
    try {
      const deviceMemory = (navigator as any).deviceMemory || 4;
      const hc = (navigator as any).hardwareConcurrency || 4;
      const DPR = window.devicePixelRatio || 1;
      if (deviceMemory <= 1 || hc <= 2) return [1, 1] as any;
      if (DPR > 2) return [1, 1.5] as any;
      return [1, DPR] as any;
    } catch (e) {
      return [1, 1.5] as any;
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => setIsVisible(e.isIntersecting)),
      { threshold: 0.05 },
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <Canvas
        frameloop={perf.isLow ? "demand" : isVisible ? "always" : "demand"}
        dpr={perf.isLow ? [1, 1] : getDPR()}
        gl={{ toneMapping: THREE.NoToneMapping, powerPreference: "low-power", antialias: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <Suspense fallback={null}>
          <Ocean waterColor={0x252255} sunColor={0x252255} distortionScale={2.5} isLow={perf.isLow} />
          <Sky sunPosition={[2500, 200, -1000]} turbidity={0.8} rayleigh={0.0125} mieCoefficient={0.0001} mieDirectionalG={0} />
          <ScrollControls pages={5} infinite>
            <Scene perf={perf} position={[0, 1.75, 0]} />
          </ScrollControls>
        </Suspense>
      </Canvas>
    </div>
  );
}
