import { AuthChecker, MiddlewareFn } from "type-graphql";
import { MyContext } from "./MyContext";
import { verify } from "jsonwebtoken";
import { User } from "../entity/User";
import dotenv from "dotenv";
dotenv.config();

export const verifyAccessToken = (token: string) => {
  try {
    const payload = verify(token, process.env.ACCESS_TOKEN_SECRET!);
    const { exp } = payload as any;
    if (Date.now() >= exp * 1000) {
      throw new Error("Token has expired");
    }
    return payload;
  } catch (err) {
    throw err;
  }
};

export const verifyRefreshToken = (token: string) => {
  try {
    const payload = verify(token, process.env.REFRESH_TOKEN_SECRET!);
    const { exp } = payload as any;
    if (Date.now() >= exp * 1000) {
      throw new Error("Token has expired");
    }
    return payload;
  } catch (err) {
    throw err;
  }
};

export const authChecker: AuthChecker<MyContext> = async (
  { context },
  roles
) => {
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
    const user = await User.findOne({
      where: { userId: (payload as any).userId },
    });

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
    const user = await User.findOne({
      where: { userId: payload.userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return next();
  } catch (error) {
    throw new Error("Not authenticated");
  }
};
