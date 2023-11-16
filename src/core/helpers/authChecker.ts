/* eslint-disable @typescript-eslint/no-explicit-any */
import { AuthChecker, MiddlewareFn } from "type-graphql";
import { MyContext } from "./MyContext";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { getUser } from "../resolvers/UserInfo";
dotenv.config();

export const verifyAccessToken = (token: string) => {
  const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!);
  const { exp } = payload as any;
  if (Date.now() >= exp * 1000) {
    throw new Error("Token has expired");
  }
  if (!payload) throw "invalid token";
  return payload;
};

export const verifyRefreshToken = (token: string) => {
  const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET!);
  const { exp } = payload as any;
  if (Date.now() >= exp * 1000) {
    throw new Error("Token has expired");
  }
  if (!payload) throw "invalid token"
  return payload;
};

export const authChecker: AuthChecker<MyContext> = async ({ context }) => {
  const authorization = context.req.headers["authorization"];

  if (!authorization) {
    return false;
  }

  try {
    const accessToken = authorization.split(" ")[1];
    if (!accessToken) {
      throw new Error("Access token missing");
    }

    const payload = verifyAccessToken(accessToken);
    const user = await getUser({ userId: (<any>payload).userId });
    if (!user) {
      throw new Error("User not found");
    }

    context.payload = payload as any;
    context.user = user as any;
    context.token = accessToken as any;
    return true;
  } catch (err: any) {
    return false;
  }
};

export const isAuthSubscription: MiddlewareFn<MyContext> = async (
  { context: { payload } },
  next
) => {
  if (!payload) {
    throw new Error("Not authenticated");
  }

  try {
    const user = await getUser({ userId: (<any>payload).userId });

    if (!user) {
      throw new Error("User not found");
    }

    return next();
  } catch (error) {
    throw new Error("Not authenticated");
  }
};
