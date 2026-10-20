import React from "react";
import { useQuery } from "@tanstack/react-query";
import { rupees } from "@tamiltrade/shared";
import {
  Screen,
  T,
  Card,
  Row,
  ErrorNotice,
  LoadingSkeleton,
  EmptyState,
} from "../components/ui";
import { api } from "../services/api";
import { useTheme } from "../theme";
type Price = {
  id: string;
  supplier: string;
  product: string;
  date: string;
  unitPrice: string;
  landedCostPerUnitPaise: number;
  quantity: number;
};
export default function Prices() {
  const c = useTheme();
  const q = useQuery({
    queryKey: ["prices"],
    queryFn: () => api<Price[]>("/api/prices"),
  });
  return (
    <Screen
      title="Mill price history"
      subtitle="Compare the actual prices you paid, including landed costs."
      back
    >
      <ErrorNotice error={q.error} retry={() => void q.refetch()} />
      {q.isPending ? (
        <LoadingSkeleton />
      ) : q.data?.length ? (
        q.data.map((p) => (
          <Card key={p.id}>
            <Row>
              <T weight="bold">{p.supplier}</T>
              <T color={c.muted} size={12}>
                {p.date}
              </T>
            </Row>
            <T color={c.muted}>
              {p.product} · {p.quantity} units
            </T>
            <Row>
              <T size={12}>Purchase unit price</T>
              <T>₹{p.unitPrice}</T>
            </Row>
            <Row>
              <T size={12}>Landed cost per unit</T>
              <T color={c.accent} weight="bold">
                {rupees(p.landedCostPerUnitPaise)}
              </T>
            </Row>
          </Card>
        ))
      ) : (
        <EmptyState
          title="No recorded mill prices"
          description="Purchase prices are captured automatically when you confirm purchases."
        />
      )}
      <T size={12} color={c.muted}>
        Shows the 200 most recent recorded prices. Compare the same product and
        trading unit.
      </T>
    </Screen>
  );
}
