export interface ManagedUser {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
}

export interface CreateUserPayload {
  username: string;
  displayName: string;
  password: string;
}

export interface UpdateUserPayload {
  displayName: string;
  password: string;
}

export interface UserListResponse {
  users: ManagedUser[];
}
