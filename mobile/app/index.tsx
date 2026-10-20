import { Redirect } from "expo-router";
import { useSession } from "../store/session";
export default function Index() {
  const user = useSession((s) => s.user);
  return <Redirect href={user ? "/(tabs)" : "/(auth)/login"} />;
}
