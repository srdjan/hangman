export interface Credential {
  credentialId: string;
  credentialPublicKey: Uint8Array;
  counter: number;
}

export interface User {
  id: Uint8Array;
  username: string;
  displayName: string;
  credentials: Credential[];
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