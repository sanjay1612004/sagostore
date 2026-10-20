import { create } from "zustand";
import * as SecureStore from "../services/device-storage";
import type { Permission } from "@tamiltrade/shared";
export type User = {
  id: string;
  businessId: string;
  name: string;
  email: string;
  role: "owner" | "staff";
  permissions: Permission[];
};
export type Credentials = {
  accessToken: string;
  refreshToken: string;
  user: User;
};
export const useSession = create<{
  user: User | null;
  accessToken: string | null;
  ready: boolean;
  setCredentials: (data: Credentials) => Promise<void>;
  clear: () => Promise<void>;
}>((set) => ({
  user: null,
  accessToken: null,
  ready: false,
  setCredentials: async (data) => {
    await SecureStore.setItemAsync(
      "tamiltrade.session",
      JSON.stringify({ refreshToken: data.refreshToken, user: data.user }),
    );
    set({ user: data.user, accessToken: data.accessToken, ready: true });
  },
  clear: async () => {
    await SecureStore.deleteItemAsync("tamiltrade.session");
    set({ user: null, accessToken: null, ready: true });
  },
}));
export const hasPermission = (p: Permission) => {
  const user = useSession.getState().user;
  return user?.role === "owner" || user?.permissions.includes(p);
};
