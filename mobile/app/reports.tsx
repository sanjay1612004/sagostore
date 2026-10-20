import React from "react";
import { useQuery } from "@tanstack/react-query";
import { type Dashboard, rupees } from "@tamiltrade/shared";
import {
  Screen,
  T,
  Row,
  Card,
  FinancialMetricCard,
  ErrorNotice,
  LoadingSkeleton,
  EmptyState,
} from "../components/ui";
import { api } from "../services/api";
import { useTheme } from "../theme";
export default function Reports() {
  const c = useTheme();
  const q = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/api/dashboard"),
  });
  const r = q.data;
  return (
    <Screen
      title="Business performance"
      subtitle="Actual records. Clear decisions."
      back
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      <ErrorNotice error={q.error} retry={() => void q.refetch()} />
      {q.isPending ? (
        <LoadingSkeleton />
      ) : (
        r && (
          <>
            <Row>
              <FinancialMetricCard
                label="MONTHLY REVENUE"
                value={r.monthlyRevenue}
              />
              <FinancialMetricCard
                label="NET MONTHLY PROFIT"
                value={r.monthlyProfit}
              />
            </Row>
            <Card>
              <T size={19} weight="bold">
                Profit breakdown
              </T>
              <Row>
                <T>Gross trading profit</T>
                <T>{rupees(r.grossProfit)}</T>
              </Row>
              <Row>
                <T>Operating expenses</T>
                <T>{rupees(r.operatingExpenses)}</T>
              </Row>
              <Row>
                <T weight="bold">Net profit</T>
                <T color={c.accent} weight="bold">
                  {rupees(r.monthlyProfit)}
                </T>
              </Row>
              <T size={12} color={c.muted}>
                Current month · specific lot valuation. Includes allocated
                purchase costs and configured taxes. No input-tax credit
                assumed. Profit reflects entered records; unrecorded costs will
                change it.
              </T>
            </Card>
            <Row>
              <FinancialMetricCard label="RECEIVABLES" value={r.receivables} />
              <FinancialMetricCard label="PAYABLES" value={r.payables} />
            </Row>
            <Card>
              <T size={19} weight="bold">
                Daily sales & purchases
              </T>
              {r.trend.length ? (
                r.trend.map((p) => (
                  <Row key={p.date}>
                    <T color={c.muted} size={12}>
                      {p.date}
                    </T>
                    <T size={12}>
                      {rupees(p.sales)} / {rupees(p.purchases)}
                    </T>
                  </Row>
                ))
              ) : (
                <T color={c.muted}>No trading activity this month.</T>
              )}
            </Card>
            <T color={c.muted} size={12}>
              Cash collections and payments are cash flow. They are excluded
              from trading profit to avoid double counting.
            </T>
          </>
        )
      )}
    </Screen>
  );
}
