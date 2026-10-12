export interface TelegramSendResult {
  success: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export class TelegramProvider {
  private static getBotToken(): string {
    return process.env["TELEGRAM_BOT_TOKEN"] || "";
  }

  static isConfigured(): boolean {
    return Boolean(this.getBotToken());
  }

  /**
   * Sends a message via Telegram Bot API
   * @param chatId Telegram chat ID of recipient
   * @param message Message body text
   */
  static async sendMessage(chatId: string, message: string): Promise<TelegramSendResult> {
    const token = this.getBotToken();

    if (!token) {
      return {
        success: false,
        errorCode: "PROVIDER_NOT_CONFIGURED",
        errorMessage: "Telegram Bot token (TELEGRAM_BOT_TOKEN) not configured in environment.",
      };
    }

    if (!chatId || !chatId.trim()) {
      return {
        success: false,
        errorCode: "INVALID_CHAT_ID",
        errorMessage: "Recipient Telegram Chat ID is empty or invalid.",
      };
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: message,
          parse_mode: "HTML",
        }),
      });

      const data: any = await response.json();

      if (response.ok && data?.ok && data?.result?.message_id) {
        return {
          success: true,
          messageId: String(data.result.message_id),
        };
      }

      return {
        success: false,
        errorCode: String(data?.error_code || response.status),
        errorMessage: data?.description || "Failed to deliver message via Telegram Bot API",
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: "NETWORK_ERROR",
        errorMessage: err?.message || "Failed to connect to Telegram Bot API",
      };
    }
  }
}
