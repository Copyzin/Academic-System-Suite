import { createHash, randomBytes } from "crypto";

export function normalizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

export function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function generateFiveDigitToken() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

export function generateCancelToken() {
  return randomBytes(24).toString("hex");
}

export type PasswordStrength = "fraca" | "media" | "segura";

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const kinds = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;

  if (password.length < 8 || kinds <= 1) {
    return "fraca";
  }

  if (password.length >= 8 && kinds >= 3) {
    return "segura";
  }

  return "media";
}

export function isPasswordStrongEnough(password: string) {
  return evaluatePasswordStrength(password) !== "fraca";
}
