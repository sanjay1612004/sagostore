import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@tamiltrade/shared";
import { z } from "zod";
import { router } from "expo-router";
import { Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Screen,
  T,
  Card,
  Field,
  Button,
  ErrorNotice,
  Row,
} from "../../components/ui";
import { post } from "../../services/api";
import { useSession, type Credentials } from "../../store/session";
import { useTheme } from "../../theme";
import { STORE_NAME } from "../../config/brand";
export default function Login() {
  const c = useTheme();
  const [visible, setVisible] = useState(false),
    [error, setError] = useState<unknown>();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const submit = handleSubmit(async (values) => {
    setError(undefined);
    try {
      await useSession
        .getState()
        .setCredentials(await post<Credentials>("/auth/login", values));
    } catch (e) {
      setError(e);
      setValue("password", "");
    }
  });
  return (
    <Screen
      maxWidth={540}
      title={`Welcome to ${STORE_NAME}.`}
      subtitle="Speak naturally. Run your business smarter."
    >
      <LinearGradient
        colors={[c.soft, c.blueSoft]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 24, borderRadius: 24, gap: 10 }}
      >
        <T size={27} color={c.accent}>
          வணக்கம்.
        </T>
        <T color={c.muted}>பேசுங்க... பிசினஸை நாங்க பாத்துக்குறோம்!</T>
      </LinearGradient>
      <Card>
        <T size={21} weight="bold">
          Welcome back
        </T>
        <T color={c.muted}>Sign in to your business account.</T>
        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange, onBlur } }) => (
            <Field
              label="Email address"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { value, onChange, onBlur } }) => (
            <Field
              label="Password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              secureTextEntry={!visible}
              autoComplete="current-password"
              onSubmitEditing={() => void submit()}
            />
          )}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? "Hide password" : "Show password"}
          onPress={() => setVisible(!visible)}
          style={{ paddingVertical: 12 }}
        >
          <Row>
            <T color={c.muted} size={12}>
              {visible ? "Hide password" : "Show password"}
            </T>
            {visible ? (
              <EyeOff size={18} color={c.muted} />
            ) : (
              <Eye size={18} color={c.muted} />
            )}
          </Row>
        </Pressable>
        <ErrorNotice error={error} />
        <Button
          title="Sign in"
          busy={isSubmitting}
          icon={<ArrowRight size={18} color={c.accentText} />}
          onPress={() => void submit()}
        />
        <Button
          title="Set up your business"
          variant="secondary"
          onPress={() => router.push("/(auth)/setup")}
        />
        <Button
          title="Recover account"
          variant="secondary"
          onPress={() => router.push("/(auth)/recover")}
        />
      </Card>
      <Row>
        <ShieldCheck size={17} color={c.muted} />
        <View style={{ flex: 1 }}>
          <T size={11} color={c.muted}>
            Your records stay private to your business.
          </T>
        </View>
      </Row>
    </Screen>
  );
}
