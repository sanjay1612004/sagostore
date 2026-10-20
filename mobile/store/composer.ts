import { create } from "zustand";
import type { TradeInput } from "@tamiltrade/shared";
export const useComposer = create<{
  input: Partial<TradeInput> | null;
  set: (input: Partial<TradeInput> | null) => void;
}>((set) => ({ input: null, set: (input) => set({ input }) }));

// Return a newly created option to the mounted transaction form without losing its values.
export const useTradeSelection = create<{
  selection: { field: "contactId" | "productId"; id: string } | null;
  set: (
    selection: { field: "contactId" | "productId"; id: string } | null,
  ) => void;
}>((set) => ({ selection: null, set: (selection) => set({ selection }) }));
