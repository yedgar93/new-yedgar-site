"use client";

import Nav from "@/components/Nav";
import CustomCursor from "@/components/CustomCursor";
import { ReactNode } from "react";
import { SunProvider } from "@/components/SunContext";

export default function LayoutClient({ children }: { children: ReactNode }) {
  return (
    <SunProvider>
      <div className="grain" />
      <CustomCursor />
      <Nav />
      {children}
    </SunProvider>
  );
}
