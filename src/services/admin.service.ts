import { listAllAccountsWithWhatsApp } from "../db/admin.repo";
import { getAllStates } from "../whatsapp/state";
import { ApiError } from "../middlewares/error.middleware";
import { deleteUserById } from "../db/auth.repo";
import { destroyClient, clearWhatsAppSessionFromDisk } from "../whatsapp/client";

export type AdminAccountRow = {
  userId: number;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  clientId: string | null;
  /** Connected WhatsApp client phone (from client.info) */
  clientPhoneNumber: string | null;
  /** Last persisted status in DB */
  dbStatus: string | null;
  /** Current in-memory client state (authoritative while process runs) */
  liveStatus: string | null;
  liveLastError: string | null;
  lastConnectedAt: string | null;
  lastAuthenticatedAt: string | null;
  lastDisconnectedAt: string | null;
  lastDisconnectedReason: string | null;
  sessionUpdatedAt: string | null;
};

const iso = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);

export const getAdminAccountsOverview = async (): Promise<AdminAccountRow[]> => {
  const rows = await listAllAccountsWithWhatsApp();
  const liveByUserId = new Map(getAllStates().map(({ userId, state }) => [userId, state]));

  return rows.map((row) => {
    const mem = liveByUserId.get(row.user_id);
    return {
      userId: row.user_id,
      name: row.name,
      email: row.email,
      isActive: row.is_active,
      createdAt: new Date(row.created_at).toISOString(),
      clientId: row.client_id,
      clientPhoneNumber: mem?.clientInfo?.phoneNumber ?? null,
      dbStatus: row.db_status,
      liveStatus: mem?.status ?? null,
      liveLastError: mem?.lastError ?? null,
      lastConnectedAt: iso(row.last_connected_at),
      lastAuthenticatedAt: iso(row.last_authenticated_at),
      lastDisconnectedAt: iso(row.last_disconnected_at),
      lastDisconnectedReason: row.last_disconnected_reason,
      sessionUpdatedAt: iso(row.session_updated_at),
    };
  });
};

export const deleteUserPermanentlyAsAdmin = async (params: {
  actorUserId: number;
  targetUserId: number;
}) => {
  if (!Number.isFinite(params.targetUserId) || params.targetUserId <= 0) {
    throw new ApiError(400, "Invalid userId");
  }
  if (params.actorUserId === params.targetUserId) {
    throw new ApiError(400, "You cannot delete your own admin account");
  }

  // Best-effort: stop runtime client + clear LocalAuth session directory.
  try {
    await destroyClient(params.targetUserId, true);
  } catch (_) {}
  try {
    clearWhatsAppSessionFromDisk(params.targetUserId);
  } catch (_) {}

  const affected = await deleteUserById(params.targetUserId);
  if (!affected) {
    throw new ApiError(404, "User not found");
  }

  return { deletedUserId: params.targetUserId };
};
