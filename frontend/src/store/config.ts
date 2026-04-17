import { create } from "zustand";

interface ConfigState {
  sourcePrimaryLabel: string;
  sourceSecondaryLabel: string;
  secondarySourceEnabled: boolean;
  setConfig: (cfg: { sourcePrimaryLabel: string; sourceSecondaryLabel: string; secondarySourceEnabled: boolean }) => void;
}

export const useConfigStore = create<ConfigState>()((set) => ({
  sourcePrimaryLabel: "Primary",
  sourceSecondaryLabel: "Secondary",
  secondarySourceEnabled: false,
  setConfig: (cfg) => set(cfg),
}));
