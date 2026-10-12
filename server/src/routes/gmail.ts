import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { GmailAccount } from "../models/GmailAccount.js";
import { Case } from "../models/Case.js";
import { AuditLog } from "../models/AuditLog.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Expiring cryptographically random OAuth state registry: state -> { userId, expiresAt }
interface OAuthStateEntry {
  userId: string;
  expiresAt: number;
}
const oauthStateStore = new Map<string, OAuthStateEntry>();

function cleanExpiredOAuthStates() {
  const now = Date.now();
  for (const [key, entry] of oauthStateStore.entries()) {
    if (entry.expiresAt <= now) {
      oauthStateStore.delete(key);
    }
  }
}

const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] || "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] || "";
const GOOGLE_REDIRECT_URI =
  process.env["GOOGLE_REDIRECT_URI"] || "http://localhost:5173/settings/integrations/google/callback";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

/** Helper to refresh access token if expired */
async function getValidAccessToken(account: any): Promise<string | null> {
  if (!account) return null;
  const isExpired = account.expiryDate && Date.now() >= account.expiryDate - 60000;
  if (!isExpired) return account.accessToken;

  if (!account.refreshToken || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return account.accessToken; // fallback
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: account.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (res.ok) {
      const data: any = await res.json();
      account.accessToken = data.access_token;
      if (data.expires_in) {
        account.expiryDate = Date.now() + data.expires_in * 1000;
      }
      await account.save();
      return account.accessToken;
    }
  } catch (err) {
    console.error("[gmail] Failed to refresh access token:", err);
  }
  return account.accessToken;
}

/**
 * GET /api/gmail/status
 * Check connection status for current user
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const accounts = await GmailAccount.find({ userId: req.userId })
      .select("_id email syncStatus lastSyncedAt isDefault")
      .lean();

    const active = accounts.find((a) => a.isDefault) || accounts[0];
    if (!active || active.syncStatus === "disconnected") {
      res.json({ connected: false, configured: Boolean(GOOGLE_CLIENT_ID), accounts });
      return;
    }

    res.json({
      connected: true,
      configured: Boolean(GOOGLE_CLIENT_ID),
      email: active.email,
      syncStatus: active.syncStatus,
      lastSyncedAt: active.lastSyncedAt,
      accounts,
    });
  } catch (err) {
    console.error("[gmail] Status error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/gmail/accounts
 * List all connected Gmail accounts for current user
 */
router.get("/accounts", async (req: Request, res: Response) => {
  try {
    const accounts = await GmailAccount.find({ userId: req.userId })
      .select("_id email syncStatus lastSyncedAt isDefault createdAt")
      .lean();
    res.json({ accounts });
  } catch (err) {
    console.error("[gmail] List accounts error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * DELETE /api/gmail/accounts/:id
 * Disconnect a specific Gmail account
 */
router.delete("/accounts/:id", async (req: Request, res: Response) => {
  try {
    const account = await GmailAccount.findOneAndDelete({
      _id: req.params["id"],
      userId: req.userId,
    });
    if (!account) {
      res.status(404).json({ message: "Account not found" });
      return;
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "delete",
      resource: "integration",
      resourceName: "Gmail",
      details: `Disconnected Gmail account: ${account.email}`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ message: "Account disconnected successfully" });
  } catch (err) {
    console.error("[gmail] Disconnect account error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/gmail/auth-url
 * Generates Google OAuth 2.0 URL
 */
router.get("/auth-url", (req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(503).json({
      message: "Google OAuth credentials (GOOGLE_CLIENT_ID) are not configured.",
      configured: false,
    });
    return;
  }

  cleanExpiredOAuthStates();
  const oauthState = crypto.randomBytes(32).toString("hex");
  oauthStateStore.set(oauthState, {
    userId: req.userId!,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes validity
  });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: oauthState,
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ url, configured: true, state: oauthState });
});

/**
 * POST /api/gmail/oauth2callback
 * Exchange OAuth authorization code for tokens
 */
router.post("/oauth2callback", async (req: Request, res: Response) => {
  try {
    const { code, state, mockEmail } = req.body;

    // Handle mock authorization only in test environments
    if (process.env.NODE_ENV === "test" && mockEmail) {
      const email = mockEmail;
      const account = await GmailAccount.findOneAndUpdate(
        { userId: req.userId, email },
        {
          userId: req.userId,
          email,
          accessToken: "mock_test_token_" + Date.now(),
          refreshToken: "mock_test_refresh_" + Date.now(),
          expiryDate: Date.now() + 3600 * 1000,
          syncStatus: "connected",
          isDefault: true,
          lastSyncedAt: new Date(),
        },
        { upsert: true, new: true }
      );
      res.json({ success: true, email: account.email, connected: true });
      return;
    }

    // Validate and consume cryptographically random OAuth state
    cleanExpiredOAuthStates();
    if (process.env.NODE_ENV !== "test") {
      if (!state || typeof state !== "string") {
        res.status(400).json({ message: "Invalid or missing OAuth state parameter" });
        return;
      }
      const stateEntry = oauthStateStore.get(state);
      if (!stateEntry || stateEntry.userId !== req.userId || stateEntry.expiresAt <= Date.now()) {
        oauthStateStore.delete(state);
        res.status(400).json({ message: "Expired or invalid OAuth state parameter" });
        return;
      }
      // Consume state immediately to prevent replay
      oauthStateStore.delete(state);
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      res.status(503).json({
        message: "Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are not configured on this server. Real Gmail integration requires valid Google API credentials.",
        code: "GMAIL_NOT_CONFIGURED",
      });
      return;
    }

    if (!code) {
      res.status(400).json({ message: "Authorization code is required" });
      return;
    }

    // Exchange code with Google
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      res.status(400).json({ message: "Failed to exchange authorization code", details: errBody });
      return;
    }

    const tokenData: any = await tokenRes.json();

    // Fetch user profile to get connected email
    let email = req.user?.email || "unknown@gmail.com";
    try {
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userRes.ok) {
        const userData: any = await userRes.json();
        if (userData.email) email = userData.email;
      }
    } catch (e) {
      console.warn("[gmail] Failed to fetch google userinfo:", e);
    }

    const existingCount = await GmailAccount.countDocuments({ userId: req.userId });
    const isFirstAccount = existingCount === 0;

    const account = await GmailAccount.findOneAndUpdate(
      { userId: req.userId, email },
      {
        userId: req.userId,
        email,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || "",
        expiryDate: Date.now() + (tokenData.expires_in || 3600) * 1000,
        syncStatus: "connected",
        isDefault: isFirstAccount,
        lastSyncedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "integration",
      resourceName: "Gmail",
      details: `Connected Gmail account: ${email}`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ success: true, email: account.email, connected: true });
  } catch (err: any) {
    console.error("[gmail] OAuth callback error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * POST /api/gmail/disconnect
 * Disconnects Gmail account
 */
router.post("/disconnect", async (req: Request, res: Response) => {
  try {
    await GmailAccount.findOneAndDelete({ userId: req.userId });

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "integration",
      resourceName: "Gmail",
      details: "Disconnected Gmail account",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ success: true, connected: false });
  } catch (err) {
    console.error("[gmail] Disconnect error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/gmail/messages
 * Lists messages (supports search q, e.g. case number or client email)
 */
router.get("/messages", async (req: Request, res: Response) => {
  try {
    const account = await GmailAccount.findOne({ userId: req.userId });
    if (!account) {
      res.status(400).json({ message: "Gmail account not connected", connected: false });
      return;
    }

    const { q, maxResults = "20" } = req.query as Record<string, string>;
    const token = await getValidAccessToken(account);

    // In isolated automated test environment only, return test fixtures
    if (process.env.NODE_ENV === "test" && (!token || token.startsWith("mock_"))) {
      const demoMessages = [
        {
          id: "msg_1",
          threadId: "th_1",
          from: "registry@highcourt.gov.in",
          to: account.email,
          subject: "Notice: Hearing date listing for Suit No. 104/2026",
          snippet: "Please be informed that the matter has been listed for preliminary hearing before Court 4...",
          date: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
          unread: true,
          caseId: null,
        },
      ];
      res.json({
        messages: q ? demoMessages.filter((m) => m.subject.toLowerCase().includes(q.toLowerCase())) : demoMessages,
        connected: true,
      });
      return;
    }

    if (!token) {
      res.status(503).json({
        message: "Gmail integration is not configured with a valid OAuth token. Please reconnect your account.",
        code: "GMAIL_TOKEN_UNAVAILABLE",
      });
      return;
    }

    // Call live Gmail REST API
    const params = new URLSearchParams({
      maxResults: String(Math.min(50, parseInt(maxResults, 10) || 20)),
    });
    if (q) params.set("q", q);

    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!listRes.ok) {
      res.status(listRes.status).json({ message: "Failed to fetch Gmail messages" });
      return;
    }

    const listData: any = await listRes.json();
    const rawList = listData.messages || [];

    // Fetch message summaries (batch up to 15)
    const summaries = await Promise.all(
      rawList.slice(0, 15).map(async (item: any) => {
        try {
          const detailRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!detailRes.ok) return null;
          const detail: any = await detailRes.json();
          const headers = detail.payload?.headers || [];
          const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

          return {
            id: detail.id,
            threadId: detail.threadId,
            from: getHeader("From"),
            to: getHeader("To"),
            subject: getHeader("Subject") || "(No Subject)",
            date: getHeader("Date") ? new Date(getHeader("Date")).toISOString() : new Date().toISOString(),
            snippet: detail.snippet || "",
            unread: Array.isArray(detail.labelIds) && detail.labelIds.includes("UNREAD"),
          };
        } catch {
          return null;
        }
      })
    );

    res.json({ messages: summaries.filter(Boolean), connected: true });
  } catch (err: any) {
    console.error("[gmail] List messages error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * GET /api/gmail/messages/:id
 * Fetches full message details
 */
router.get("/messages/:id", async (req: Request, res: Response) => {
  try {
    const account = await GmailAccount.findOne({ userId: req.userId });
    if (!account) {
      res.status(400).json({ message: "Gmail account not connected" });
      return;
    }

    const token = await getValidAccessToken(account);

    if (!token || token.startsWith("mock_access_token_")) {
      if (process.env.NODE_ENV !== "test") {
        res.status(503).json({
          message: "Gmail OAuth token is unavailable. Please reconnect your account.",
          code: "GMAIL_TOKEN_UNAVAILABLE",
        });
        return;
      }

      res.json({
        id: req.params["id"],
        threadId: "th_1",
        from: "registry@highcourt.gov.in",
        to: account.email,
        subject: "Notice: Hearing date listing for Suit No. 104/2026",
        date: new Date().toISOString(),
        body: `<p>Respected Advocates,</p><p>Please find attached the official notice of appearance for Court Hall 4 scheduled on 14th of this month.</p><p>Regards,<br/>High Court Registry</p>`,
        snippet: "Please find attached the official notice of appearance...",
      });
      return;
    }

    const detailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${req.params["id"]}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!detailRes.ok) {
      res.status(detailRes.status).json({ message: "Failed to fetch message details" });
      return;
    }

    const detail: any = await detailRes.json();
    const headers = detail.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    // Parse body text/HTML from MIME payload
    let body = "";
    if (detail.payload?.body?.data) {
      body = Buffer.from(detail.payload.body.data, "base64").toString("utf-8");
    } else if (Array.isArray(detail.payload?.parts)) {
      const htmlPart = detail.payload.parts.find((p: any) => p.mimeType === "text/html");
      const textPart = detail.payload.parts.find((p: any) => p.mimeType === "text/plain");
      const target = htmlPart || textPart || detail.payload.parts[0];
      if (target?.body?.data) {
        body = Buffer.from(target.body.data, "base64").toString("utf-8");
      }
    }

    res.json({
      id: detail.id,
      threadId: detail.threadId,
      from: getHeader("From"),
      to: getHeader("To"),
      subject: getHeader("Subject") || "(No Subject)",
      date: getHeader("Date") ? new Date(getHeader("Date")).toISOString() : new Date().toISOString(),
      body: body || detail.snippet || "",
      snippet: detail.snippet || "",
    });
  } catch (err: any) {
    console.error("[gmail] Get message error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * POST /api/gmail/send
 * Sends an email (supports To, Subject, Body, and optional caseId association)
 */
router.post("/send", async (req: Request, res: Response) => {
  try {
    const { to, subject, body, inReplyTo, caseId } = req.body;
    if (!to || !subject || !body) {
      res.status(400).json({ message: "To, Subject, and Body are required" });
      return;
    }

    // Reject CR/LF characters in subject or reference headers to prevent header injection
    if (/[\r\n]/.test(subject)) {
      res.status(400).json({ message: "Invalid email subject: newline characters are not permitted" });
      return;
    }
    if (inReplyTo && /[\r\n]/.test(inReplyTo)) {
      res.status(400).json({ message: "Invalid inReplyTo header: newline characters are not permitted" });
      return;
    }

    // Basic email format check for recipients
    const recipientList = to.split(",").map((s: string) => s.trim()).filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const r of recipientList) {
      if (!emailRegex.test(r)) {
        res.status(400).json({ message: `Invalid recipient email address: "${r}"` });
        return;
      }
    }

    const account = await GmailAccount.findOne({ userId: req.userId });
    if (!account) {
      res.status(400).json({ message: "Gmail account not connected" });
      return;
    }

    const token = await getValidAccessToken(account);

    if (!token || token.startsWith("mock_access_token_")) {
      if (process.env.NODE_ENV !== "test") {
        res.status(503).json({
          message: "Live Gmail credentials or valid OAuth session unavailable. Cannot send email.",
          code: "GMAIL_TOKEN_UNAVAILABLE",
        });
        return;
      }

      // Mock send success (test environment only)
      if (caseId && mongoose.Types.ObjectId.isValid(caseId)) {
        await Case.findByIdAndUpdate(caseId, {
          $push: {
            timeline: {
              event: `Email sent to ${to}: "${subject}"`,
              by: req.user?.name ?? "User",
              when: new Date(),
            },
          },
        });
      }

      await AuditLog.create({
        userId: req.userId,
        userName: req.user?.name ?? "Unknown",
        action: "create",
        resource: "email",
        resourceName: subject,
        details: `Sent email to ${to}`,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ success: true, messageId: "msg_sent_" + Date.now() });
      return;
    }

    // Construct raw RFC 2822 email
    const emailLines = [
      `From: ${account.email}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/html; charset=utf-8`,
      `MIME-Version: 1.0`,
      ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`] : []),
      "",
      body,
    ];
    const rawEmail = Buffer.from(emailLines.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

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
      res.status(sendRes.status).json({ message: "Failed to send email via Gmail", details: errText });
      return;
    }

    const sendData: any = await sendRes.json();

    // If associated with a case, record timeline event
    if (caseId && mongoose.Types.ObjectId.isValid(caseId)) {
      await Case.findByIdAndUpdate(caseId, {
        $push: {
          timeline: {
            event: `Email sent to ${to}: "${subject}"`,
            by: req.user?.name ?? "User",
            when: new Date(),
          },
        },
      });
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "create",
      resource: "email",
      resourceName: subject,
      details: `Sent email to ${to} (ID: ${sendData.id})`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ success: true, messageId: sendData.id });
  } catch (err: any) {
    console.error("[gmail] Send error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * POST /api/gmail/messages/:id/associate
 * Associates an email message with a Case
 */
router.post("/messages/:id/associate", async (req: Request, res: Response) => {
  try {
    const { caseId, subject, from } = req.body;
    if (!caseId || !mongoose.Types.ObjectId.isValid(caseId)) {
      res.status(400).json({ message: "Valid caseId is required" });
      return;
    }

    const caseRecord = await Case.findById(caseId);
    if (!caseRecord) {
      res.status(404).json({ message: "Case not found" });
      return;
    }

    caseRecord.timeline.push({
      event: `Email associated: "${subject || "Email"}" from ${from || "Sender"}`,
      by: req.user?.name ?? "Unknown",
      when: new Date(),
    });

    await caseRecord.save();

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "case",
      resourceId: caseRecord._id.toString(),
      resourceName: caseRecord.title,
      details: `Associated email ${req.params["id"]} with case`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ success: true, message: "Email associated with case successfully" });
  } catch (err: any) {
    console.error("[gmail] Associate error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

export default router;
