import React, { useState, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { productSchema, type Product } from "@tamiltrade/shared";
import { Screen, Card, Field, Button, ErrorNotice } from "../components/ui";
import { post, invalidateBusiness } from "../services/api";
import { FormDetails } from "../components/form-details";
import { useTradeSelection } from "../store/composer";
export default function ProductForm() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [error, setFailure] = useState<unknown>();
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<
    z.input<typeof productSchema>,
    unknown,
    z.output<typeof productSchema>
  >({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      category: "",
      unit: "bag",
      weightGrams: 50000,
      lowStockQuantity: 10,
    },
  });
  const values = watch();
  const detailsHaveErrors = !!(errors.category || errors.lowStockQuantity);
  useEffect(() => {
    if (detailsHaveErrors) setDetailsOpen(true);
  }, [detailsHaveErrors]);
  const submit = handleSubmit(async (values) => {
    try {
      const product = await post<Product>("/api/products", values);
      await invalidateBusiness();
      if (params.returnTo === "trade")
        useTradeSelection
          .getState()
          .set({ field: "productId", id: product._id });
      router.back();
    } catch (e) {
      setFailure(e);
    }
  });
  return (
    <Screen
      title="New product"
      subtitle="Configure units for the way you trade."
      back
      maxWidth={760}
    >
      <Card>
        {(["name", "unit", "weightGrams"] as const).map((name) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field }) => (
              <Field
                label={
                  {
                    name: "Product name",
                    category: "Category",
                    unit: "Trading unit · e.g. bag, kg, carton",
                    weightGrams: "Weight per unit · grams",
                    lowStockQuantity: "Low stock threshold · units",
                  }[name]
                }
                value={String(field.value ?? "")}
                onChangeText={(v) =>
                  field.onChange(name === "weightGrams" ? Number(v) : v)
                }
                onBlur={field.onBlur}
                keyboardType={name === "weightGrams" ? "number-pad" : "default"}
                error={errors[name]?.message}
              />
            )}
          />
        ))}
      </Card>
      <FormDetails
        title="Product options"
        summary={`Low stock alert: ${values.lowStockQuantity} units${values.category ? ` · ${values.category}` : ""}`}
        open={detailsOpen || !!(errors.category || errors.lowStockQuantity)}
        onToggle={() => setDetailsOpen(!detailsOpen)}
      >
        {(["category", "lowStockQuantity"] as const).map((name) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field }) => (
              <Field
                label={
                  name === "category"
                    ? "Category · optional"
                    : "Low stock threshold · units"
                }
                value={String(field.value ?? "")}
                onChangeText={(v) =>
                  field.onChange(name === "lowStockQuantity" ? Number(v) : v)
                }
                onBlur={field.onBlur}
                keyboardType={
                  name === "lowStockQuantity" ? "number-pad" : "default"
                }
                error={errors[name]?.message}
              />
            )}
          />
        ))}
      </FormDetails>
      <ErrorNotice error={error} />
      <Button
        title={
          params.returnTo === "trade" ? "Add & continue" : "Create product"
        }
        busy={isSubmitting}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
