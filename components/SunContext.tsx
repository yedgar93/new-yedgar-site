"use client";

import React, { createContext, useState } from "react";

export type SunContextValue = {
  sunNorm: number;
  setSunNorm: (n: number) => void;
};

export const SunContext = createContext<SunContextValue>({
  sunNorm: 1,
  setSunNorm: () => {},
});

export function SunProvider({ children }: { children: React.ReactNode }) {
  const [sunNorm, setSunNorm] = useState(1);
  return (
    <SunContext.Provider value={{ sunNorm, setSunNorm }}>
      {children}
    </SunContext.Provider>
  );
}

export default SunContext;
