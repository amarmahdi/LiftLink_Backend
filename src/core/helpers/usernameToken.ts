import { verify } from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export default async function (token: any) {
  try {
    const tk = token.split(" ")[1];
    const payload = verify(tk, process.env.ACCESS_TOKEN_SECRET!);
    return payload;
  } catch (error) {
    throw new Error("Error verifying token " + error);
  }
}