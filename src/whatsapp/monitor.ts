import { getAllStates } from "./state";
import { notifyWhatsAppNotReady } from "../services/notReadyAlert.service";

const notReadySinceByUserId = new Map<number, number>();
const alertSentByUserId = new Set<number>();

export const startWhatsAppMonitor = () => {
  const intervalMs = 30 * 1000;
  const thresholdMs = 5 * 60 * 1000;

  setInterval(() => {
    const now = Date.now();

    const allStates = getAllStates();
    for (const { userId, state } of allStates) {
      const status = state.status;

      if (status === "READY") {
        notReadySinceByUserId.delete(userId);
        alertSentByUserId.delete(userId);
        continue;
      }

      if (!notReadySinceByUserId.has(userId)) {
        notReadySinceByUserId.set(userId, now);
        continue;
      }

      const notReadySince = notReadySinceByUserId.get(userId)!;
      if (!alertSentByUserId.has(userId) && now - notReadySince >= thresholdMs) {
        alertSentByUserId.add(userId);
        notifyWhatsAppNotReady({ userId, status }).catch(() => {});
      }
    }
  }, intervalMs);
};
