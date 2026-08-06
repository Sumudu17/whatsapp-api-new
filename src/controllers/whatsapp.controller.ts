import { NextFunction, Request, Response } from "express";
import {
  getWhatsAppGroups,
  getWhatsAppConnection,
  getWhatsAppStatus,
  initializeWhatsApp,
  logoutWhatsApp,
  sendWhatsAppText,
  sendWhatsAppMessageByApiKey,
  sendWhatsAppPoll,
  sendWhatsAppPollByApiKey,
  fetchLatestChatMessagesByApiKey,
  getWhatsAppMessageStats,
  getWhatsAppMessageLogs,
} from "../services/whatsapp.service";
import { toWhatsAppId } from "../utils/format";
import { ApiError } from "../middlewares/error.middleware";
import { validateActiveKey } from "../services/apiKeys.service";

const getSessionUserId = (req: Request): number => {
  const sessionUser: any = (req as any).session?.user;
  if (!sessionUser?.userId) {
    throw new ApiError(401, "Unauthorized");
  }
  return sessionUser.userId as number;
};

export const initialize = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getSessionUserId(req);
    // Reconnect should reuse the existing LocalAuth session directory.
    // Only explicit logout/reset should clear the session.
    const current = getWhatsAppStatus(userId);
    const force = current.status === "DISCONNECTED";
    const state = await initializeWhatsApp(userId, force, false);
    res.json({ success: true, state });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getSessionUserId(req);
    const state = await logoutWhatsApp(userId);
    res.json({ success: true, state });
  } catch (err) {
    next(err);
  }
};

export const status = (req: Request, res: Response) => {
  const userId = getSessionUserId(req);
  res.json({ success: true, state: getWhatsAppStatus(userId) });
};

export const connection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getSessionUserId(req);
    const connection = await getWhatsAppConnection(userId);
    return res.json({ success: true, connection });
  } catch (err) {
    next(err);
  }
};

/**
 * Internal dashboard endpoint (session-auth) for status widgets and page load state.
 */
export const dashboardStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getSessionUserId(req);
    const connection = await getWhatsAppConnection(userId);
    return res.json({ success: true, connection });
  } catch (err) {
    next(err);
  }
};

export const messageStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getSessionUserId(req);
    const stats = await getWhatsAppMessageStats(userId);
    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
};

export const messageLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getSessionUserId(req);

    const pageRaw = Number(req.query.page);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const { logs, total } = await getWhatsAppMessageLogs(userId, { limit, offset });
    res.json({
      success: true,
      logs,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
};

export const groups = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getSessionUserId(_req);
    const list = await getWhatsAppGroups(userId);
    res.json({ success: true, groups: list });
  } catch (err) {
    next(err);
  }
};

export const send = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getSessionUserId(req);
    const { to, groupId, message } = req.body as {
      to?: string;
      groupId?: string;
      message: string;
    };

    const result = await sendWhatsAppText(
      userId,
      to ? toWhatsAppId(to) : undefined,
      groupId,
      message
    );

    res.json({
      success: true,
      messageId: result.messageId,
      raw: result.raw,
    });
  } catch (err) {
    next(err);
  }
};

export const sendPoll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getSessionUserId(req);
    const { to, groupId, question, options, allowMultipleAnswers } = req.body as {
      to?: string;
      groupId?: string;
      question: string;
      options: string[];
      allowMultipleAnswers: boolean;
    };

    const result = await sendWhatsAppPoll(
      userId,
      to ? toWhatsAppId(to) : undefined,
      groupId,
      question,
      options,
      allowMultipleAnswers
    );

    res.json({
      success: true,
      messageId: result.messageId,
      chatId: result.chatId,
      poll: {
        question,
        options,
        allowMultipleAnswers,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const sendByApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, apiKey, phoneNumber, groupId, message, mediaUrl, caption, sendMediaAsDocument } = req.body as {
      userId: number;
      apiKey: string;
      phoneNumber?: string;
      groupId?: string;
      message?: string;
      mediaUrl?: string;
      caption?: string;
      sendMediaAsDocument?: boolean;
    };

    // Validate API key for this user (status ACTIVE only).
    await validateActiveKey({ userId, apiKey });

    // Ensure runtime client exists for this user; do not clear session.
    // If the client is disconnected, force re-initialization.
    const current = getWhatsAppStatus(userId);
    const force = current.status === "DISCONNECTED";
    await initializeWhatsApp(userId, force, false);

    const state = getWhatsAppStatus(userId);
    if (state.status !== "READY") {
      throw new ApiError(503, "WhatsApp client is not ready", { state });
    }

    const result = await sendWhatsAppMessageByApiKey({
      userId,
      phoneNumber,
      groupId,
      message,
      mediaUrl,
      caption,
      sendMediaAsDocument,
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message:
        result.messageType === "media"
          ? "Media message sent successfully"
          : "Message sent successfully",
      data: {
        chatType: result.chatType,
        chatId: result.chatId,
        messageType: result.messageType,
        ...(result.messageType === "text"
          ? { message: result.message }
          : {
              mediaUrl: result.mediaUrl,
              caption: result.caption,
              sendMediaAsDocument: result.sendMediaAsDocument,
            }),
        messageId: result.messageId,
      },
      // Backward-compatible fields used by existing clients.
      messageId: result.messageId,
      raw: result.raw,
      clientStatus: state.status,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.message === "Invalid API key") {
        return res.status(401).json({
          success: false,
          statusCode: 401,
          clientStatus: "INVALID_API_KEY",
          message: "API key is not valid",
        });
      }
      if (err.statusCode === 503 && err.message === "WhatsApp client is not ready") {
        const status = getWhatsAppStatus((req.body as { userId: number }).userId);
        return res.status(503).json({
          success: false,
          statusCode: 503,
          clientStatus: status.status,
          message: "WhatsApp client is not ready",
        });
      }
      if (err.message === "Failed to load media from mediaUrl") {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: "Failed to download media from URL",
          details: err.details,
        });
      }
      if (err.message === "Invalid mediaUrl") {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: "Invalid mediaUrl",
        });
      }
      if (err.statusCode === 502 && err.message === "Failed to send message") {
        return res.status(502).json({
          success: false,
          statusCode: 502,
          clientStatus: "READY",
          message: "Failed to send WhatsApp message",
          details: err.details,
        });
      }
    }
    next(err);
  }
};

export const sendPollByApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, apiKey, phoneNumber, groupId, question, options, allowMultipleAnswers } =
      req.body as {
        userId: number;
        apiKey: string;
        phoneNumber?: string;
        groupId?: string;
        question: string;
        options: string[];
        allowMultipleAnswers: boolean;
      };

    // Validate API key for this user (status ACTIVE only).
    await validateActiveKey({ userId, apiKey });

    // Ensure runtime client exists for this user; do not clear session.
    // If the client is disconnected, force re-initialization.
    const current = getWhatsAppStatus(userId);
    const force = current.status === "DISCONNECTED";
    await initializeWhatsApp(userId, force, false);

    const state = getWhatsAppStatus(userId);
    if (state.status !== "READY") {
      throw new ApiError(503, "WhatsApp client is not ready", { state });
    }

    const result = await sendWhatsAppPollByApiKey({
      userId,
      phoneNumber,
      groupId,
      question,
      options,
      allowMultipleAnswers,
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Poll sent successfully",
      data: {
        chatType: result.chatType,
        chatId: result.chatId,
        question: result.question,
        options: result.options,
        allowMultipleAnswers: result.allowMultipleAnswers,
        messageId: result.messageId,
      },
      messageId: result.messageId,
      raw: result.raw,
      clientStatus: state.status,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.message === "Invalid API key") {
        return res.status(401).json({
          success: false,
          statusCode: 401,
          clientStatus: "INVALID_API_KEY",
          message: "API key is not valid",
        });
      }
      if (err.statusCode === 503 && err.message === "WhatsApp client is not ready") {
        const status = getWhatsAppStatus((req.body as { userId: number }).userId);
        return res.status(503).json({
          success: false,
          statusCode: 503,
          clientStatus: status.status,
          message: "WhatsApp client is not ready",
        });
      }
      if (err.statusCode === 502 && err.message === "Failed to send poll") {
        return res.status(502).json({
          success: false,
          statusCode: 502,
          clientStatus: "READY",
          message: "Failed to send WhatsApp poll",
          details: err.details,
        });
      }
    }
    next(err);
  }
};

const statusMessageByCode: Record<string, string> = {
  READY: "Client is ready",
  NOT_INITIALIZED: "Client is not initialized",
  INITIALIZING: "Client is initializing",
  QR_REQUIRED: "Client is waiting for QR scan",
  AUTHENTICATED: "Client is authenticated",
  DISCONNECTED: "Client is disconnected",
};

export const messagesByApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, apiKey, phoneNumber, groupId, limit } = req.body as {
      userId: number;
      apiKey: string;
      phoneNumber?: string;
      groupId?: string;
      limit: number;
    };

    await validateActiveKey({ userId, apiKey });

    const current = getWhatsAppStatus(userId);
    const force = current.status === "DISCONNECTED";
    await initializeWhatsApp(userId, force, false);

    const state = getWhatsAppStatus(userId);
    if (state.status !== "READY") {
      return res.status(503).json({
        success: false,
        statusCode: 503,
        clientStatus: state.status,
        message:
          statusMessageByCode[state.status] ?? "WhatsApp client is not ready",
      });
    }

    const result = await fetchLatestChatMessagesByApiKey({
      userId,
      phoneNumber,
      groupId,
      limit,
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Messages loaded successfully",
      chatType: result.chatType,
      chatId: result.chatId,
      requestedLimit: result.requestedLimit,
      loadedCount: result.loadedCount,
      messages: result.messages,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.message === "Invalid API key") {
        return res.status(401).json({
          success: false,
          statusCode: 401,
          clientStatus: "INVALID_API_KEY",
          message: "API key is not valid",
        });
      }
      if (err.message === "User not found") {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: err.message,
        });
      }
      if (err.message === "Email not verified") {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          message: "Email not verified",
        });
      }
      if (err.statusCode === 404 && err.message === "Chat not found") {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          clientStatus: "READY",
          message: "Chat not found",
        });
      }
      if (err.statusCode === 502) {
        return res.status(502).json({
          success: false,
          statusCode: 502,
          clientStatus: "READY",
          message: err.message,
        });
      }
    }
    return next(err);
  }
};

export const statusByApiKey = async (req: Request, res: Response) => {
  try {
    const { userId, apiKey } = req.body as { userId: number; apiKey: string };
    await validateActiveKey({ userId, apiKey });

    const state = getWhatsAppStatus(userId);
    const clientStatusCode = state.status;
    const message =
      statusMessageByCode[clientStatusCode] ?? "Client status is unavailable";

    return res.status(200).json({
      success: true,
      statusCode: 200,
      clientStatus: clientStatusCode,
      message,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Request failed";
    if (msg === "Invalid API key") {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        clientStatus: "INVALID_API_KEY",
        message: "API key is not valid",
      });
    }
    return res.status(500).json({
      success: false,
      statusCode: 500,
      clientStatus: "UNKNOWN",
      message: "Failed to check client status",
    });
  }
};
