import React, { useState } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { Switch, Platform } from "react-native";
import {
  Screen,
  T,
  Card,
  Row,
  Select,
  Button,
  ErrorNotice,
} from "../components/ui";
import { usePreferences } from "../store/preferences";
import { useSession } from "../store/session";
import { useTheme } from "../theme";
import { logout } from "../services/api";
import { STORE_NAME } from "../config/brand";
export default function Settings() {
  const c = useTheme(),
    prefs = usePreferences(),
    user = useSession((s) => s.user);
  const [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const biometrics = async (enabled: boolean) => {
    try {
      if (enabled) {
        if (
          !(await LocalAuthentication.hasHardwareAsync()) ||
          !(await LocalAuthentication.isEnrolledAsync())
        )
          throw new Error(
            "Set up fingerprint or face unlock in your device settings first.",
          );
        const auth = await LocalAuthentication.authenticateAsync({
          promptMessage: `Enable ${STORE_NAME} app lock`,
        });
        if (!auth.success) return;
      }
      await prefs.set({ biometric: enabled });
    } catch (e) {
      setError(e);
    }
  };
  return (
    <Screen
      title="Settings"
      subtitle="Appearance, language and account security."
      back
    >
      <Card>
        <Select
          label="Appearance"
          value={prefs.theme}
          onChange={(v) => {
            void prefs.set({ theme: v as "dark" | "light" }).catch(setError);
          }}
          options={[
            { value: "dark", label: "Charcoal & emerald" },
            { value: "light", label: "Light & emerald" },
          ]}
        />
        <Select
          label="Primary language"
          value={prefs.language}
          onChange={(v) => {
            void prefs.set({ language: v as "ta" | "en" }).catch(setError);
          }}
          options={[
            { value: "ta", label: "தமிழ் · Tamil" },
            { value: "en", label: "English" },
          ]}
        />
        <T size={12} color={c.muted}>
          Tamil greetings are available. Navigation and detailed business forms
          use English labels.
        </T>
      </Card>
      <Card>
        <Row>
          <T>Biometric app lock</T>
          <Switch
            accessibilityLabel="Biometric app lock"
            value={prefs.biometric}
            disabled={Platform.OS === "web"}
            onValueChange={(v) => void biometrics(v)}
            trackColor={{ true: c.accent, false: c.border }}
          />
        </Row>
        <T size={12} color={c.muted}>
          {Platform.OS === "web"
            ? "Fingerprint and face unlock are available in the Android and iOS app."
            : "Require device authentication when returning from the background."}
        </T>
      </Card>
      <Card>
        <T weight="bold">{user?.name}</T>
        <T color={c.muted}>{user?.email}</T>
        <T size={12} color={c.muted}>
          {user?.role.toUpperCase()} ACCOUNT
        </T>
      </Card>
      <ErrorNotice error={error} />
      <Button
        title="Sign out of this device"
        variant="danger"
        busy={busy}
        onPress={() => {
          setBusy(true);
          void logout()
            .catch(setError)
            .finally(() => setBusy(false));
        }}
      />
    </Screen>
  );
}
