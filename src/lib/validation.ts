/**
 * Enterprise Validation Utilities for S & S Associates LegalOS
 * Validates Indian & International Phone Numbers, Aadhaar, PAN, and Emails.
 */

/** Validates 10-digit Indian mobile numbers or valid international format */
export function validatePhone(phone: string): { valid: boolean; error?: string } {
  if (!phone || !phone.trim()) {
    return { valid: true }; // Optional unless marked required
  }
  const clean = phone.replace(/[\s\-\(\)\+]/g, "");
  // Indian 10-digit standard or with country code (91)
  if (/^(\+?91)?[6-9]\d{9}$/.test(clean)) {
    return { valid: true };
  }
  // Generic international (between 7 and 15 digits)
  if (/^\+?\d{7,15}$/.test(clean)) {
    return { valid: true };
  }
  return {
    valid: false,
    error: "Enter a valid 10-digit mobile number (e.g. 9876543210)",
  };
}

/** Validates 12-digit Indian Aadhaar card number */
export function validateAadhaar(aadhaar: string): { valid: boolean; error?: string } {
  if (!aadhaar || !aadhaar.trim()) {
    return { valid: true };
  }
  const clean = aadhaar.replace(/[\s\-]/g, "");
  if (/^\d{12}$/.test(clean)) {
    return { valid: true };
  }
  return {
    valid: false,
    error: "Aadhaar must be exactly 12 digits",
  };
}

/** Validates 10-character Indian PAN (5 letters, 4 digits, 1 letter) */
export function validatePan(pan: string): { valid: boolean; error?: string } {
  if (!pan || !pan.trim()) {
    return { valid: true };
  }
  const clean = pan.trim().toUpperCase();
  if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(clean)) {
    return { valid: true };
  }
  return {
    valid: false,
    error: "PAN must follow standard format (e.g. ABCDE1234F)",
  };
}

/** Validates standard email address */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || !email.trim()) {
    return { valid: true };
  }
  const clean = email.trim();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailRegex.test(clean)) {
    return { valid: true };
  }
  return {
    valid: false,
    error: "Enter a valid email address (e.g. advocate@firm.legal)",
  };
}

/** Helper to clean phone numbers on input */
export function sanitizePhone(input: string): string {
  return input.replace(/[^\d\+\-\s]/g, "");
}

/** Helper to clean and uppercase PAN on input */
export function sanitizePan(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

/** Helper to clean Aadhaar on input */
export function sanitizeAadhaar(input: string): string {
  return input.replace(/\D/g, "").slice(0, 12);
}
