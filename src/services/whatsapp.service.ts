import { ApiError } from "../middlewares/error.middleware";
import { logger } from "../utils/logger";
import { getClient, initializeClient, destroyClient } from "../whatsapp/client";
import { getState } from "../whatsapp/state";
import { toWhatsAppId } from "../utils/format";
import { getWhatsappSessionByUserId } from "../db/whatsapp.repo";
import { ensureWhatsappSessionRow } from "../db/whatsapp.repo";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MessageMedia } = require("../../index.js");

export const initializeWhatsApp = async (
  userId: number,
  force = false,
  clearSession = false
) => {
  try {
    await ensureWhatsappSessionRow({ userId, clientId: String(userId) });
    await initializeClient(userId, force, clearSession);
    return getState(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Initialization failed";
    if (message.includes("WHATSAPP_SESSION_IN_USE")) {
      throw new ApiError(
        409,
        "WhatsApp session is in use. Stop other WhatsApp client and try again."
      );
    }
    if (message.includes("browser is already running")) {
      throw new ApiError(
        409,
        "WhatsApp browser already running. Stop other instance and try again."
      );
    }
    throw err;
  }
};

export const logoutWhatsApp = async (userId: number) => {
  await destroyClient(userId, true);
  return getState(userId);
};

export const getWhatsAppStatus = (userId: number) => {
  return getState(userId);
};

export const getWhatsAppConnection = async (userId: number) => {
  const state = getState(userId);
  const session = await getWhatsappSessionByUserId(userId);
  return {
    ...state,
    lastConnectedAt: session?.last_connected_at ?? null,
    lastAuthenticatedAt: session?.last_authenticated_at ?? null,
    lastDisconnectedAt: session?.last_disconnected_at ?? null,
    lastDisconnectedReason: session?.last_disconnected_reason ?? null,
  };
};

export const getWhatsAppGroups = async (userId: number) => {
  const state = getState(userId);
  if (state.status !== "READY") {
    throw new ApiError(503, "WhatsApp client is not ready");
  }

  const client = getClient(userId);

  // Read groups directly from the WhatsApp Web internal store instead of
  // client.getChats(): full chat serialization is fragile across WhatsApp Web
  // updates, while id/name/participant count are stable model properties.
  const result = await client.pupPage.evaluate(() => {
    const w = window as any;
    const chats = w.Store.Chat.getModelsArray();
    const groups = chats
      .filter((c: any) => c?.id?.server === "g.us")
      .map((c: any) => {
        let participants = 0;
        try {
          const p = c.groupMetadata?.participants;
          participants = p?.getModelsArray?.()?.length ?? p?.length ?? 0;
        } catch {
          participants = 0;
        }
        return {
          id: c.id._serialized,
          name: c.formattedTitle || c.name || c.groupMetadata?.subject || "Unnamed Group",
          participants,
        };
      });
    return { totalChats: chats.length, groups };
  });

  logger.info(
    { userId, totalChats: result.totalChats, groupCount: result.groups.length },
    "Fetched WhatsApp groups"
  );

  return result.groups.map((g: any) => ({
    id: g.id,
    groupId: g.id,
    name: g.name,
    participants: g.participants,
  }));
};

const formatMessageDateTime = (unixSeconds: number): string => {
  const d = new Date(unixSeconds * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}:${p(d.getSeconds())}`;
};

/**
 * Map whatsapp-web.js Message to API DTO (no media download).
 * Resolves sender id (including @lid), pushname, and phone/user id via getContact when possible.
 */
export const mapWhatsAppMessageToDtoAsync = async (
  msg: any,
  meWid: string | null,
  chatId: string,
  myPushname: string | null,
  myPhoneNumber: string | null
): Promise<Record<string, unknown>> => {
  const idStr = msg.id?._serialized ?? "";
  const fromStr =
    typeof msg.from === "string" ? msg.from : msg.from?._serialized != null ? msg.from._serialized : "";
  const toRaw = typeof msg.to === "string" ? msg.to : msg.to?._serialized != null ? msg.to._serialized : "";
  const toOut = meWid && toRaw === meWid ? "me" : toRaw || "me";

  const authorFromMsg =
    typeof msg.author === "string" && msg.author.length > 0 ? msg.author : null;

  // For group chats, `author` is the sender. For direct chats, `from` is the sender.
  // For outgoing messages (`fromMe=true`), sender is your own WA identity (meWid).
  const senderId =
    authorFromMsg ?? (msg.fromMe ? meWid : fromStr || null);

  let senderPushname: string | null = null;
  let senderNumber: string | null = null;

  // Resolve contact info as best-effort.
  // For outgoing messages, we already know pushname/number from clientInfo.
  if (!msg.fromMe) {
    try {
      const contact = await msg.getContact();
      if (contact) {
        senderPushname = contact.pushname ?? contact.name ?? null;
        senderNumber = contact.number != null ? String(contact.number) : null;
      }
    } catch {
      /* contact resolution is best-effort */
    }
  } else {
    senderPushname = myPushname;
    senderNumber = myPhoneNumber;
  }

  const ts = typeof msg.timestamp === "number" ? msg.timestamp : 0;

  const base: Record<string, unknown> = {
    recordNo: undefined,
    messageId: idStr,
    chatId,
    body: msg.body ?? "",
    type: msg.type ?? "unknown",
    timestamp: ts,
    dateTime: formatMessageDateTime(ts),
    fromMe: Boolean(msg.fromMe),
    hasMedia: Boolean(msg.hasMedia),
    ack: typeof msg.ack === "number" ? msg.ack : Number(msg.ack ?? 0),
    deviceType: msg.deviceType ?? "unknown",
    isForwarded: Boolean(msg.isForwarded),
    forwardingScore: typeof msg.forwardingScore === "number" ? msg.forwardingScore : 0,
    isStatus: Boolean(msg.isStatus),
    sender: {
      id: senderId,
      pushname: senderPushname,
      number: senderNumber,
    },
  };

  if (msg.hasMedia) {
    const raw = msg._data || {};
    if (raw.mimetype) base.mimetype = raw.mimetype;
    if (raw.filename) base.filename = raw.filename;
    base.mediaType = msg.type;
  }

  // Remove placeholder key (we set recordNo at the outer layer).
  delete base.recordNo;
  return base;
};

export const fetchLatestChatMessagesByApiKey = async (params: {
  userId: number;
  phoneNumber?: string;
  groupId?: string;
  limit: number;
}): Promise<{
  chatId: string;
  chatType: "direct" | "group";
  requestedLimit: number;
  loadedCount: number;
  messages: Record<string, unknown>[];
}> => {
  const state = getWhatsAppStatus(params.userId);
  if (state.status !== "READY") {
    throw new ApiError(503, "WhatsApp client is not ready", { clientStatus: state.status });
  }

  let client: ReturnType<typeof getClient>;
  try {
    client = getClient(params.userId);
  } catch {
    throw new ApiError(503, "WhatsApp client is not ready", { clientStatus: "NOT_INITIALIZED" });
  }
  const resolvedChatId = params.groupId ?? toWhatsAppId(params.phoneNumber!);

  let chat: any;
  try {
    chat = await client.getChatById(resolvedChatId);
  } catch {
    throw new ApiError(502, "Failed to load chat");
  }
  if (!chat) {
    throw new ApiError(404, "Chat not found");
  }

  let rawMessages: any[];
  try {
    rawMessages = await chat.fetchMessages({ limit: params.limit });
  } catch {
    throw new ApiError(502, "Failed to fetch messages");
  }

  const ordered = [...rawMessages].reverse();
  const meWid = state.clientInfo?.widSerialized ?? null;
  const myPushname = state.clientInfo?.pushname ?? null;
  const myPhoneNumber = state.clientInfo?.phoneNumber ?? null;
  const chatType: "direct" | "group" = chat.isGroup ? "group" : "direct";
  const chatId = chat.id?._serialized ?? resolvedChatId;

  const messages = await Promise.all(
    ordered.map(async (m, idx) => {
      const dto = await mapWhatsAppMessageToDtoAsync(m, meWid, chatId, myPushname, myPhoneNumber);
      // `recordNo` is the first field for ordering in the JSON output.
      return { recordNo: idx + 1, ...dto };
    })
  );

  return {
    chatId,
    chatType,
    requestedLimit: params.limit,
    loadedCount: ordered.length,
    messages,
  };
};

export const sendWhatsAppText = async (
  userId: number,
  to: string | undefined,
  groupId: string | undefined,
  message: string
) => {
  const state = getState(userId);
  if (state.status !== "READY") {
    throw new ApiError(503, "WhatsApp client is not ready");
  }

  const client = getClient(userId);

  if ((to && groupId) || (!to && !groupId)) {
    throw new ApiError(400, "Either to or groupId is required (not both)");
  }

  const destination = to ?? groupId;
  if (!destination) {
    throw new ApiError(400, "Destination is required");
  }

  const result = await client.sendMessage(destination, message);
  return {
    messageId: result?.id?._serialized ?? result?.id ?? null,
    raw: result,
  };
};

export const sendWhatsAppMessageByApiKey = async (params: {
  userId: number;
  phoneNumber?: string;
  groupId?: string;
  message?: string;
  mediaUrl?: string;
  caption?: string;
  sendMediaAsDocument?: boolean;
}) => {
  const state = getState(params.userId);
  if (state.status !== "READY") {
    throw new ApiError(503, "WhatsApp client is not ready");
  }

  let client: ReturnType<typeof getClient>;
  try {
    client = getClient(params.userId);
  } catch {
    throw new ApiError(503, "WhatsApp client is not ready");
  }

  if ((params.phoneNumber && params.groupId) || (!params.phoneNumber && !params.groupId)) {
    throw new ApiError(400, "Either phoneNumber or groupId is required (not both)");
  }

  const chatId = params.groupId ?? toWhatsAppId(params.phoneNumber!);
  const chatType: "direct" | "group" = params.groupId ? "group" : "direct";

  if (!params.mediaUrl) {
    if (!params.message?.trim()) {
      throw new ApiError(400, "message is required when mediaUrl is not provided");
    }
    let sentMessage: any;
    try {
      sentMessage = await client.sendMessage(chatId, params.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send message";
      throw new ApiError(502, "Failed to send message", { message });
    }
    return {
      chatType,
      chatId,
      messageType: "text" as const,
      message: params.message,
      sendMediaAsDocument: false,
      caption: "",
      mediaUrl: null,
      messageId: sentMessage?.id?._serialized ?? sentMessage?.id ?? null,
      raw: sentMessage,
    };
  }

  let media: any;
  try {
    media = await MessageMedia.fromUrl(params.mediaUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to download media";
    throw new ApiError(400, "Failed to load media from mediaUrl", { mediaUrl: params.mediaUrl, message });
  }

  if (!media) {
    throw new ApiError(400, "Invalid mediaUrl");
  }

  const sendMediaAsDocument = Boolean(params.sendMediaAsDocument);
  const finalCaption = params.caption ?? params.message ?? "";
  let sentMessage: any;
  try {
    sentMessage = await client.sendMessage(chatId, media, {
      caption: finalCaption,
      sendMediaAsDocument,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send message";
    throw new ApiError(502, "Failed to send message", { message });
  }

  return {
    chatType,
    chatId,
    messageType: "media" as const,
    message: params.message ?? "",
    caption: finalCaption,
    mediaUrl: params.mediaUrl,
    sendMediaAsDocument,
    messageId: sentMessage?.id?._serialized ?? sentMessage?.id ?? null,
    raw: sentMessage,
  };
};
