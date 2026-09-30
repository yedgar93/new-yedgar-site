"use client";

import { Effect } from "postprocessing";

const fragment = /* glsl */ `
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 color = max(inputColor.rgb, vec3(0.0));
  color = pow(color, vec3(0.96));
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, 1.06);
  color = (color - 0.5) * 1.05 + 0.5;
  outputColor = vec4(max(color, vec3(0.0)), inputColor.a);
}
`;

export class GradeEffect extends Effect {
  constructor() {
    super("GradeEffect", fragment);
  }
}
