export interface User {
  id: Uint8Array;
  username: string;
  displayName: string;
  credentials: any[];
  createdAt: number;
}

export interface Session {
  username: string;
  created: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  username?: string;
}