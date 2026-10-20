import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema } from "@tamiltrade/shared";
import { z } from "zod";
import {
  Screen,
  T,
  Card,
  Field,
  Button,
  ErrorNotice,
} from "../../components/ui";
import { post } from "../../services/api";
import { useSession, type Credentials } from "../../store/session";
import { useTheme } from "../../theme";
export default function Setup() {
  const c = useTheme();
  const [error, setError] = useState<unknown>();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<
    z.input<typeof registerSchema>,
    unknown,
    z.output<typeof registerSchema>
  >({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      businessName: "SAI GANESH STORE",
      businessType: "Wholesale trading",
      email: "",
      password: "",
    },
  });
  const submit = handleSubmit(async (values) => {
    try {
      setError(undefined);
      await useSession
        .getState()
        .setCredentials(await post<Credentials>("/auth/register", values));
    } catch (e) {
      setError(e);
    }
  });
  return (
    <Screen
      title="Make it your business."
      subtitle="Create your owner account and business profile."
      back
    >
      <Card>
        {(
          ["name", "businessName", "businessType", "email", "password"] as const
        ).map((name) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label={
                  {
                    name: "Your name",
                    businessName: "Business name",
                    businessType: "Business type",
                    email: "Email address",
                    password: "Password · at least 12 characters",
                  }[name]
                }
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry={name === "password"}
                autoCapitalize={name === "email" ? "none" : "sentences"}
                keyboardType={name === "email" ? "email-address" : "default"}
                error={errors[name]?.message}
              />
            )}
          />
        ))}
      </Card>
      <ErrorNotice error={error} />
      <Button
        title="Create business account"
        busy={isSubmitting}
        onPress={() => void submit()}
      />
      <T color={c.muted} size={12}>
        Products, units, suppliers and customers can be added after setup. No
        sample transactions are created.
      </T>
    </Screen>
  );
}
