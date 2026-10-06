import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { GmailAccount } from "../models/GmailAccount.js";
import { Case } from "../models/Case.js";
import { AuditLog } from "../models/AuditLog.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

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
    const account = await GmailAccount.findOne({ userId: req.userId }).lean();
    if (!account || account.syncStatus === "disconnected") {
      res.json({ connected: false });
      return;
    }

    res.json({
      connected: true,
      email: account.email,
      syncStatus: account.syncStatus,
      lastSyncedAt: account.lastSyncedAt,
    });
  } catch (err) {
    console.error("[gmail] Status error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/gmail/auth-url
 * Generates Google OAuth 2.0 URL
 */
router.get("/auth-url", (req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID) {
    // Return mock auth url for development/demo when client ID not configured
    res.json({
      url: `/settings?mockGoogleAuth=true&userId=${req.userId}`,
      configured: false,
    });
    return;
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: req.userId || "",
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ url, configured: true });
});

/**
 * POST /api/gmail/oauth2callback
 * Exchange OAuth authorization code for tokens
 */
router.post("/oauth2callback", async (req: Request, res: Response) => {
  try {
    const { code, mockEmail } = req.body;

    // Handle mock authorization for environments without Google API credentials
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || mockEmail) {
      const email = mockEmail || req.user?.email || "advocate.chamber@gmail.com";
      const account = await GmailAccount.findOneAndUpdate(
        { userId: req.userId },
        {
          userId: req.userId,
          email,
          accessToken: "mock_access_token_" + Date.now(),
          refreshToken: "mock_refresh_token_" + Date.now(),
          expiryDate: Date.now() + 3600 * 1000,
          syncStatus: "connected",
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

    const account = await GmailAccount.findOneAndUpdate(
      { userId: req.userId },
      {
        userId: req.userId,
        email,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || "",
        expiryDate: Date.now() + (tokenData.expires_in || 3600) * 1000,
        syncStatus: "connected",
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

    // If mock token or live API unavailable, return structured mock messages
    if (!token || token.startsWith("mock_access_token_")) {
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
        {
          id: "msg_2",
          threadId: "th_2",
          from: "client.sharma@example.com",
          to: account.email,
          subject: "Draft Sale Deed - Revisions and Signature",
          snippet: "Dear Counsel, attached is the executed page of the sale deed. Kindly verify the witness seal...",
          date: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
          unread: false,
          caseId: null,
        },
        {
          id: "msg_3",
          threadId: "th_3",
          from: "opposing.counsel@lawfirm.in",
          to: account.email,
          subject: "Written Statement - Caveat Notice No. 89",
          snippet: "Enclosed please find our formal reply in terms of Order VIII Rule 1 CPC...",
          date: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
          unread: false,
          caseId: null,
        },
      ];

      res.json({
        messages: q
          ? demoMessages.filter(
              (m) =>
                m.subject.toLowerCase().includes(q.toLowerCase()) ||
                m.snippet.toLowerCase().includes(q.toLowerCase()) ||
                m.from.toLowerCase().includes(q.toLowerCase())
            )
          : demoMessages,
        connected: true,
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

    const account = await GmailAccount.findOne({ userId: req.userId });
    if (!account) {
      res.status(400).json({ message: "Gmail account not connected" });
      return;
    }

    const token = await getValidAccessToken(account);

    if (!token || token.startsWith("mock_access_token_")) {
      // Mock send success
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
