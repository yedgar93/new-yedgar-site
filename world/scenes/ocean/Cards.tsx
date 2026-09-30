"use client";

import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import {
  BoxGeometry,
  Color,
  Group,
  MeshLambertMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  TextureLoader,
} from "three";
import type { Release } from "@/types";
import { artReleases } from "@/world/assets/catalog";
import { textureUrl } from "@/world/assets/artUrl";
import { bindFinish } from "@/world/pipeline/finish";
import { assignArtMap, prepareArtTexture, setEmissiveIntensity } from "@/world/runtime/mutations";
import type { QualitySettings } from "@/world/quality/tiers";
import { interaction } from "@/world/store/interaction";
import { worldUniforms } from "@/world/store/uniforms";

const RADIUS = 4.9;
const CARD_SCALE = 0.7;
const bodyGeometry = new BoxGeometry(1, 1, 0.012);

type FaceMaterial = MeshLambertMaterial | MeshStandardMaterial | MeshPhysicalMaterial;

function damp(current: number, target: number, smooth: number, dt: number) {
  const k = 1 - Math.exp(-dt / Math.max(0.0001, smooth));
  return current + (target - current) * k;
}

class CardBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function createCardMaterials(settings: QualitySettings, color: string) {
  const face = createFaceMaterial(settings, color);
  const side = new MeshStandardMaterial({ color: "#14141a", roughness: 0.78, metalness: 0.04 });
  bindFinish(side, settings.ldrOutput);
  return [side, side, side, side, face, face] as [
    MeshStandardMaterial,
    MeshStandardMaterial,
    MeshStandardMaterial,
    MeshStandardMaterial,
    FaceMaterial,
    FaceMaterial,
  ];
}

function createFaceMaterial(settings: QualitySettings, color: string): FaceMaterial {
  const emissive = new Color(color);
  if (settings.cards.material === "physical") {
    const material = new MeshPhysicalMaterial({
      roughness: 0.42,
      metalness: 0.04,
      clearcoat: 0.55,
      clearcoatRoughness: 0.18,
      emissive,
      emissiveIntensity: 0.08,
    });
    bindFinish(material, settings.ldrOutput);
    return material;
  }
  if (settings.cards.material === "standard") {
    const material = new MeshStandardMaterial({
      roughness: 0.48,
      metalness: 0.06,
      emissive,
      emissiveIntensity: 0.08,
    });
    bindFinish(material, settings.ldrOutput);
    return material;
  }
  const material = new MeshLambertMaterial({ emissive, emissiveIntensity: 0.16 });
  bindFinish(material, settings.ldrOutput);
  return material;
}

function ArtCard({
  release,
  index,
  settings,
}: {
  release: Release;
  index: number;
  settings: QualitySettings;
}) {
  const router = useRouter();
  const texture = useLoader(TextureLoader, textureUrl(release.artwork ?? ""));
  const materials = useMemo(
    () => createCardMaterials(settings, release.color ?? "#222222"),
    [settings, release.color],
  );
  const face = materials[4];
  const inner = useRef<Group>(null);
  const anim = useRef({ scale: 1, lift: 0 });

  useLayoutEffect(() => {
    prepareArtTexture(texture, settings.cards.anisotropy);
    assignArtMap(face, texture);
  }, [texture, face, settings.cards.anisotropy]);

  useLayoutEffect(() => {
    const node = inner.current;
    if (!node) return;
    node.traverse((object) => {
      object.layers.enable(0);
      if (settings.ocean.reflection) object.layers.enable(2);
    });
  }, [settings.ocean.reflection]);

  useEffect(() => {
    return () => {
      face.dispose();
      materials[0].dispose();
    };
  }, [face, materials]);

  useFrame((_, dt) => {
    const node = inner.current;
    if (!node) return;
    const hot = interaction.get().hovered === index;
    anim.current.scale = damp(anim.current.scale, hot ? 1.38 : 1, 0.22, dt);
    anim.current.lift = damp(anim.current.lift, hot ? 0.28 : 0, 0.22, dt);
    node.scale.setScalar(CARD_SCALE * anim.current.scale);
    node.position.y = anim.current.lift;
    const night = worldUniforms.uNight.value;
    setEmissiveIntensity(face, hot ? 0.35 : 0.06 + night * 0.55);
  });

  const angle = (index / artReleases.length) * Math.PI * 2;
  return (
    <group
      position={[Math.sin(angle) * RADIUS, 0, Math.cos(angle) * RADIUS]}
      rotation={[0, angle + Math.PI / 120, 0]}
    >
      <group ref={inner}>
        <mesh
          geometry={bodyGeometry}
          material={materials}
          onPointerOver={(event) => {
            event.stopPropagation();
            interaction.setHovered(index);
          }}
          onPointerOut={() => {
            if (interaction.get().hovered === index) interaction.setHovered(null);
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (interaction.get().suppressClick) return;
            router.push(`/music?track=${release.id}&autoplay=true`);
          }}
        />
      </group>
    </group>
  );
}

function FallbackCard({ index, color }: { index: number; color: string }) {
  const angle = (index / artReleases.length) * Math.PI * 2;
  return (
    <mesh
      geometry={bodyGeometry}
      position={[Math.sin(angle) * RADIUS, 0, Math.cos(angle) * RADIUS]}
      rotation={[0, angle + Math.PI / 120, 0]}
    >
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.05} />
    </mesh>
  );
}

export function ReleaseRing({ settings }: { settings: QualitySettings }) {
  const group = useRef<Group>(null);
  useFrame((_, dt) => {
    const state = interaction.get();
    state.ring = damp(state.ring, state.ringTarget, 0.14, dt);
    if (group.current) group.current.rotation.y = state.ring;
  });

  return (
    <group ref={group} position={[0, 1.75, 0]}>
      {artReleases.map((release, index) => (
        <CardBoundary
          key={release.id}
          fallback={<FallbackCard index={index} color={release.color ?? "#333"} />}
        >
          <Suspense fallback={<FallbackCard index={index} color={release.color ?? "#333"} />}>
            <ArtCard release={release} index={index} settings={settings} />
          </Suspense>
        </CardBoundary>
      ))}
    </group>
  );
}
