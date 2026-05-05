import type { Request as ExpressRequest } from "express";

export type RequestWithUserId = ExpressRequest & {
  user?: {
    id: string;
  };
};

export type RequestWithUserRole = ExpressRequest & {
  user?: {
    id: string;
    role?: "user" | "moderator" | "admin";
  };
};
