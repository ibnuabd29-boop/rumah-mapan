const HOST_PUSH_DIIZINKAN = new Set([
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);

export function endpointPushDiizinkan(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && HOST_PUSH_DIIZINKAN.has(url.hostname);
  } catch {
    return false;
  }
}
