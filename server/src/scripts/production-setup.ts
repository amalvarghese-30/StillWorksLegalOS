/**
 * StillWorks LegalOS — Production Setup Script
 *
 * This script creates the initial administrator account securely.
 * Run ONCE during production deployment:
 *   NODE_ENV=production npx tsx src/scripts/production-setup.ts
 *
 * It will prompt for:
 * - Admin email
 * - Admin name
 * - Strong password (min 12 chars)
 *
 * This replaces the insecure /api/auth/seed endpoint.
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { connectDB } from "../db.js";
import { User } from "../models/User.js";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// Load production environment
dotenv.config({ path: new URL("../../.env", import.meta.url) });

const PASSWORD_MIN_LENGTH = 12;
const ADMIN_PERMISSIONS = {
  dashboard: true,
  clients: true,
  cases: true,
  tasks: true,
  documents: true,
  calendar: true,
  chat: true,
  reports: true,
  employees: true,
  approvals: true,
  auditLogs: true,
  settings: true,
};

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

async function promptHidden(question: string): Promise<string> {
  // For hidden input, we'll use a workaround since Node's readline doesn't support hidden
  // In production, consider using a library like 'prompt-sync' or 'inquirer'
  const rl = readline.createInterface({ input, output });
  // This will echo - for a real implementation, use a proper hidden input library
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
  }
  // Check for at least one lowercase, uppercase, number, and special char
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  if (!hasLower || !hasUpper || !hasNumber || !hasSpecial) {
    return {
      valid: false,
      message: "Password must contain: lowercase, uppercase, number, and special character",
    };
  }
  return { valid: true };
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function setup() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║  StillWorks LegalOS — Production Initialization              ║");
  console.log("║  This script creates the first administrator account.        ║");
  console.log("║  RUN ONLY ONCE during initial deployment.                     ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log("");

  // Verify production environment
  if (process.env["NODE_ENV"] !== "production") {
    console.error("❌ This script must run with NODE_ENV=production");
    process.exit(1);
  }

  const mongoUri = process.env["MONGODB_URI"];
  if (!mongoUri || mongoUri.includes("localhost")) {
    console.error("❌ MONGODB_URI must be set to a production MongoDB Atlas URI");
    process.exit(1);
  }

  const jwtSecret = process.env["JWT_SECRET"];
  if (!jwtSecret || jwtSecret === "dev-secret-change-me" || jwtSecret.length < 64) {
    console.error("❌ JWT_SECRET must be set to a strong 64+ character random string");
    process.exit(1);
  }

  // Get admin details
  console.log("📋 Administrator Account Setup");
  console.log("────────────────────────────────────────────────────────────");

  let email = "";
  while (!email) {
    email = await prompt("Admin email: ");
    if (!validateEmail(email)) {
      console.log("❌ Invalid email format");
      email = "";
    }
  }

  let name = "";
  while (!name) {
    name = await prompt("Admin full name (e.g., 'Adv. Rohan Desai'): ");
    if (name.length < 3) {
      console.log("❌ Name must be at least 3 characters");
      name = "";
    }
  }

  let password = "";
  while (!password) {
    password = await promptHidden("Admin password (min 12 chars, mixed case, numbers, symbols): ");
    const validation = validatePassword(password);
    if (!validation.valid) {
      console.log(`❌ ${validation.message}`);
      password = "";
    }
  }

  const confirmPassword = await promptHidden("Confirm password: ");
  if (password !== confirmPassword) {
    console.error("❌ Passwords do not match");
    process.exit(1);
  }

  // Connect and create
  console.log("\n🔌 Connecting to MongoDB...");
  await connectDB(mongoUri);

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.error("❌ User with this email already exists");
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log("🔐 Hashing password...");
  const passwordHash = await bcrypt.hash(password, 12);

  console.log("👤 Creating administrator account...");
  const admin = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: "admin",
    title: "Managing Partner · Administrator",
    status: "offline",
    permissions: ADMIN_PERMISSIONS,
  });

  console.log("\n✅ Administrator account created successfully!");
  console.log(`   Name:  ${admin.name}`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   Role:  ${admin.role}`);
  console.log(`   ID:    ${admin._id}`);

  await mongoose.disconnect();
  console.log("\n🎉 Production initialization complete!");
  console.log("   You can now log in to StillWorks LegalOS.");
}

setup().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});