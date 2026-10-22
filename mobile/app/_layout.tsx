import React, { useEffect, useState, useRef } from "react";
import { AppState, View, ActivityIndicator, Platform } from "react-native";
import { AppModal as Modal } from "../components/app-modal";
import { Stack, router, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { NotoSansTamil_400Regular } from "@expo-google-fonts/noto-sans-tamil/400Regular";
import { queryClient, restoreSession, post } from "../services/api";
import { useSession, type Credentials } from "../store/session";
import * as SecureStore from "../services/device-storage";
import { unlockPhone, lockPhoneOnAppState } from "../services/phone-security";
import { loadPreferences, usePreferences } from "../store/preferences";
import { useTheme } from "../theme";
import { Button, ErrorNotice, Screen, T } from "../components/ui";
import { STORE_NAME } from "../config/brand";
import { StoreIcon } from "../components/store-icon";
import {
  navigationDuration,
  useNavigationReducedMotion,
  WebStackTransition,
} from "../components/navigation-motion";
export default function RootLayout() {
  const [fonts, fontError] = useFonts({
    Inter: Inter_400Regular,
    InterMedium: Inter_500Medium,
    InterBold: Inter_700Bold,
    Tamil: NotoSansTamil_400Regular,
  });
  const c = useTheme(),
    theme = usePreferences((s) => s.theme),
    reducedMotion = useNavigationReducedMotion();
  const { user, ready, phoneUnlocked } = useSession();
  const segments = useSegments();
  const [error, setError] = useState<unknown>();
  const [hasConnection, setHasConnection] = useState(false);
  const [booted, setBooted] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState<unknown>();
  const [foreground, setForeground] = useState(0);
  const autoPrompted = useRef(false);
  const booting = useRef(false);
  const locked =
    Platform.OS !== "web" &&
    !phoneUnlocked &&
    ((hasConnection && !ready) || !!user);
  const bootstrap = async () => {
    if (booting.current) return;
    booting.current = true;
    setError(undefined);
    try {
      await loadPreferences();
      const stored = await SecureStore.getItemAsync("tamiltrade.session");
      setHasConnection(!!stored);
      if (
        Platform.OS !== "web" &&
        stored &&
        !useSession.getState().phoneUnlocked
      )
        return;
      await restoreSession();
      // Upgrade a previously signed-in phone after successful OS authentication.
      // No account password is needed again on this phone.
      if (Platform.OS !== "web" && useSession.getState().user) {
        const current = await SecureStore.getItemAsync("tamiltrade.session");
        if (current && !JSON.parse(current).phoneUnlock)
          await useSession
            .getState()
            .setCredentials(await post<Credentials>("/auth/phone/trust", {}));
      }
      setHasConnection(!!useSession.getState().user);
    } catch (e) {
      setError(e);
    } finally {
      booting.current = false;
      setBooted(true);
    }
  };
  useEffect(() => {
    void bootstrap();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setForeground((value) => value + 1);
      lockPhoneOnAppState(state);
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (ready && !user && !booting.current) setHasConnection(false);
  }, [user, ready]);
  useEffect(() => {
    if (!booted || !ready || !fonts || error || locked) return;
    const inAuth = segments[0] === "(auth)";
    if (!user && !inAuth) router.replace("/(auth)/login");
    else if (
      !user &&
      Platform.OS !== "web" &&
      inAuth &&
      segments[1] !== "login"
    )
      router.replace("/(auth)/login");
    else if (user && inAuth) router.replace("/(tabs)");
  }, [user, ready, segments, fonts, error, locked, booted]);
  const unlock = async () => {
    if (unlockBusy) return;
    setUnlockBusy(true);
    setUnlockError(undefined);
    try {
      if (await unlockPhone()) {
        if (!useSession.getState().user) await bootstrap();
      }
    } catch (e) {
      setUnlockError(e);
    } finally {
      setUnlockBusy(false);
    }
  };
  useEffect(() => {
    if (!locked) {
      autoPrompted.current = false;
      return;
    }
    if (
      booted &&
      fonts &&
      !autoPrompted.current &&
      AppState.currentState === "active"
    ) {
      autoPrompted.current = true;
      void unlock();
    }
  }, [locked, booted, fonts, foreground]);
  const shell = (children: React.ReactNode) => (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={theme === "dark" ? "light" : "dark"} />
          {children}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
  if (error)
    return shell(
      <Screen
        title="Let’s reconnect"
        subtitle="Your account is kept securely on this device."
      >
        <ErrorNotice error={error} retry={() => void bootstrap()} />
        <Button
          title={
            Platform.OS === "web"
              ? "Sign in with another account"
              : "Connect this phone again"
          }
          variant="secondary"
          onPress={() => {
            void useSession
              .getState()
              .clear()
              .then(() => {
                queryClient.clear();
                setHasConnection(false);
                setError(undefined);
              })
              .catch(setError);
          }}
        />
      </Screen>,
    );
  if (fontError)
    return shell(
      <View style={{ flex: 1, padding: 30, justifyContent: "center" }}>
        <T>Fonts could not load. Restart the app to try again.</T>
      </View>,
    );
  const lockContent = (
    <Screen
      maxWidth={460}
      title="Welcome back"
      action={
        <T size={11} color={c.muted}>
          LOCKED
        </T>
      }
      subtitle="Unlock with your phone’s fingerprint, face or screen-lock PIN."
    >
      <View style={{ alignItems: "center", paddingVertical: 28 }}>
        <StoreIcon size={96} />
      </View>
      <ErrorNotice error={unlockError} />
      <Button title="Unlock" busy={unlockBusy} onPress={() => void unlock()} />
    </Screen>
  );
  if (fonts && booted && locked && !ready) return shell(lockContent);
  if (!fonts || !booted || !ready)
    return shell(
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
        }}
      >
        <ActivityIndicator color={c.accent} />
        <StoreIcon size={96} />
        <T size={24} weight="bold">
          {STORE_NAME}
        </T>
        <T color={c.muted}>பேசுங்க... பிசினஸை நாங்க பாத்துக்குறோம்!</T>
      </View>,
    );
  const lockScreen =
    locked && user ? (
      <Modal visible presentationStyle="fullScreen">
        {lockContent}
      </Modal>
    ) : null;
  return shell(
    <>
      <View
        style={{ flex: 1, opacity: locked ? 0 : 1 }}
        pointerEvents={locked ? "none" : "auto"}
        accessibilityElementsHidden={locked}
        importantForAccessibility={locked ? "no-hide-descendants" : "auto"}
      >
        <Stack
          screenLayout={
            Platform.OS === "web"
              ? ({ children }) => (
                  <WebStackTransition>{children}</WebStackTransition>
                )
              : undefined
          }
          screenOptions={{
            headerShown: false,
            title: STORE_NAME,
            contentStyle: { backgroundColor: c.bg },
            animation: reducedMotion ? "none" : "fade_from_bottom",
            animationDuration: navigationDuration,
          }}
        >
          <Stack.Screen name="(tabs)" />
        </Stack>
      </View>
      {lockScreen}
    </>,
  );
}
