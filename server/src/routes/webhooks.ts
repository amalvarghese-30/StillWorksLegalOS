import { Router, type Request, type Response } from "express";
import { WhatsAppProvider } from "../services/externalNotifications/whatsapp.js";
import { NotificationOutbox } from "../models/NotificationOutbox.js";

const router = Router();

/**
 * GET /api/webhooks/whatsapp
 * Meta Cloud API verification challenge
 */
router.get("/whatsapp", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expectedToken = process.env["WHATSAPP_WEBHOOK_VERIFY_TOKEN"];
  if (!expectedToken) {
    res.status(503).json({ message: "WhatsApp webhook verification is not configured on this server" });
    return;
  }

  if (mode === "subscribe" && token === expectedToken) {
    console.log("[webhooks] WhatsApp webhook verified successfully");
    res.status(200).send(challenge);
    return;
  }

  res.status(403).json({ message: "Verification failed: invalid mode or token" });
});

/**
 * POST /api/webhooks/whatsapp
 * Meta Cloud API delivery updates and inbound events
 */
router.post("/whatsapp", async (req: Request, res: Response) => {
  try {
    if (!process.env["WHATSAPP_APP_SECRET"]) {
      res.status(503).json({ message: "WhatsApp webhook is not configured on this server" });
      return;
    }

    const rawBody = JSON.stringify(req.body);
    const signature = req.headers["x-hub-signature-256"] as string | undefined;

    if (!WhatsAppProvider.verifyWebhookSignature(rawBody, signature)) {
      res.status(401).json({ message: "Invalid webhook signature" });
      return;
    }

    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (Array.isArray(value?.statuses)) {
      for (const st of value.statuses) {
        const providerId = st.id;
        const statusStr = st.status; // "delivered", "read", "failed", "sent"

        if (providerId) {
          const updateData: Record<string, any> = {};
          if (statusStr === "delivered") {
            updateData["status"] = "delivered";
            updateData["deliveredAt"] = new Date();
          } else if (statusStr === "read") {
            updateData["status"] = "read";
            updateData["readAt"] = new Date();
          } else if (statusStr === "failed") {
            updateData["status"] = "failed";
            updateData["lastErrorCode"] = st.errors?.[0]?.code || "DELIVERY_FAILED";
            updateData["lastErrorMessage"] = st.errors?.[0]?.title || "Message delivery failed";
          }

          if (Object.keys(updateData).length > 0) {
            await NotificationOutbox.findOneAndUpdate(
              { providerMessageId: providerId },
              { $set: updateData }
            );
          }
        }
      }
    }

    res.status(200).json({ status: "ok" });
  } catch (err: any) {
    console.error("[webhooks] WhatsApp webhook error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export const webhooksRouter = router;
export default router;
