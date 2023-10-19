import { sign, verify } from "jsonwebtoken"

export default (username: string) => {
  const expDate = 60 * 60 * 24 * 1000;
  return sign({ username }, "secret", {
    expiresIn: expDate,
  })
}
