import QRCode from "qrcode";
import { getIo } from "../sockets";
import { logger } from "../utils/logger";
import { getState, setClientInfo, setClientState, setLastError, setQrDataUrl, setStatus } from "./state";
import { updateWhatsappSessionStatus } from "../db/whatsapp.repo";
import { notifyWhatsAppDisconnect } from "../services/notification.service";

const safeEmitToUser = (userId: number, event: string, payload?: unknown) => {
  try {
    const io = getIo();
    io.to(`user:${userId}`).emit(event, payload);
  } catch {
    // Socket not initialized yet.
  }
};

export const attachClientEvents = (userId: number, client: any) => {
  client.on("qr", async (qr: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(qr);
      setQrDataUrl(userId, dataUrl);
      updateWhatsappSessionStatus(userId, { status: "QR_REQUIRED" }).catch(() => {});
      safeEmitToUser(userId, "qr", { qr: dataUrl });
      safeEmitToUser(userId, "state_change", getState(userId));
      logger.info("QR updated");
    } catch (err) {
      logger.error({ err }, "Failed to generate QR code");
    }
  });

  client.on("authenticated", () => {
    setStatus(userId, "AUTHENTICATED");
    updateWhatsappSessionStatus(userId, {
      status: "AUTHENTICATED",
      lastAuthenticatedAt: new Date(),
    }).catch(() => {});
    safeEmitToUser(userId, "authenticated");
    safeEmitToUser(userId, "state_change", getState(userId));
    logger.info("WhatsApp authenticated");
  });

  client.on("ready", () => {
    let pushname: string | null = null;
    let widSerialized: string | null = null;
    let phoneNumber: string | null = null;
    try {
      const info = client.info;
      pushname = info?.pushname ?? null;
      widSerialized = info?.wid?._serialized ?? null;
      phoneNumber = info?.wid?.user ?? null;
    } catch {
      // ignore malformed info
    }

    setStatus(userId, "READY");
    setClientInfo(userId, { pushname, widSerialized, phoneNumber });

    logger.info(
      { userId, pushname, widSerialized, phoneNumber },
      "WhatsApp client ready"
    );
    console.log(`[WhatsApp userId=${userId}] Client is ready`);
    console.log(`[WhatsApp userId=${userId}] Push name:`, pushname);
    console.log(`[WhatsApp userId=${userId}] WID:`, widSerialized);
    console.log(`[WhatsApp userId=${userId}] Phone number:`, phoneNumber);

    updateWhatsappSessionStatus(userId, {
      status: "READY",
      lastConnectedAt: new Date(),
    }).catch(() => {});
    safeEmitToUser(userId, "ready");
    safeEmitToUser(userId, "state_change", getState(userId));
  });

  client.on("auth_failure", (msg: string) => {
    setLastError(userId, msg);
    setStatus(userId, "DISCONNECTED");
    updateWhatsappSessionStatus(userId, {
      status: "DISCONNECTED",
      lastDisconnectedAt: new Date(),
      lastDisconnectedReason: msg,
    }).catch(() => {});
    notifyWhatsAppDisconnect({
      userId,
      eventType: "whatsapp_auth_failure",
      reason: msg,
    }).catch(() => {});
    safeEmitToUser(userId, "disconnected", { reason: msg });
    safeEmitToUser(userId, "state_change", getState(userId));
    logger.warn({ msg }, "WhatsApp auth failure");
  });

  client.on("disconnected", (reason: string) => {
    setLastError(userId, reason);
    setStatus(userId, "DISCONNECTED");
    updateWhatsappSessionStatus(userId, {
      status: "DISCONNECTED",
      lastDisconnectedAt: new Date(),
      lastDisconnectedReason: reason,
    }).catch(() => {});
    notifyWhatsAppDisconnect({
      userId,
      eventType: "whatsapp_disconnected",
      reason,
    }).catch(() => {});
    safeEmitToUser(userId, "disconnected", { reason });
    safeEmitToUser(userId, "state_change", getState(userId));
    logger.warn({ reason }, "WhatsApp disconnected");
  });

  client.on("change_state", (state: string) => {
    setClientState(userId, state);
    safeEmitToUser(userId, "state_change", getState(userId));
  });
};
