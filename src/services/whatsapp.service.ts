import { ApiError } from "../middlewares/error.middleware";
import { getClient, initializeClient, destroyClient } from "../whatsapp/client";
import { getState } from "../whatsapp/state";
import { getWhatsappSessionByUserId } from "../db/whatsapp.repo";
import { ensureWhatsappSessionRow } from "../db/whatsapp.repo";

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
  const chats = await client.getChats();
  return chats
    .filter((chat: any) => chat.isGroup)
    .map((chat: any) => ({
      id: chat.id?._serialized ?? chat.id,
      groupId: chat.id?._serialized ?? chat.id,
      name: chat.name ?? chat.formattedTitle ?? "Unnamed Group",
      participants: chat.participants?.length ?? 0,
    }));
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
