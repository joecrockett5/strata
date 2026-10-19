import type { SectionDefinition, SectionInstance } from "@strata/schema";
import { createContext, useContext } from "react";
import type { RenderContext } from "./context";

/** Per-section render state passed down the node tree. */
export interface SectionRenderState {
  context: RenderContext;
  definition: SectionDefinition;
  instance: SectionInstance;
}

export const SectionRenderStateContext = createContext<SectionRenderState | undefined>(undefined);

export function useSectionRenderState(): SectionRenderState {
  const state = useContext(SectionRenderStateContext);
  if (!state) {
    throw new Error("Nodes must be rendered inside <SectionView>.");
  }
  return state;
}
