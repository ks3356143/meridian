import { request } from "@/api/client";
import type { AuthUser, LoginPayload, LoginResponse } from "./types";

export const authApi = {
  login: (payload: LoginPayload) =>
    request<LoginResponse>("POST", "/api/v1/auth/login", { skipErrorToast: true }, payload),
  me: () => request<AuthUser>("GET", "/api/v1/auth/me"),
};
