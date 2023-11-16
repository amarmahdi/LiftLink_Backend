import { Resolver, Mutation, Arg, Ctx, ObjectType, Field } from "type-graphql";
import { User } from "../entity/User";
import { MyContext } from "../helpers/MyContext";
import { UserInput } from "../inputs/UserInput";
import { AccountType } from "../types/AccountTypes";
import bcrypt from "bcrypt";
import { sign } from "jsonwebtoken";
import { Token, TokenType } from "../entity/Tokens";
import dotenv from "dotenv";
import { getRepository } from "typeorm";
import { getUser } from "./UserInfo";
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
  @Mutation(() => UserLoginResponse)
  async register(
    @Arg("input")
    { username, password, email, accountType }: UserInput,
    @Ctx() ctx: MyContext
  ) {
    let accType;
    if (!username) throw new Error("Username is required");
    if (!password) throw new Error("Password is required");
    if (!email) throw new Error("Email is required");
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

    const existingUser = await getUser({ username, email })
      .then((user) => {
        return user;
      })
      .catch(() => {});
    if (existingUser) {
      if (existingUser.username === username) {
        throw new Error("Username already exists");
      }
      if (existingUser.email === email) {
        throw new Error("Email already exists");
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    try {
      const user = await User.create({
        username: username,
        password: hashedPassword,
        email: email,
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

      const { accessToken } = await this.generateTokens(
        user,
        true
      );

      ctx.payload = {
        userId: user.userId,
        username: user.username,
      };
      ctx.user = user;
      ctx.token = accessToken;

      const response = new UserLoginResponse();
      response.token = accessToken;
      response.user = user;

      return response;
    } catch (error) {
      throw new Error(error + "  err: Failed to create user");
    }
  }

  @Mutation(() => UserLoginResponse)
  async login(
    @Arg("username") username: string,
    @Arg("password") password: string,
    @Ctx() ctx: MyContext
  ) {
    const isAdmin = username.includes("admin@");
    try {
      let delershipFromUsername: any;
      let filteredUsername = isAdmin ? username.split("@")[0] : username;
      if (isAdmin) {
        delershipFromUsername = username.split("@")[1];
      }

      const user = await getUser({ username: filteredUsername });
      if (!user) {
        throw new Error("Invalid login credentials");
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        throw new Error("Invalid login credentials");
      }

      const {
        accessToken,
        user: loggedInUser,
      } = await this.generateTokens(user);

      if (isAdmin) {
        const dealership = loggedInUser.dealerships.filter(
          (dealership: any) => {
            console.log(dealership.dealershipId, delershipFromUsername);
            return dealership.dealershipName === delershipFromUsername;
          }
        );
        loggedInUser.dealerships = dealership;
      }

      const response = new UserLoginResponse();
      response.token = accessToken;
      response.user = loggedInUser;

      ctx.payload = {
        userId: loggedInUser.userId,
        username: loggedInUser.username,
      };
      ctx.user = loggedInUser;
      ctx.token = accessToken;

      return response;
    } catch (error) {
      throw new Error(error + "  err: Failed to login user");
    }
  }

  async generateTokens(user: User, register: boolean = false) {
    try {
      const accessToken = sign(
        {
          userId: user.userId,
          username: user.username,
          accountType: user.accountType,
        },
        process.env.ACCESS_TOKEN_SECRET!,
        { expiresIn: "30d" }
      );

      const refreshToken = sign(
        {
          userId: user.userId,
          username: user.username,
          accountType: user.accountType,
        },
        process.env.REFRESH_TOKEN_SECRET!,
        { expiresIn: "1y" }
      );
      let token;
      if (!register) {
        token = await getRepository(Token)
          .createQueryBuilder("token")
          .where("token.user = :userId", { userId: user.userId })
          .andWhere("token.type = :type", { type: TokenType.REFRESH })
          .andWhere("token.expiresAt > :now", { now: new Date() })
          .orderBy("token.expiresAt", "ASC")
          .getOne();
      }

      if (!token) {
        const newToken = await Token.create({
          user: user,
          token: refreshToken,
          type: TokenType.REFRESH,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }).save();

        if (user.tokens) user.tokens = [...user.tokens, newToken];
        else user.tokens = [newToken];
        await user.save();
      } else {
        token.token = refreshToken;
        token.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await token.save();
      }

      return {
        accessToken: accessToken.toString(),
        refreshToken: refreshToken.toString(),
        user: user,
      };
    } catch (error) {
      console.error("Error generating tokens:", error);
      throw new Error("Failed to generate tokens");
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
