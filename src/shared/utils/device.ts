const DEVICE_ID_STORAGE_KEY = "alfred_device_id_v1";
const DEVICE_METADATA_STORAGE_KEY = "alfred_device_metadata";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function generateDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const random = Math.random().toString(36).slice(2);
  const timestamp = Date.now().toString(36);
  return `${timestamp}-${random}`;
}

export function getDeviceId(): string | null {
  if (!isBrowser()) {
    return null;
  }
  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  return existing && existing.trim() !== "" ? existing : null;
}

export function ensureDeviceId(): string | null {
  if (!isBrowser()) {
    return null;
  }
  const current = getDeviceId();
  if (current) {
    return current;
  }
  const generated = generateDeviceId();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
  return generated;
}

function resolveDeviceName(): string {
  if (!isBrowser()) {
    return "Dispositivo";
  }
  const { navigator, screen } = window;
  const platform = navigator?.platform ?? "";
  const deviceMemory = (navigator as Record<string, unknown>)?.deviceMemory;
  const memoryLabel = typeof deviceMemory === "number" ? `${deviceMemory}GB` : null;
  const screenLabel = screen ? `${screen.width}x${screen.height}` : null;
  const parts = [navigator.userAgent];
  if (platform) parts.push(platform);
  if (memoryLabel) parts.push(memoryLabel);
  if (screenLabel) parts.push(screenLabel);
  return parts.filter(Boolean).join(" · ").slice(0, 200);
}

export type DeviceMetadata = {
  deviceId: string | null;
  deviceName: string;
  userAgent: string | null;
  locale: string | null;
  timezone: string | null;
  screen: string | null;
};

export function collectDeviceMetadata(): DeviceMetadata {
  const deviceId = ensureDeviceId();
  if (!isBrowser()) {
    return {
      deviceId,
      deviceName: "Dispositivo",
      userAgent: null,
      locale: null,
      timezone: null,
      screen: null,
    };
  }

  const { navigator, screen } = window;
  const locale = navigator?.language ?? navigator?.languages?.[0] ?? null;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  const screenLabel = screen ? `${screen.width}x${screen.height}` : null;

  const metadata: DeviceMetadata = {
    deviceId,
    deviceName: resolveDeviceName(),
    userAgent: navigator?.userAgent ?? null,
    locale,
    timezone,
    screen: screenLabel,
  };

  try {
    window.localStorage.setItem(DEVICE_METADATA_STORAGE_KEY, JSON.stringify(metadata));
  } catch {
    // ignore
  }

  return metadata;
}

export function getCachedDeviceMetadata(): DeviceMetadata | null {
  if (!isBrowser()) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(DEVICE_METADATA_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as DeviceMetadata;
    if (!parsed.deviceId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
