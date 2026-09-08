import { request } from "@/api/client";
import type { HealthResponse } from "@/features/auth/types";

export const systemApi = {
  health: () => request<HealthResponse>("GET", "/api/v1/health", { skipErrorToast: true }),
};
