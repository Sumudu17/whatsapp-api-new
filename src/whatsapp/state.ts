export type WhatsAppStatus =
  | "NOT_INITIALIZED"
  | "INITIALIZING"
  | "QR_REQUIRED"
  | "AUTHENTICATED"
  | "READY"
  | "DISCONNECTED";

export type ClientInfo = {
  pushname: string | null;
  widSerialized: string | null;
  phoneNumber: string | null;
};

export type WhatsAppState = {
  status: WhatsAppStatus;
  qrDataUrl: string | null;
  lastError?: string;
  /** Set when status is READY (from client.info) */
  clientInfo?: ClientInfo;
  /** Last value seen from the client's "change_state" event */
  clientState?: string;
};

const stateByUserId = new Map<number, WhatsAppState>();

const getOrCreateState = (userId: number): WhatsAppState => {
  const existing = stateByUserId.get(userId);
  if (existing) {
    return existing;
  }

  const created: WhatsAppState = {
    status: "NOT_INITIALIZED",
    qrDataUrl: null,
  };
  stateByUserId.set(userId, created);
  return created;
};

export const getState = (userId: number): WhatsAppState => {
  const state = getOrCreateState(userId);
  return { ...state };
};

export const setStatus = (userId: number, status: WhatsAppStatus) => {
  const state = getOrCreateState(userId);
  state.status = status;
  if (status !== "QR_REQUIRED") {
    state.qrDataUrl = null;
  }
  if (status !== "READY") {
    state.clientInfo = undefined;
  }
  if (status !== "DISCONNECTED") {
    state.lastError = undefined;
  }
};

export const setClientState = (userId: number, clientState: string) => {
  const state = getOrCreateState(userId);
  state.clientState = clientState;
};

export const setClientInfo = (userId: number, info: ClientInfo) => {
  const state = getOrCreateState(userId);
  state.clientInfo = { ...info };
};

export const setQrDataUrl = (userId: number, dataUrl: string) => {
  const state = getOrCreateState(userId);
  state.qrDataUrl = dataUrl;
  state.status = "QR_REQUIRED";
};

export const setLastError = (userId: number, message?: string) => {
  const state = getOrCreateState(userId);
  state.lastError = message;
};

export const getAllStates = (): Array<{ userId: number; state: WhatsAppState }> => {
  return Array.from(stateByUserId.entries()).map(([userId, s]) => ({
    userId,
    state: { ...s },
  }));
};
