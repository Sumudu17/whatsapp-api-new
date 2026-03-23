import QRCode from "qrcode";
import { getIo } from "../sockets";
import { logger } from "../utils/logger";
import { getState, setLastError, setQrDataUrl, setStatus } from "./state";
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
    setStatus(userId, "READY");
    updateWhatsappSessionStatus(userId, {
      status: "READY",
      lastConnectedAt: new Date(),
    }).catch(() => {});
    safeEmitToUser(userId, "ready");
    safeEmitToUser(userId, "state_change", getState(userId));
    logger.info("WhatsApp ready");
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
    safeEmitToUser(userId, "state_change", {
      ...getState(userId),
      clientState: state,
    });
  });
};
