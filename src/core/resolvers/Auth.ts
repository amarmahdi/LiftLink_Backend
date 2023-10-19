import {
  Resolver,
  Mutation,
  Arg,
  Ctx,
  Query,
  ObjectType,
  Field,
} from "type-graphql";
import { User } from "../entity/User";
import { MyContext } from "../helpers/MyContext";
import { UserInput } from "../inputs/UserInput";
import { AccountType } from "../types/AccountTypes";
import bcrypt, { compare } from "bcrypt";
import { sign } from "jsonwebtoken";
import { Token, TokenType } from "../entity/Tokens";
import { Response } from "express";
import dotenv from "dotenv";
import { getRepository } from "typeorm";
dotenv.config();

@ObjectType()
class UserLoginResponse {
  @Field()
  token!: string;

  @Field(() => User)
  user!: User;
}

@Resolver()
export class UserResolver {
  @Mutation((returns) => User)
  async register(
    @Arg("input")
    {
      username,
      password,
      firstName,
      lastName,
      email,
      phoneNumber,
      accountType,
    }: UserInput,
    @Ctx() ctx: MyContext
  ) {
    let accType;
    if (!username) throw new Error("Username is required");
    if (!password) throw new Error("Password is required");
    if (!firstName) throw new Error("First name is required");
    if (!lastName) throw new Error("Last name is required");
    if (!email) throw new Error("Email is required");
    if (!phoneNumber) throw new Error("Phone number is required");
    if (!accountType) throw new Error("Account type is required");
    if (
      accountType !== AccountType.ADMIN &&
      accountType !== AccountType.MANAGER &&
      accountType !== AccountType.DRIVER &&
      accountType !== AccountType.CUSTOMER
    )
      throw new Error("Invalid account type");
    switch (accountType) {
      case AccountType.ADMIN.valueOf():
        accType = AccountType.ADMIN;
        break;
      case AccountType.MANAGER.valueOf():
        accType = AccountType.MANAGER;
        break;
      case AccountType.DRIVER.valueOf():
        accType = AccountType.DRIVER;
        break;
      case AccountType.CUSTOMER.valueOf():
        accType = AccountType.CUSTOMER;
        break;
      default:
        accType = AccountType.ADMIN;
        break;
    }
    const existingUser = await User.findOne({
      where: [{ username }, { email }, { phoneNumber }],
    });
    if (existingUser) {
      if (existingUser.username === username) {
        throw new Error("Username already exists");
      }
      if (existingUser.email === email) {
        throw new Error("Email already exists");
      }
      if (existingUser.phoneNumber === phoneNumber) {
        throw new Error("Phone number already exists");
      }
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    try {
      const user = await User.create({
        username: username,
        password: hashedPassword,
        firstName: firstName,
        lastName: lastName,
        email: email,
        phoneNumber: phoneNumber,
        accountType: accType,
        dateJoined: new Date(),
        lastLogin: new Date(),
        isActive: true,
        isSuperuser: accountType === AccountType.ADMIN ? true : false,
        isStaff:
          accountType === AccountType.ADMIN ||
          accountType === AccountType.MANAGER
            ? true
            : false,
        isDealership: accountType === AccountType.ADMIN ? true : false,
        createdAt: new Date(),
      }).save();
      return user;
    } catch (error) {
      throw new Error(error + "  err: Failed to create user");
    }
  }

  @Mutation((returns) => UserLoginResponse)
  async login(
    @Arg("username") username: string,
    @Arg("password") password: string,
    @Ctx() ctx: MyContext
  ) {
    const isAdmin = username.includes("admin@");
    // const filteredUsername = delershipFromUsername[0] === "@" ? delershipFromUsername[1] : username;
    try {
      let delershipFromUsername: any;
      let filteredUsername = isAdmin ? username.split("@")[0] : username;
      if (isAdmin) {
        delershipFromUsername = username.split("@")[1];
      }
      const user = await getRepository(User)
        .createQueryBuilder("user")
        .leftJoinAndSelect("user.tokens", "tokens")
        .leftJoinAndSelect("user.dealerships", "dealerships")
        .where("user.username = :username", { username: filteredUsername })
        .getOne();

      if (!user) {
        throw new Error("Invalid login");
      }

      const valid = await compare(password, user.password);
      if (!valid) {
        throw new Error("Invalid login");
      }

      const accessToken = sign(
        { userId: user.userId, username: user.username },
        process.env.ACCESS_TOKEN_SECRET!,
        { expiresIn: "30d" }
      );

      const refreshToken = sign(
        { userId: user.userId, username: user.username },
        process.env.REFRESH_TOKEN_SECRET!,
        { expiresIn: "1y" }
      );

      const token = await getRepository(Token)
        .createQueryBuilder("token")
        .where("token.user = :userId", { userId: user.userId })
        .andWhere("token.type = :type", { type: TokenType.REFRESH })
        .andWhere("token.expiresAt > :now", { now: new Date() })
        .orderBy("token.expiresAt", "ASC")
        .getOne();

      if (!token) {
        const newToken = await Token.create({
          user: user,
          token: refreshToken,
          type: TokenType.REFRESH,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }).save();

        user.tokens = [...user.tokens, newToken];
        await user.save();
      } else {
        token.token = refreshToken;
        token.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await token.save();
      }

      if (isAdmin) {
        const dealership = user.dealerships.filter((dealership: any) => {
          console.log(dealership.dealershipId, delershipFromUsername);
          return dealership.dealershipName === delershipFromUsername;
        });
        user.dealerships = dealership;
      }

      const response = new UserLoginResponse();
      response.token = accessToken.toString();
      response.user = user;

      ctx.payload = { userId: user.userId, username: user.username };
      ctx.user = user;
      ctx.token = accessToken;

      return response;
    } catch (error) {
      throw new Error("Failed to login " + error);
    }
  }

  // change password
  // @Mutation((returns) => Boolean)
  // async changePassword(
  //   @Arg("oldPassword") oldPassword: string,
  //   @Arg("newPassword") newPassword: string,
  //   @Ctx() ctx: MyContext
  // ) {
  //   try {
  //     const user = await User.findOne({
  //       where: { username: ctx.payload.username },
  //     });
  //     if (!user) throw new Error("User not found");

  //     const valid = await compare(oldPassword, user.password);
  //     if (!valid) throw new Error("Invalid password");

  //     const hashedPassword = await bcrypt.hash(newPassword, 12);
  //     user.password = hashedPassword;
  //     await user.save();
  //     return true;
  //   } catch (error) {
  //     throw new Error("Failed to change password");
  //   }
  // }
  // @Mutation((returns) => Boolean)
}
