export const normalizeSriLankaNumber = (input: string): string => {
  const trimmed = input.trim();
  if (/^0\d{9}$/.test(trimmed)) {
    return `+94${trimmed.slice(1)}`;
  }
  return trimmed;
};

export const isSriLankaE164 = (input: string): boolean => {
  return /^\+94\d{9}$/.test(input);
};

export const toWhatsAppId = (e164: string): string => {
  return `${e164.replace("+", "")}@c.us`;
};
