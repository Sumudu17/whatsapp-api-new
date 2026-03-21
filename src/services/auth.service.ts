import bcrypt from "bcryptjs";
import { logger } from "../utils/logger";
import { sha256Hex, timingSafeEqualHex, generateNumericOtp } from "../utils/crypto";
import { ApiError } from "../middlewares/error.middleware";
import { sendEmail } from "./email.service";
import {
  createEmailOtp,
  createUser,
  createWhatsAppSessionRow,
  deleteUnusedEmailOtpLock,
  getLatestUnusedEmailOtp,
  getUserByEmail,
  getUserById,
  getUserPublicById,
  incrementEmailOtpFailedAttempts,
  invalidateUnusedEmailOtps,
  markEmailOtpUsed,
  setUserActive,
  setUserEmail,
  setUserName,
  setUserPasswordHash,
} from "../db/auth.repo";

const OTP_PURPOSE_REGISTER_ACTIVATION = "register_activation";
const OTP_PURPOSE_CHANGE_EMAIL = "change_email";

const getOtpPepper = () => {
  const pepper = process.env.OTP_PEPPER ?? "";
  if (!pepper) {
    logger.warn(
      "OTP_PEPPER is not set. Falling back to an insecure default (dev only)."
    );
    return "dev_otp_pepper";
  }
  return pepper;
};

const getOtpExpiresMinutes = () => {
  const raw = process.env.OTP_EXPIRES_MINUTES ?? "10";
  const n = Number(raw);
  return Number.isNaN(n) ? 10 : n;
};

const getOtpResendMinSeconds = () => {
  const raw = process.env.OTP_RESEND_MIN_SECONDS ?? "60";
  const n = Number(raw);
  return Number.isNaN(n) ? 60 : n;
};

const getOtpMaxInvalidAttempts = () => {
  const raw = process.env.OTP_MAX_INVALID_ATTEMPTS ?? "5";
  const n = Number(raw);
  return Number.isNaN(n) ? 5 : n;
};

export const registerUser = async (params: {
  name: string;
  email: string;
  password: string;
}) => {
  const existing = await getUserByEmail(params.email);
  if (existing) {
    throw new ApiError(409, "Email already in use");
  }

  const passwordHash = await bcrypt.hash(params.password, 12);
  const userId = await createUser({
    name: params.name,
    email: params.email,
    passwordHash,
  });

  // One system user = one WhatsApp session.
  await createWhatsAppSessionRow({
    userId,
    clientId: String(userId),
  });

  const otp = generateNumericOtp(6);
  const otpPepper = getOtpPepper();
  const otpHash = sha256Hex(`${otp}${otpPepper}`);
  const now = new Date();

  const expiresAt = new Date(now.getTime() + getOtpExpiresMinutes() * 60_000);

  await createEmailOtp({
    userId,
    email: params.email,
    purpose: OTP_PURPOSE_REGISTER_ACTIVATION,
    otpHash,
    expiresAt,
    lastSentAt: now,
  });

  await sendEmail(
    params.email,
    "Your WhatsApp Web verification code",
    `Your verification code is: ${otp}\n\nThis code expires in ${getOtpExpiresMinutes()} minutes.`
  );
};

export const resendRegisterActivationOtp = async (params: { email: string }) => {
  const user = await getUserByEmail(params.email);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  if (user.is_active) {
    throw new ApiError(409, "Account is already active");
  }

  const latest = await getLatestUnusedEmailOtp({
    userId: user.id,
    email: params.email,
    purpose: OTP_PURPOSE_REGISTER_ACTIVATION,
  });

  // Basic anti-spam: throttle resends to a minimum interval.
  if (latest?.last_sent_at) {
    const nextAllowed = new Date(
      new Date(latest.last_sent_at as any).getTime() + getOtpResendMinSeconds() * 1000
    );
    if (nowIsBefore(nextAllowed)) {
      throw new ApiError(429, "OTP resend is too frequent. Please try again later.");
    }
  }

  if (latest) {
    await deleteUnusedEmailOtpLock({ otpId: latest.id });
  }

  const otp = generateNumericOtp(6);
  const otpHash = sha256Hex(`${otp}${getOtpPepper()}`);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + getOtpExpiresMinutes() * 60_000);

  await createEmailOtp({
    userId: user.id,
    email: params.email,
    purpose: OTP_PURPOSE_REGISTER_ACTIVATION,
    otpHash,
    expiresAt,
    lastSentAt: now,
  });

  await sendEmail(
    params.email,
    "Your WhatsApp Web verification code",
    `Your new verification code is: ${otp}\n\nThis code expires in ${getOtpExpiresMinutes()} minutes.`
  );
};

const nowIsBefore = (date: Date) => {
  return Date.now() < date.getTime();
};

export const verifyRegisterActivationOtp = async (params: { email: string; otp: string }) => {
  const user = await getUserByEmail(params.email);
  if (!user) {
    throw new ApiError(400, "Invalid email or OTP");
  }
  if (user.is_active) {
    return;
  }

  const latest = await getLatestUnusedEmailOtp({
    userId: user.id,
    email: params.email,
    purpose: OTP_PURPOSE_REGISTER_ACTIVATION,
  });
  if (!latest) {
    throw new ApiError(400, "Invalid email or OTP");
  }

  if (latest.expires_at.getTime() < Date.now()) {
    throw new ApiError(400, "OTP has expired");
  }

  const presentedHash = sha256Hex(`${params.otp}${getOtpPepper()}`);
  const isValid = timingSafeEqualHex(presentedHash, latest.otp_hash);

  if (!isValid) {
    const nextFailedAttempts = latest.failed_attempts + 1;
    await incrementEmailOtpFailedAttempts({
      otpId: latest.id,
      failedAttempts: nextFailedAttempts,
    });
    if (nextFailedAttempts >= getOtpMaxInvalidAttempts()) {
      await deleteUnusedEmailOtpLock({ otpId: latest.id });
    }
    throw new ApiError(400, "Invalid email or OTP");
  }

  await markEmailOtpUsed(latest.id);
  await setUserActive(user.id);
};

export const loginUser = async (params: { email: string; password: string }) => {
  const user = await getUserByEmail(params.email);
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }
  const ok = await bcrypt.compare(params.password, user.password_hash);
  if (!ok) {
    throw new ApiError(401, "Invalid credentials");
  }
  if (!user.is_active) {
    throw new ApiError(403, "Email not verified yet");
  }
  return { userId: user.id, name: user.name, email: user.email };
};

export const logoutUser = async () => {
  // Session destruction is handled by the controller.
};

export const changeName = async (params: { userId: number; name: string }) => {
  await setUserName(params.userId, params.name);
};

export const requestChangeEmailOtp = async (params: {
  userId: number;
  newEmail: string;
}) => {
  const current = await getUserById(params.userId);
  if (!current) {
    throw new ApiError(404, "User not found");
  }

  const existing = await getUserByEmail(params.newEmail);
  if (existing && existing.id !== params.userId) {
    throw new ApiError(409, "Email already in use");
  }

  await invalidateUnusedEmailOtps({
    userId: params.userId,
    email: params.newEmail,
    purpose: OTP_PURPOSE_CHANGE_EMAIL,
  });

  const otp = generateNumericOtp(6);
  const otpHash = sha256Hex(`${otp}${getOtpPepper()}`);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + getOtpExpiresMinutes() * 60_000);

  await createEmailOtp({
    userId: params.userId,
    email: params.newEmail,
    purpose: OTP_PURPOSE_CHANGE_EMAIL,
    otpHash,
    expiresAt,
    lastSentAt: now,
  });

  await sendEmail(
    params.newEmail,
    "Your WhatsApp Web email change code",
    `Your verification code is: ${otp}\n\nThis code expires in ${getOtpExpiresMinutes()} minutes.`
  );
};

export const verifyChangeEmailOtp = async (params: {
  userId: number;
  newEmail: string;
  otp: string;
}) => {
  const latest = await getLatestUnusedEmailOtp({
    userId: params.userId,
    email: params.newEmail,
    purpose: OTP_PURPOSE_CHANGE_EMAIL,
  });
  if (!latest) {
    throw new ApiError(400, "Invalid OTP");
  }
  if (latest.expires_at.getTime() < Date.now()) {
    throw new ApiError(400, "OTP has expired");
  }

  const presentedHash = sha256Hex(`${params.otp}${getOtpPepper()}`);
  const isValid = timingSafeEqualHex(presentedHash, latest.otp_hash);
  if (!isValid) {
    throw new ApiError(400, "Invalid OTP");
  }

  await markEmailOtpUsed(latest.id);
  await setUserEmail(params.userId, params.newEmail);
};

export const changePassword = async (params: {
  userId: number;
  currentPassword: string;
  newPassword: string;
}) => {
  const user = await getUserById(params.userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const ok = await bcrypt.compare(params.currentPassword, user.password_hash);
  if (!ok) {
    throw new ApiError(400, "Current password is incorrect");
  }

  const newPasswordHash = await bcrypt.hash(params.newPassword, 12);
  await setUserPasswordHash(params.userId, newPasswordHash);
};

export const getMe = async (userId: number) => {
  const user = await getUserPublicById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  return user;
};

