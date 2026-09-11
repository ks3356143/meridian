import { request } from "@/api/client";
import type { CreateUserPayload, ManagedUser, UpdateUserPayload, UserListResponse } from "./types";

export const usersApi = {
  list: () => request<UserListResponse>("GET", "/api/v1/users"),
  create: (payload: CreateUserPayload) =>
    request<ManagedUser>("POST", "/api/v1/users", {}, payload),
  update: (id: string, payload: UpdateUserPayload) =>
    request<ManagedUser>("PUT", `/api/v1/users/${id}`, {}, payload),
  remove: (id: string) => request<void>("DELETE", `/api/v1/users/${id}`),
};
