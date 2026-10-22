import { Redirect, Slot, useSegments } from "expo-router";
import { Platform } from "react-native";

export default function AuthLayout() {
  const segments = useSegments();
  if (Platform.OS !== "web" && segments[1] !== "login")
    return <Redirect href="/(auth)/login" />;
  return <Slot />;
}
