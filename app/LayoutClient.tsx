"use client";

import Nav from "@/components/Nav";
import CustomCursor from "@/components/CustomCursor";
import { ReactNode } from "react";

export default function LayoutClient({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="grain" />
      <CustomCursor />
      <Nav />
      {children}
    </>
  );
}
