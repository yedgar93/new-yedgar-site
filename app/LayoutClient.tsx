"use client";

import Nav from "@/components/Nav";
import CustomCursor from "@/components/CustomCursor";
import PerformanceGuard from "@/components/PerformanceGuard";
import { ReactNode } from "react";

export default function LayoutClient({ children }: { children: ReactNode }) {
  return (
    <>
      <PerformanceGuard />
      <div className="grain" />
      <CustomCursor />
      <Nav />
      {children}
    </>
  );
}
