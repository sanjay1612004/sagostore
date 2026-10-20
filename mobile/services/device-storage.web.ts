// Browser preview credentials live only in memory, never in localStorage.
const memory = new Map<string, string>();
const preferenceKey = "tamiltrade.preferences";
export async function getItemAsync(key: string): Promise<string | null> {
  if (key === preferenceKey && typeof window !== "undefined") {
    try {
      return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      /* Private browsers may disable storage. */
    }
  }
  return memory.get(key) ?? null;
}
export async function setItemAsync(key: string, value: string): Promise<void> {
  memory.set(key, value);
  if (key === preferenceKey && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* Keep preferences for this tab. */
    }
  }
}
export async function deleteItemAsync(key: string): Promise<void> {
  memory.delete(key);
  if (key === preferenceKey && typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* Already absent from usable storage. */
    }
  }
}
