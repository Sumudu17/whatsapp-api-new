import { ApiError } from "../middlewares/error.middleware";
import { getClient, initializeClient, destroyClient } from "../whatsapp/client";
import { getState } from "../whatsapp/state";

export const initializeWhatsApp = async (force = false, clearSession = false) => {
  try {
    await initializeClient(force, clearSession);
    return getState();
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

export const logoutWhatsApp = async () => {
  await destroyClient(true);
  return getState();
};

export const getWhatsAppStatus = () => {
  return getState();
};

export const getWhatsAppGroups = async () => {
  const state = getState();
  if (state.status !== "READY") {
    throw new ApiError(503, "WhatsApp client is not ready");
  }

  const client = getClient();
  const chats = await client.getChats();
  return chats
    .filter((chat: any) => chat.isGroup)
    .map((chat: any) => ({
      id: chat.id?._serialized ?? chat.id,
      name: chat.name ?? chat.formattedTitle ?? "Unnamed Group",
      participants: chat.participants?.length ?? 0,
    }));
};

export const sendWhatsAppText = async (
  to: string | undefined,
  groupId: string | undefined,
  message: string
) => {
  const state = getState();
  if (state.status !== "READY") {
    throw new ApiError(503, "WhatsApp client is not ready");
  }

  const client = getClient();

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
