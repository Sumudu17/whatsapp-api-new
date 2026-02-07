import { NextFunction, Request, Response } from "express";
import { ApiError } from "../middlewares/error.middleware";

export const login = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body as {
      username: string;
      password: string;
    };

    const expectedUser = process.env.APP_USERNAME;
    const expectedPass = process.env.APP_PASSWORD;
    if (!expectedUser || !expectedPass) {
      throw new ApiError(500, "Server configuration error: APP credentials missing");
    }

    if (username !== expectedUser || password !== expectedPass) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    (req as any).session.user = { username };
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

