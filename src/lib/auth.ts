/**
 * Authentication module for ZeroClaw API
 * Handles token management for API requests
 */

/**
 * Get the ZeroClaw API token from environment variables
 * @returns The API token or empty string if not configured
 */
export function getToken(): string {
  return import.meta.env.VITE_ZEROCLAW_TOKEN || '';
}

/**
 * Check if the API token is configured
 * @returns true if token is present, false otherwise
 */
export function isAuthenticated(): boolean {
  const token = getToken();
  return token.length > 0;
}

/**
 * React hook for accessing the ZeroClaw API token
 * Use this hook in components that need to make API calls
 * @returns The API token string
 */
export function useAuth(): string {
  return getToken();
}

/**
 * Get authorization headers for API requests
 * @returns Headers object with Bearer token
 */
export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) {
    return {};
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}
