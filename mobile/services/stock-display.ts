const numbers = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });
const units: Record<string, [string, string]> = {
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
export const stockUnit = (unit: string, quantity = 1) =>
  units[unit.trim().toLowerCase()]?.[quantity === 1 ? 0 : 1] ?? unit;
export const stockQuantity = (quantity: number, unit: string) =>
  `${numbers.format(quantity)} ${stockUnit(unit, quantity)}`;
export const stockWeight = (quantity: number, weightGrams: number) =>
  `${numbers.format((quantity * weightGrams) / 1000)} kg`;
export const stockUnitWeight = (weightGrams: number, unit: string) =>
  `${stockWeight(1, weightGrams)} per ${stockUnit(unit)}`;
