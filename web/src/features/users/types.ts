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

export type UserDialogMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; user: ManagedUser };

export interface UserFormValues {
  username: string;
  displayName: string;
  password: string;
}

export type UserFormErrors = Partial<Record<keyof UserFormValues, string>>;
