/**
 * Centralized Password Policy Service
 * Enforces consistent password strength across employee creation,
 * password change, and password reset flows.
 */

export interface PasswordValidationResult {
  valid: boolean;
  message?: string;
}

export function validatePasswordStrength(password: unknown): PasswordValidationResult {
  if (typeof password !== "string") {
    return { valid: false, message: "Password must be a valid text string." };
  }

  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long." };
  }

  if (password.length > 128) {
    return { valid: false, message: "Password must not exceed 128 characters." };
  }

  // Check for at least one letter and at least one digit or special character
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigitOrSpecial = /[\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasLetter || !hasDigitOrSpecial) {
    return {
      valid: false,
      message: "Password must contain at least one letter and at least one number or special character.",
    };
  }

  return { valid: true };
}
