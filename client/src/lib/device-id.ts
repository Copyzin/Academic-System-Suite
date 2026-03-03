const DEVICE_STORAGE_KEY = "academic-system-device-id";

function generateDeviceId() {
  const entropy = Math.random().toString(36).slice(2);
  return `web-${Date.now()}-${entropy}`;
}

export function getDeviceId() {
  if (typeof window === "undefined") return "server-device";

  const existing = window.localStorage.getItem(DEVICE_STORAGE_KEY);
  if (existing) return existing;

  const created = generateDeviceId();
  window.localStorage.setItem(DEVICE_STORAGE_KEY, created);
  return created;
}
