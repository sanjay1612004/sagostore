export { getItemAsync, setItemAsync, deleteItemAsync } from "expo-secure-store";
import { WHEN_UNLOCKED_THIS_DEVICE_ONLY } from "expo-secure-store";
export const sessionStorageOptions = {
  keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
