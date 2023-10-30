import { Request, Response } from "express";

export interface MyContext {
  req: Request;
  res: Response;
  user?: any;
  accountType?: any;
  token?: any;
  connectionParams?: any;
  payload?: any;
}