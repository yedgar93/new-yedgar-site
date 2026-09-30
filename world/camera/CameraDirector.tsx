"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import gsap from "gsap";
import { RIGS } from "@/world/routes";
import { readParams } from "@/world/debug/params";
import { quality } from "@/world/quality/qualityStore";
import { fitPerspective } from "@/world/runtime/mutations";
import { interaction } from "@/world/store/interaction";
import { transition, transitionMotion, type SceneId } from "@/world/store/transition";

function horizontalToVertical(fovX: number, aspect: number) {
  const radians = (fovX * Math.PI) / 180;
  return (2 * Math.atan(Math.tan(radians / 2) / Math.max(0.2, aspect)) * 180) / Math.PI;
}

export function CameraDirector() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const look = useRef(new Vector3());
  const timeline = useRef<gsap.core.Timeline | gsap.core.Tween | null>(null);

  useLayoutEffect(() => {
    const play = (next: SceneId) => {
      const current = transition.get().scene;
      if (current === next) return;
      timeline.current?.kill();
      const reduced = quality.getSettings().reducedMotion || readParams().freeze;
      const worldToWorld = current !== "plain" && next !== "plain" && !reduced;
      if (worldToWorld) {
        timeline.current = gsap
          .timeline()
          .to(transitionMotion, { pitch: 1, duration: 0.55, ease: "power2.in" })
          .call(() => transition.setScene(next))
          .to(transitionMotion, { pitch: 0, duration: 0.62, ease: "power2.out" });
        return;
      }
      if (current === "plain" && next !== "plain" && !reduced) {
        transition.setScene(next);
        transitionMotion.pitch = 1;
        transitionMotion.dip = 0;
        timeline.current = gsap.to(transitionMotion, {
          pitch: 0,
          duration: 1.05,
          ease: "power2.out",
        });
        return;
      }
      if (current !== "plain" && next !== "plain") {
        timeline.current = gsap
          .timeline()
          .to(transitionMotion, { dip: 1, duration: 0.28, ease: "power1.inOut" })
          .call(() => transition.setScene(next))
          .to(transitionMotion, { dip: 0, duration: 0.28, ease: "power1.inOut" });
        return;
      }
      transition.setScene(next);
      transitionMotion.pitch = 0;
      transitionMotion.dip = 0;
    };

    play(transition.getDesired());
    const unsubscribe = transition.subscribeDesired(play);
    return () => {
      unsubscribe();
      timeline.current?.kill();
    };
  }, []);

  useFrame(() => {
    const rig = RIGS[transition.get().scene];
    const persp = camera as PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const nextFov = horizontalToVertical(rig.fovX, aspect);
    if (Math.abs(persp.fov - nextFov) > 0.05 || Math.abs(persp.aspect - aspect) > 0.001) {
      fitPerspective(persp, nextFov, aspect);
    }
    const pointer = interaction.get();
    const pitch = transitionMotion.pitch;
    const px = pointer.pointerX * rig.parallax[0];
    const py = pointer.pointerY * rig.parallax[1];
    const y = rig.position[1] + rig.skyLift * pitch + py;
    const lookY = rig.target[1] + rig.skyLook * pitch;
    camera.position.set(rig.position[0] + px, y, rig.position[2]);
    look.current.set(rig.target[0], lookY, rig.target[2]);
    camera.lookAt(look.current);
  }, 0);

  return null;
}
