import React from "react";
import { View } from "react-native";
import type { StockSummary } from "@tamiltrade/shared";
import { router } from "expo-router";
import { Button, Row, T } from "./ui";
import { useTheme, useCopy } from "../theme";

const numbers = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });
const unitForms: Record<string, [string, string]> = {
  bag: ["bag", "bags"],
  bags: ["bag", "bags"],
  carton: ["carton", "cartons"],
  cartons: ["carton", "cartons"],
  box: ["box", "boxes"],
  boxes: ["box", "boxes"],
  piece: ["piece", "pieces"],
  pieces: ["piece", "pieces"],
  unit: ["unit", "units"],
  units: ["unit", "units"],
};

export function StockSummaryView({ summary }: { summary: StockSummary }) {
  const c = useTheme(),
    copy = useCopy();
  const quantity = (value: number, unit: string) => {
    const label = unitForms[unit.toLowerCase()]?.[value === 1 ? 0 : 1] ?? unit;
    const tamil = ["bag", "bags"].includes(unit.toLowerCase())
      ? value === 1
        ? "மூட்டை"
        : "மூட்டைகள்"
      : label;
    return `${numbers.format(value)} ${copy(label, tamil)}`;
  };
  const hasDirect = summary.products.some(
    (product) => product.directQuantity > 0,
  );
  return (
    <View style={{ gap: 16 }}>
      {!summary.products.length ? (
        <T color={c.muted}>
          {copy("No stock available.", "தற்போது இருப்பு இல்லை.")}
        </T>
      ) : (
        summary.products.map((product, index) => (
          <View
            key={product.productId}
            style={{
              gap: 10,
              ...(index > 0
                ? { paddingTop: 16, borderTopWidth: 1, borderColor: c.border }
                : {}),
            }}
          >
            <T size={17} weight="bold">
              {product.productName}
            </T>
            <Row style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
              <View style={{ gap: 3 }}>
                <T size={12} color={c.muted}>
                  {copy("In warehouse", "கிடங்கில் இருப்பு")}
                </T>
                {!!product.weightGrams &&
                  product.warehouseQuantity > 0 &&
                  !(
                    product.unit.toLowerCase() === "kg" &&
                    product.weightGrams === 1000
                  ) && (
                    <T size={12} color={c.muted}>
                      {numbers.format(
                        (product.warehouseQuantity * product.weightGrams) /
                          1000,
                      )}{" "}
                      kg {copy("total weight", "மொத்த எடை")}
                    </T>
                  )}
              </View>
              <T
                size={24}
                weight="bold"
                color={product.warehouseQuantity > 0 ? c.accent : c.muted}
              >
                {quantity(product.warehouseQuantity, product.unit)}
              </T>
            </Row>
            {product.directQuantity > 0 && (
              <Row style={{ flexWrap: "wrap" }}>
                <T size={13} color={c.muted}>
                  {copy("Direct delivery", "நேரடி விநியோகம்")}
                </T>
                <T size={14} weight="medium">
                  {quantity(product.directQuantity, product.unit)}
                </T>
              </Row>
            )}
          </View>
        ))
      )}
      {hasDirect && (
        <T size={12} color={c.muted}>
          {copy(
            "Direct deliveries are not included in warehouse stock.",
            "நேரடி விநியோகப் பொருட்கள் கிடங்கு இருப்பில் சேர்க்கப்படவில்லை.",
          )}
        </T>
      )}
      <Button
        title={copy("View inventory", "இருப்பைப் பார்க்க")}
        variant="secondary"
        onPress={() => router.push("/inventory")}
      />
    </View>
  );
}
