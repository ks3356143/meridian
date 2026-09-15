import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";

export function useLogout() {
  const clear = useAuthStore((state) => state.clear);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useCallback(() => {
    clear();
    queryClient.clear();
    navigate("/login", { replace: true });
  }, [clear, navigate, queryClient]);
}
