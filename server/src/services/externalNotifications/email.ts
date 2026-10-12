import { GmailAccount } from "../../models/GmailAccount.js";

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export class EmailProvider {
  static isConfigured(): boolean {
    return Boolean(process.env["GOOGLE_CLIENT_ID"] && process.env["GOOGLE_CLIENT_SECRET"]);
  }

  /**
   * Sends an email using connected Gmail account or configured mailer
   */
  static async sendEmail(to: string, subject: string, body: string, senderUserId?: string): Promise<EmailSendResult> {
    // 1. Look for connected Gmail account for sender or system default
    let account = null;
    if (senderUserId) {
      account = await GmailAccount.findOne({ userId: senderUserId, syncStatus: "connected" });
    }
    if (!account) {
      account = await GmailAccount.findOne({ syncStatus: "connected", isDefault: true }) ||
                await GmailAccount.findOne({ syncStatus: "connected" });
    }

    if (!account || !account.accessToken) {
      return {
        success: false,
        errorCode: "PROVIDER_NOT_CONFIGURED",
        errorMessage: "No connected Gmail account available for sending outbound notifications.",
      };
    }

    // Refresh token if needed
    let token = account.accessToken;
    if (account.expiryDate && Date.now() >= account.expiryDate - 60000 && account.refreshToken) {
      const clientId = process.env["GOOGLE_CLIENT_ID"];
      const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
      if (clientId && clientSecret) {
        try {
          const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: account.refreshToken,
              grant_type: "refresh_token",
            }),
          });
          if (res.ok) {
            const data: any = await res.json();
            token = data.access_token;
            account.accessToken = token;
            if (data.expires_in) {
              account.expiryDate = Date.now() + data.expires_in * 1000;
            }
            await account.save();
          }
        } catch (refreshErr) {
          console.warn("[EmailProvider] Token refresh failed:", refreshErr);
        }
      }
    }

    // Construct raw RFC 2822 email
    const emailLines = [
      `From: ${account.email}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/html; charset=utf-8`,
      `MIME-Version: 1.0`,
      "",
      body,
    ];
    const rawEmail = Buffer.from(emailLines.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    try {
      const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: rawEmail }),
      });

      if (!sendRes.ok) {
        const errText = await sendRes.text();
        return {
          success: false,
          errorCode: String(sendRes.status),
          errorMessage: errText || "Failed to send email via Google Gmail API",
        };
      }

      const resData: any = await sendRes.json();
      return {
        success: true,
        messageId: resData.id || "sent",
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: "NETWORK_ERROR",
        errorMessage: err?.message || "Failed to connect to Google Gmail API",
      };
    }
  }
}
