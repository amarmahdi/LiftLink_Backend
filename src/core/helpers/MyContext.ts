import { Request, Response } from "express";

export interface MyContext {
  req: Request;
  res: Response;
  user?: any;
  token?: any;
  connectionParams?: any;
  payload?: any;
}