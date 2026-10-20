import React from "react";
import { Redirect } from "expo-router";
export default function Payments() {
  return (
    <Redirect
      href={{ pathname: "/trade", params: { kind: "customer_payment" } }}
    />
  );
}
