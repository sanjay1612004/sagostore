import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import {
  Screen,
  Card,
  Field,
  Button,
  T,
  ErrorNotice,
  LoadingSkeleton,
} from "../components/ui";
import { api, invalidateBusiness } from "../services/api";
type Profile = {
  name: string;
  type: string;
  address: string;
  phone: string;
  taxId: string;
  bankDetails: string;
  upi: string;
  invoicePrefix: string;
};
export default function Profile() {
  const q = useQuery({
    queryKey: ["business"],
    queryFn: () => api<Profile>("/api/business"),
  });
  const [error, setError] = useState<unknown>(),
    [saved, setSaved] = useState(false);
  const {
    control,
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Profile>();
  useEffect(() => {
    if (q.data) reset(q.data);
  }, [q.data, reset]);
  const submit = handleSubmit(async (values) => {
    setSaved(false);
    setError(undefined);
    try {
      await api("/api/business", {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      await invalidateBusiness();
      setSaved(true);
    } catch (e) {
      setError(e);
    }
  });
  return (
    <Screen
      title="Business profile"
      subtitle="These details are preserved on every issued invoice."
      back
    >
      <ErrorNotice error={q.error ?? error} retry={() => void q.refetch()} />
      {q.isPending ? (
        <LoadingSkeleton />
      ) : (
        <>
          <Card>
            {(
              [
                "name",
                "type",
                "address",
                "phone",
                "taxId",
                "bankDetails",
                "upi",
                "invoicePrefix",
              ] as const
            ).map((name) => (
              <Controller
                key={name}
                name={name}
                control={control}
                render={({ field }) => (
                  <Field
                    label={
                      {
                        name: "Business name",
                        type: "Business type",
                        address: "Business address",
                        phone: "Phone",
                        taxId: "Tax registration · if applicable",
                        bankDetails: "Bank payment details",
                        upi: "UPI ID",
                        invoicePrefix: "Invoice prefix · A–Z and 0–9",
                      }[name]
                    }
                    value={field.value ?? ""}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    autoCapitalize={
                      name === "invoicePrefix" ? "characters" : "sentences"
                    }
                  />
                )}
              />
            ))}
          </Card>
          {saved && (
            <T accessibilityLiveRegion="polite">Business profile saved.</T>
          )}
          <Button
            title="Save business profile"
            busy={isSubmitting}
            onPress={() => void submit()}
          />
        </>
      )}
    </Screen>
  );
}
