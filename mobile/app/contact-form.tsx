import React, { useState, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { contactSchema, type Contact } from "@tamiltrade/shared";
import { Screen, Card, Field, Button, ErrorNotice } from "../components/ui";
import { api, post, invalidateBusiness } from "../services/api";
import { FormDetails } from "../components/form-details";
import { useTradeSelection } from "../store/composer";
const formSchema = contactSchema
  .omit({ aliases: true, kind: true })
  .extend({ aliasText: z.string().max(1000) });
export default function ContactForm() {
  const params = useLocalSearchParams<{
    kind: "supplier" | "customer";
    id?: string;
    data?: string;
    returnTo?: string;
  }>();
  const existing = params.data
    ? (JSON.parse(params.data) as Contact)
    : undefined;
  const [error, setFailure] = useState<unknown>();
  const [detailsOpen, setDetailsOpen] = useState(!!existing);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof formSchema>, unknown, z.output<typeof formSchema>>(
    {
      resolver: zodResolver(formSchema),
      defaultValues: {
        name: existing?.name ?? "",
        phone: existing?.phone ?? "",
        address: existing?.address ?? "",
        aliasText: existing?.aliases?.join(", ") ?? "",
        paymentTermsDays: existing?.paymentTermsDays ?? 30,
        creditLimit: existing ? String(existing.creditLimit / 100) : "0",
      },
    },
  );
  const values = watch();
  const detailsHaveErrors = !!(
    errors.address ||
    errors.aliasText ||
    errors.paymentTermsDays ||
    errors.creditLimit
  );
  useEffect(() => {
    if (detailsHaveErrors) setDetailsOpen(true);
  }, [detailsHaveErrors]);
  const submit = handleSubmit(async ({ aliasText, ...values }) => {
    try {
      setFailure(undefined);
      const input = {
        ...values,
        kind: existing?.kind ?? params.kind ?? "customer",
        aliases: aliasText
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
      };
      const contact = existing
        ? await api<Contact>(`/api/contacts/${existing._id}`, {
            method: "PATCH",
            body: JSON.stringify(input),
          })
        : await post<Contact>("/api/contacts", input);
      await invalidateBusiness();
      if (!existing && params.returnTo === "trade") {
        useTradeSelection
          .getState()
          .set({ field: "contactId", id: contact._id });
        router.back();
        return;
      }
      router.replace({
        pathname: "/contact/[id]",
        params: { id: contact._id },
      });
    } catch (e) {
      setFailure(e);
    }
  });
  const field = (
    name:
      | "name"
      | "phone"
      | "address"
      | "aliasText"
      | "paymentTermsDays"
      | "creditLimit",
  ) => (
    <Controller
      key={name}
      control={control}
      name={name}
      render={({ field }) => (
        <Field
          label={
            {
              name: "Contact name",
              phone: "Phone · optional",
              address: "Address · optional",
              aliasText: "Tamil / English aliases · comma separated",
              paymentTermsDays: "Payment terms · days",
              creditLimit: "Credit limit · ₹ (0 = no enforced limit)",
            }[name]
          }
          value={String(field.value ?? "")}
          onChangeText={(v) =>
            field.onChange(name === "paymentTermsDays" ? Number(v) : v)
          }
          onBlur={field.onBlur}
          keyboardType={
            name === "phone"
              ? "phone-pad"
              : ["paymentTermsDays", "creditLimit"].includes(name)
                ? "decimal-pad"
                : "default"
          }
          autoComplete={name === "phone" ? "tel" : "off"}
          error={errors[name]?.message}
        />
      )}
    />
  );
  return (
    <Screen
      title={existing ? "Edit contact" : `New ${params.kind ?? "customer"}`}
      subtitle={
        params.returnTo === "trade"
          ? "Add a name and continue your transaction."
          : "Start with a name. Add other details when you need them."
      }
      back
      maxWidth={760}
    >
      <Card>
        {field("name")}
        {field("phone")}
      </Card>
      <FormDetails
        title="Contact details & terms"
        summary={`${values.paymentTermsDays} day terms · ${Number(values.creditLimit) === 0 ? "No enforced credit limit" : `₹${values.creditLimit} credit limit`}${values.address ? " · Address added" : ""}${values.aliasText ? " · Aliases added" : ""}`}
        open={
          detailsOpen ||
          !!(
            errors.address ||
            errors.aliasText ||
            errors.paymentTermsDays ||
            errors.creditLimit
          )
        }
        onToggle={() => setDetailsOpen(!detailsOpen)}
      >
        {field("address")}
        {field("aliasText")}
        {field("paymentTermsDays")}
        {field("creditLimit")}
      </FormDetails>
      <ErrorNotice error={error} />
      <Button
        title={
          existing
            ? "Save contact"
            : params.returnTo === "trade"
              ? "Add & continue"
              : "Create contact"
        }
        busy={isSubmitting}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
