import React, { useState } from "react";
import { Platform } from "react-native";
import { Fingerprint } from "lucide-react-native";
import { Screen, Card, T, Field, Button, ErrorNotice } from "./ui";
import { useTheme } from "../theme";
import { unlockPhone } from "../services/phone-security";
import { post } from "../services/api";
import { useSession, type Credentials } from "../store/session";

export function PhoneConnect() {
  const c = useTheme();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [fieldError, setFieldError] = useState<string>();
  const connect = async () => {
    if (busy) return;
    setError(undefined);
    if (!/^[a-f\d]{32}$/i.test(code.replace(/[\s-]/g, ""))) {
      setFieldError("Enter the full connection code from your business owner.");
      return;
    }
    setFieldError(undefined);
    setBusy(true);
    try {
      if (!(await unlockPhone())) return;
      const credentials = await post<Credentials>("/auth/phone/connect", {
        code,
        device: Platform.OS === "ios" ? "iPhone" : "Android phone",
      });
      await useSession.getState().setCredentials(credentials);
      setCode("");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      title="Connect your phone"
      maxWidth={460}
      action={
        <T size={11} color={c.muted}>
          ONE-TIME SETUP
        </T>
      }
    >
      <Card>
        <T color={c.muted}>
          Enter the one-time code from your business owner. After this, use your
          phone’s fingerprint, face or screen-lock PIN.
        </T>
        <Field
          label="Connection code"
          value={code}
          onChangeText={(value) => {
            setCode(value);
            setFieldError(undefined);
          }}
          error={fieldError}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={80}
          editable={!busy}
          onSubmitEditing={() => void connect()}
        />
        <ErrorNotice error={error} />
        <Button
          title="Connect & unlock"
          busy={busy}
          icon={<Fingerprint size={20} color={c.accentText} />}
          onPress={() => void connect()}
        />
        <T size={12} color={c.muted}>
          Get a code from Settings on a connected device, or ask the person who
          runs your business server. Codes expire after 10 minutes.
        </T>
      </Card>
    </Screen>
  );
}
