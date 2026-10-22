import React, { useState } from "react";
import { Text, Platform } from "react-native";
import { router } from "expo-router";
import { Screen, T, Card, Select, Button, ErrorNotice } from "../components/ui";
import { usePreferences } from "../store/preferences";
import { useSession } from "../store/session";
import { useTheme } from "../theme";
import { logout, post } from "../services/api";
export default function Settings() {
  const c = useTheme(),
    prefs = usePreferences(),
    user = useSession((s) => s.user);
  const [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [connection, setConnection] = useState<{
    code: string;
    expiresAt: string;
  }>();
  const createCode = async () => {
    setCodeBusy(true);
    setError(undefined);
    setConnection(undefined);
    try {
      setConnection(await post("/auth/phone/connection-code", {}));
    } catch (e) {
      setError(e);
    } finally {
      setCodeBusy(false);
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
        <T weight="bold">Phone unlock</T>
        <T size={12} color={c.muted}>
          {Platform.OS === "web"
            ? "The mobile app uses the phone’s fingerprint, face or screen-lock PIN. Browser access uses your account sign-in."
            : "Your fingerprint, face or screen-lock PIN is required when opening the app and returning from the background. No account password needed."}
        </T>
        <Button
          title="Manage connected devices"
          variant="secondary"
          onPress={() => router.push("/security")}
        />
      </Card>
      <Card>
        <T weight="bold">Connect another phone</T>
        <T size={12} color={c.muted}>
          This code gives access to your account. Enter it only on a phone you
          trust.
        </T>
        {connection ? (
          <>
            <Text
              selectable
              style={{
                color: c.text,
                fontSize: 17,
                lineHeight: 27,
                fontFamily: "InterMedium",
              }}
            >
              {connection.code}
            </Text>
            <T size={12} color={c.muted}>
              Use once before{" "}
              {new Date(connection.expiresAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              .
            </T>
          </>
        ) : null}
        <Button
          title="Create connection code"
          variant="secondary"
          busy={codeBusy}
          onPress={() => void createCode()}
        />
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
        title={
          Platform.OS === "web"
            ? "Sign out of this device"
            : "Disconnect this phone"
        }
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
