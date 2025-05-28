
export const IVA_RATE = 0.19; // 19%

export const FINANCING_OPTIONS: { [key: number]: { rate: number; label: string } } = {
  0: { rate: 0, label: "Sin financiación" }, // Opción para cuando no se financia
  3: { rate: 0.05, label: "3 meses" }, // 5%
  6: { rate: 0.08, label: "6 meses" }, // 8%
  9: { rate: 0.10, label: "9 meses" }, // 10%
  12: { rate: 0.12, label: "12 meses" }, // 12%
};

export const PAYMENT_METHODS = [
  "Efectivo",
  "Transferencia Bancaria",
  "Tarjeta de Crédito",
  "Tarjeta Débito",
  "PSE",
  "Otro",
];
