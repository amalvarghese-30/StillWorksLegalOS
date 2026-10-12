import crypto from "node:crypto";

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export class WhatsAppProvider {
  private static getApiToken(): string {
    return process.env["WHATSAPP_API_TOKEN"] || "";
  }

  private static getPhoneNumberId(): string {
    return process.env["WHATSAPP_PHONE_NUMBER_ID"] || "";
  }

  static isConfigured(): boolean {
    return Boolean(this.getApiToken() && this.getPhoneNumberId());
  }

  /**
   * Sends a WhatsApp message via Meta Cloud API
   * @param to E.164 formatted phone number (e.g. +919876543210 or 919876543210)
   * @param message Message body text
   */
  static async sendMessage(to: string, message: string): Promise<WhatsAppSendResult> {
    const token = this.getApiToken();
    const phoneId = this.getPhoneNumberId();

    if (!token || !phoneId) {
      return {
        success: false,
        errorCode: "PROVIDER_NOT_CONFIGURED",
        errorMessage: "WhatsApp Cloud API credentials (WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID) not configured in environment.",
      };
    }

    // Clean recipient phone to digits only (Meta requires country code without leading +)
    const cleanTo = to.replace(/[^\d]/g, "");
    if (cleanTo.length < 10) {
      return {
        success: false,
        errorCode: "INVALID_PHONE_NUMBER",
        errorMessage: `Recipient phone number "${to}" is not a valid international format.`,
      };
    }

    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanTo,
          type: "text",
          text: {
            preview_url: false,
            body: message,
          },
        }),
      });

      const data: any = await response.json();

      if (response.ok && data?.messages?.[0]?.id) {
        return {
          success: true,
          messageId: data.messages[0].id,
        };
      }

      const err = data?.error || {};
      return {
        success: false,
        errorCode: String(err.code || response.status),
        errorMessage: err.message || "Failed to deliver WhatsApp message via Meta Cloud API",
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: "NETWORK_ERROR",
        errorMessage: err?.message || "Failed to connect to Meta WhatsApp Graph API",
      };
    }
  }

  /**
   * Verifies incoming webhook signature from Meta
   */
  static verifyWebhookSignature(payload: string, signatureHeader: string | undefined): boolean {
    const secret = process.env["WHATSAPP_APP_SECRET"];
    if (!secret) return true; // If app secret is not configured, signature check is disabled in dev
    if (!signatureHeader) return false;

    const [algo, hash] = signatureHeader.split("=");
    if (algo !== "sha256" || !hash) return false;

    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expected, "hex"));
  }
}
