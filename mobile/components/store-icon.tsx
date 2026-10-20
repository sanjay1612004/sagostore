import React from "react";
import { Image } from "react-native";

export function StoreIcon({ size = 40 }: { size?: number }) {
  return (
    <Image
      source={require("../assets/branding/store-logo.png")}
      resizeMode="contain"
      style={{ width: size, height: size }}
      accessible={false}
    />
  );
}
