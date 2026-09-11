export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  user: AuthUser;
}

export interface HealthResponse {
  status: "ok";
  version: string;
  sqliteVersion: string;
  checkedAt: string;
}
