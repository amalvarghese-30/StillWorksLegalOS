/**
 * Password Reset Delivery Provider
 *
 * Real delivery abstraction for one-time passwords during password recovery.
 * Never logs raw OTP or credentials in production logs.
 */

export interface PasswordResetDeliveryInput {
  destination: string;
  otp: string;
  expiresAt: Date;
  channel: "email" | "sms";
}

export interface PasswordResetDeliveryProvider {
  sendOtp(input: PasswordResetDeliveryInput): Promise<void>;
}

// In-memory record for test suite inspection
export const deliveredOtpsForTesting: { destination: string; otp: string; timestamp: Date }[] = [];

export class StandardPasswordResetDeliveryProvider implements PasswordResetDeliveryProvider {
  async sendOtp(input: PasswordResetDeliveryInput): Promise<void> {
    const isProd = process.env["NODE_ENV"] === "production";
    const webhookUrl = process.env["OTP_DELIVERY_WEBHOOK_URL"] || process.env["EMAIL_WEBHOOK_URL"];

    // Always record in testing buffer if in test/dev environment
    if (!isProd || process.env["VITEST"] || process.env["NODE_ENV"] === "test") {
      deliveredOtpsForTesting.push({
        destination: input.destination,
        otp: input.otp,
        timestamp: new Date(),
      });
    }

    if (webhookUrl) {
      // Dispatches to external enterprise email/SMS dispatch webhook
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env["OTP_WEBHOOK_SECRET"]
            ? { "x-webhook-secret": process.env["OTP_WEBHOOK_SECRET"] }
            : {}),
        },
        body: JSON.stringify({
          channel: input.channel,
          destination: input.destination,
          code: input.otp,
          expiresAt: input.expiresAt.toISOString(),
          appName: "StillWorks LegalOS",
        }),
      });

      if (!res.ok) {
        throw new Error(`OTP dispatch webhook returned HTTP ${res.status}`);
      }
      return;
    }

    // In production without external webhook, if mandatory delivery is expected
    if (isProd && !process.env["ALLOW_CONSOLE_OTP_FALLBACK"]) {
      // In production without an active dispatch provider, fail cleanly rather than pretend delivery
      console.error(
        `[auth] Password reset requested for ${input.destination.slice(0, 3)}***, but no external OTP delivery webhook (OTP_DELIVERY_WEBHOOK_URL) is configured.`
      );
      throw new Error("No mail delivery provider configured on this server");
    }

    // Safe dev/test delivery output:
    const masked = input.destination.includes("@")
      ? `${input.destination.slice(0, 2)}***@${input.destination.split("@")[1]}`
      : `${input.destination.slice(0, 3)}***${input.destination.slice(-2)}`;

    if (!isProd) {
      console.log(`[auth] [DEV ONLY] Dispatched OTP to ${masked} (code: ${input.otp}, expires: ${input.expiresAt.toLocaleTimeString()})`);
    } else {
      console.log(`[auth] Dispatched verification code to ${masked}`);
    }
  }
}

let activeProvider: PasswordResetDeliveryProvider = new StandardPasswordResetDeliveryProvider();

export function setPasswordResetDeliveryProvider(provider: PasswordResetDeliveryProvider): void {
  activeProvider = provider;
}

export function getPasswordResetDeliveryProvider(): PasswordResetDeliveryProvider {
  return activeProvider;
}
