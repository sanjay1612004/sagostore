import { describe, expect, it } from "vitest";
import {
  stockQuantity,
  stockWeight,
  stockUnitWeight,
} from "../../mobile/services/stock-display.js";

describe("inventory quantity and unit weight", () => {
  it("shows twenty 10 kg bags as twenty bags and 200 kg, keeping per-bag weight visible", () => {
    expect(stockQuantity(20, "bag")).toBe("20 bags");
    expect(stockUnitWeight(10000, "bag")).toBe("10 kg per bag");
    expect(stockWeight(20, 10000)).toBe("200 kg");
  });
  it("shows a product's pack weight even before receiving any stock", () => {
    expect(stockQuantity(0, "bag")).toBe("0 bags");
    expect(stockWeight(0, 10000)).toBe("0 kg");
    expect(stockUnitWeight(10000, "bags")).toBe("10 kg per bag");
  });
  it("supports singular units, fractional kilogram weights, kg units and custom units", () => {
    expect(stockQuantity(1, "cartons")).toBe("1 carton");
    expect(stockUnitWeight(12500, "carton")).toBe("12.5 kg per carton");
    expect(stockWeight(20, 12500)).toBe("250 kg");
    expect(stockQuantity(20, "kg")).toBe("20 kg");
    expect(stockQuantity(20, "மூட்டை")).toBe("20 மூட்டை");
  });
});
