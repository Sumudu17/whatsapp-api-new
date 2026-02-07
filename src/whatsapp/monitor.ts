import { getState } from "./state";
import { sendAlertEmail } from "../services/email.service";

let notReadySince: number | null = null;
let alertSent = false;

export const startWhatsAppMonitor = () => {
  const intervalMs = 30 * 1000;
  const thresholdMs = 5 * 60 * 1000;

  setInterval(async () => {
    const status = getState().status;
    const now = Date.now();

    if (status === "READY") {
      notReadySince = null;
      alertSent = false;
      return;
    }

    if (!notReadySince) {
      notReadySince = now;
      return;
    }

    if (!alertSent && now - notReadySince >= thresholdMs) {
      alertSent = true;
      try {
        await sendAlertEmail(
          "WhatsApp client not ready",
          `WhatsApp client has been ${status} for more than 5 minutes.`
        );
      } catch {
        // error already logged by email service
      }
    }
  }, intervalMs);
};
