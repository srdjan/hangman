// Utility functions for WebAuthn using base64url encoding
export const toB64 = (b: ArrayBuffer): string => {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(b)));
  // Convert to base64url: replace + with -, / with _, and remove padding
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const fromB64 = (s: string): Uint8Array => {
  // Convert from base64url to base64: replace - with +, _ with /, and add padding
  let base64 = s.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

export const now = (): number => Date.now();

export function generateSessionId(): string {
  return crypto.getRandomValues(new Uint8Array(16))
    .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
}

export function generateUserId(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export function logRequest(ip: string, method: string, url: string, status: number): void {
  console.log(
    `[${new Date().toISOString()}] ${ip} ${method} ${url} → ${status}`,
  );
}