import crypto from "crypto";

export const sha256Hex = (input: string): string => {
  return crypto.createHash("sha256").update(input).digest("hex");
};

// Avoid timing leaks for OTP/API key comparisons.
export const timingSafeEqualHex = (a: string, b: string): boolean => {
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
};

export const generateNumericOtp = (digits = 6): string => {
  if (digits < 4 || digits > 8) {
    throw new Error("Invalid OTP digits");
  }
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  const otp = Math.floor(min + Math.random() * (max - min + 1));
  return String(otp);
};

