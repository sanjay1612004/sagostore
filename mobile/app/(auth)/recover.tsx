import React, { useState } from "react";
import { router } from "expo-router";
import { Screen, Field, Button, T, ErrorNotice } from "../../components/ui";
import { post } from "../../services/api";
export default function Recover() {
  const [token, setToken] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(false);
  return (
    <Screen
      title="Recover your account"
      subtitle="Ask your business administrator for a one-time recovery token."
      back
    >
      {success ? (
        <>
          <T>Password updated. All existing sessions were revoked.</T>
          <Button
            title="Return to sign in"
            onPress={() => router.replace("/(auth)/login")}
          />
        </>
      ) : (
        <>
          <Field
            label="Recovery token"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            secureTextEntry
          />
          <Field
            label="New password · at least 12 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <ErrorNotice error={error} />
          <Button
            title="Set new password"
            busy={busy}
            onPress={() => {
              setBusy(true);
              setError(undefined);
              void post("/auth/recover", { token, password })
                .then(() => setSuccess(true))
                .catch(setError)
                .finally(() => setBusy(false));
            }}
          />
        </>
      )}
    </Screen>
  );
}
