"use client";

import Nav from "@/components/Nav";
import CustomCursor from "@/components/CustomCursor";
import { ReactNode } from "react";
import { WorldRoot } from "@/world/WorldRoot";

export default function LayoutClient({ children }: { children: ReactNode }) {
  return (
    <>
      <CustomCursor />
      <Nav />
      <WorldRoot>{children}</WorldRoot>
    </>
  );
}
