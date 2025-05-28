
// This file is now less critical as financing options will be primarily managed
// from Firestore settings. However, IVA_RATE and PAYMENT_METHODS can remain here.

export const IVA_RATE = 0.19; // 19%

// Default FINANCING_OPTIONS - these are used as a fallback or initial seed
// if Firestore settings are unavailable. The primary source will be Firestore.
export const DEFAULT_FINANCING_OPTIONS: { [key: number]: { rate: number; label: string } } = {
  0: { rate: 0, label: "Sin financiación" },
  3: { rate: 0.05, label: "3 meses" },
  6: { rate: 0.08, label: "6 meses" },
  9: { rate: 0.10, label: "9 meses" },
  12: { rate: 0.12, label: "12 meses" },
};

export const PAYMENT_METHODS = [
  "Efectivo",
  "Transferencia Bancaria",
  "Tarjeta de Crédito",
  "Tarjeta Débito",
  "PSE",
  "Otro",
];
