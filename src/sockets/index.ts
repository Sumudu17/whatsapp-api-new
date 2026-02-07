import { Server as HttpServer } from "http";
import { RequestHandler } from "express";
import { Server } from "socket.io";
import { getState } from "../whatsapp/state";

let io: Server | null = null;

export const initSockets = (
  server: HttpServer,
  sessionMiddleware: RequestHandler
) => {
  io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    sessionMiddleware(socket.request as any, {} as any, next as any);
  });

  io.use((socket, next) => {
    const enforce = (process.env.API_AUTH_REQUIRED ?? "false").toLowerCase() === "true";
    if (!enforce) {
      return next();
    }
    const session: any = (socket.request as any).session;
    if (!session?.user) {
      return next(new Error("Unauthorized"));
    }
    return next();
  });

  io.on("connection", (socket) => {
    socket.emit("state_change", getState());
  });

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};
