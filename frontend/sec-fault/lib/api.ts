const API_PROXY_PREFIX = "/api/backend";

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_PROXY_PREFIX}${normalizedPath}`;
}