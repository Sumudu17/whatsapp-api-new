import QRCode from "qrcode";
import { getIo } from "../sockets";
import { logger } from "../utils/logger";
import { getState, setLastError, setQrDataUrl, setStatus } from "./state";

const safeEmit = (event: string, payload?: unknown) => {
  try {
    const io = getIo();
    io.emit(event, payload);
  } catch {
    // Socket not initialized yet.
  }
};

export const attachClientEvents = (client: any) => {
  client.on("qr", async (qr: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(qr);
      setQrDataUrl(dataUrl);
      safeEmit("qr", { qr: dataUrl });
      safeEmit("state_change", getState());
      logger.info("QR updated");
    } catch (err) {
      logger.error({ err }, "Failed to generate QR code");
    }
  });

  client.on("authenticated", () => {
    setStatus("AUTHENTICATED");
    safeEmit("authenticated");
    safeEmit("state_change", getState());
    logger.info("WhatsApp authenticated");
  });

  client.on("ready", () => {
    setStatus("READY");
    safeEmit("ready");
    safeEmit("state_change", getState());
    logger.info("WhatsApp ready");
  });

  client.on("auth_failure", (msg: string) => {
    setLastError(msg);
    setStatus("DISCONNECTED");
    safeEmit("disconnected", { reason: msg });
    safeEmit("state_change", getState());
    logger.warn({ msg }, "WhatsApp auth failure");
  });

  client.on("disconnected", (reason: string) => {
    setLastError(reason);
    setStatus("DISCONNECTED");
    safeEmit("disconnected", { reason });
    safeEmit("state_change", getState());
    logger.warn({ reason }, "WhatsApp disconnected");
  });

  client.on("change_state", (state: string) => {
    safeEmit("state_change", { ...getState(), clientState: state });
  });
};
