export type PasswordStrength = "fraca" | "media" | "segura";

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const kinds = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;

  if (password.length < 8 || kinds <= 1) return "fraca";
  if (password.length > 8 && kinds >= 3) return "segura";
  return "media";
}

export function getPasswordStrengthClass(strength: PasswordStrength): string {
  if (strength === "fraca") return "text-red-600";
  if (strength === "media") return "text-sky-500";
  return "text-green-600";
}

export function getPasswordStrengthLabel(strength: PasswordStrength): string {
  if (strength === "fraca") return "Fraca";
  if (strength === "media") return "Media";
  return "Segura";
}
