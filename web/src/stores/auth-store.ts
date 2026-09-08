import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@/features/auth/types";

interface AuthState {
  token: string | null;
  expiresAt: string | null;
  user: AuthUser | null;
  setAuth: (token: string, expiresAt: string, user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      expiresAt: null,
      user: null,
      setAuth: (token, expiresAt, user) => set({ token, expiresAt, user }),
      setUser: (user) => set({ user }),
      clear: () => set({ token: null, expiresAt: null, user: null }),
    }),
    { name: "chenmeridian-auth" },
  ),
);
