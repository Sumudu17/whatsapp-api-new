export type WhatsAppStatus =
  | "NOT_INITIALIZED"
  | "INITIALIZING"
  | "QR_REQUIRED"
  | "AUTHENTICATED"
  | "READY"
  | "DISCONNECTED";

type WhatsAppState = {
  status: WhatsAppStatus;
  qrDataUrl: string | null;
  lastError?: string;
};

const state: WhatsAppState = {
  status: "NOT_INITIALIZED",
  qrDataUrl: null,
};

export const getState = (): WhatsAppState => ({ ...state });

export const setStatus = (status: WhatsAppStatus) => {
  state.status = status;
  if (status !== "QR_REQUIRED") {
    state.qrDataUrl = null;
  }
};

export const setQrDataUrl = (dataUrl: string) => {
  state.qrDataUrl = dataUrl;
  state.status = "QR_REQUIRED";
};

export const setLastError = (message?: string) => {
  state.lastError = message;
};
