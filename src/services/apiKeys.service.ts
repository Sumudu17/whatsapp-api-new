import crypto from "crypto";
import { ApiError } from "../middlewares/error.middleware";
import { sha256Hex } from "../utils/crypto";
import {
  createApiKeyRow,
  findActiveApiKeyForUser,
  listApiKeysByUserId,
  revokeApiKeyRow,
  deleteApiKeyRow,
} from "../db/apiKeys.repo";
import { getUserPublicById } from "../db/auth.repo";

export const listKeys = async (userId: number) => {
  return listApiKeysByUserId(userId);
};

export const createKey = async (userId: number, name: string) => {
  // Opaque raw key returned once; never stored raw.
  const rawKey = crypto.randomBytes(32).toString("base64url");
  const apiKeyHash = sha256Hex(rawKey);
  const keyPrefix = rawKey.slice(0, 10);

  const id = await createApiKeyRow({
    userId,
    name,
    apiKeyHash,
    keyPrefix,
  });

  return { id, rawKey, keyPrefix };
};

export const validateActiveKey = async (params: {
  userId: number;
  apiKey: string;
}) => {
  const apiKeyHash = sha256Hex(params.apiKey);
  const keyRow = await findActiveApiKeyForUser({
    userId: params.userId,
    apiKeyHash,
  });
  if (!keyRow) {
    throw new ApiError(403, "Invalid API key");
  }

  const user = await getUserPublicById(params.userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  if (!user.is_active) {
    throw new ApiError(403, "Email not verified");
  }

  return keyRow;
};

export const revokeKey = async (userId: number, apiKeyId: number) => {
  const affected = await revokeApiKeyRow({ userId, apiKeyId });
  if (!affected) {
    throw new ApiError(404, "API key not found");
  }
};

export const deleteKey = async (userId: number, apiKeyId: number) => {
  const affected = await deleteApiKeyRow({ userId, apiKeyId });
  if (!affected) {
    throw new ApiError(404, "API key not found");
  }
};

