import type { ThreeElement } from "@react-three/fiber";
import type { GradeEffect } from "@/world/pipeline/gradeEffect";

declare module "@react-three/fiber" {
  interface ThreeElements {
    gradeEffect: ThreeElement<typeof GradeEffect>;
  }
}
