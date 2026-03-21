import { NextFunction, Request, Response } from "express";
import {
  changeName,
  changePassword,
  getMe,
  loginUser,
  registerUser,
  logoutUser,
  resendRegisterActivationOtp,
  requestChangeEmailOtp,
  verifyChangeEmailOtp,
  verifyRegisterActivationOtp,
} from "../services/auth.service";

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body as {
      name: string;
      email: string;
      password: string;
    };

    await registerUser({ name, email, password });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

export const verifyEmailOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp } = req.body as { email: string; otp: string };
    await verifyRegisterActivationOtp({ email, otp });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

export const resendEmailOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body as { email: string };
    await resendRegisterActivationOtp({ email });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const auth = await loginUser({ email, password });
    (req as any).session.user = auth;
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

export const logout = (req: Request, res: Response) => {
  const session: any = (req as any).session;
  session?.destroy?.(() => {});
  return res.json({ success: true });
};

export const changeUserName = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionUser: any = (req as any).session.user;
    const { name } = req.body as { name: string };

    await changeName({ userId: sessionUser.userId, name });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

export const requestEmailChangeOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionUser: any = (req as any).session.user;
    const { newEmail } = req.body as { newEmail: string };
    await requestChangeEmailOtp({ userId: sessionUser.userId, newEmail });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

export const verifyEmailChangeOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionUser: any = (req as any).session.user;
    const { newEmail, otp } = req.body as { newEmail: string; otp: string };
    await verifyChangeEmailOtp({
      userId: sessionUser.userId,
      newEmail,
      otp,
    });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

export const changeUserPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionUser: any = (req as any).session.user;
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    await changePassword({
      userId: sessionUser.userId,
      currentPassword,
      newPassword,
    });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionUser: any = (req as any).session.user;
    const userId = sessionUser.userId as number;
    const data = await getMe(userId);
    return res.json({ success: true, user: data });
  } catch (err) {
    return next(err);
  }
};

