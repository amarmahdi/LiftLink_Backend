/* eslint-disable @typescript-eslint/no-explicit-any */
import { Resolver, Mutation, Arg, Ctx, ObjectType, Field, Authorized } from "type-graphql";
import { User } from "../entity/User";
import { MyContext } from "../helpers/MyContext";
import { UserInput } from "../inputs/UserInput";
import { AccountType } from "../types/AccountTypes";
import bcrypt, { compare } from "bcrypt";
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
    username = username.toLowerCase();
    email = email.toLowerCase();
    if (username.includes("@")) {
      throw new Error("Username cannot contain @");
    }
    let accType;
    if (!username) throw new Error("Username is required");
    // check if username is valid (no special characters)
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      throw new Error("Username must only contain letters and numbers");
    }
    // check if username is valid (at least 6 characters)
    if (username.length < 6) {
      throw new Error("Username must be at least 6 characters");
    }
    if (!email) throw new Error("Email is required");
    // check if email is valid
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please enter a valid email address");
    }
    if (!password) throw new Error("Password is required");
    // check if password is valid (at least 8 characters)
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    // check if password is valid (at least 1 number)
    if (!/\d/.test(password)) {
      throw new Error("Password must contain at least 1 number");
    }
    // check if password is valid (at least 1 uppercase letter)
    if (!/[A-Z]/.test(password)) {
      throw new Error("Password must contain at least 1 uppercase letter");
    }
    // check if password is valid (at least 1 lowercase letter)
    if (!/[a-z]/.test(password)) {
      throw new Error("Password must contain at least 1 lowercase letter");
    }
    // check if password is valid (at least 1 special character)
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new Error("Password must contain at least 1 special character");
    }
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

    let usernameExists: boolean = false;
    await getUser({ username })
      .then(() => {
        usernameExists = true;
        return true;
      })
      .catch(() => {
        usernameExists = false;
        return false;
      });
    if (usernameExists) {
      throw new Error("Username already exists");
    }
    let emailExists: boolean = false;
    await getUser({ email })
      .then(() => {
        emailExists = true;
        return true;
      })
      .catch(() => {
        emailExists = false;
        return false;
      });

    if (emailExists) {
      throw new Error("Email already exists");
    }
    const hashedPassword = await bcrypt.hash(password, 12);

    try {
      const user = await User.create({
        username: username,
        password: hashedPassword,
        email: email,
        phoneNumber: "+1000000000",
        accountType: accType,
        dateJoined: new Date(),
        lastLogin: new Date(),
        isActive: true,
        isVerified: false,
        isSuperuser: accountType === AccountType.ADMIN ? true : false,
        isStaff:
          accountType === AccountType.ADMIN ||
          accountType === AccountType.MANAGER
            ? true
            : false,
        isDealership: accountType === AccountType.ADMIN ? true : false,
        createdAt: new Date(),
      }).save();

      const { accessToken } = await this.generateTokens(user, true);

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
    @Arg("username", { nullable: true }) username: string,
    @Arg("email", { nullable: true }) email: string,
    @Arg("password") password: string,
    @Ctx() ctx: MyContext
  ) {
    if (username) username = username.toLowerCase();
    if (email) email = email.toLowerCase();
    let isCombinedUsername = false
    if (username && username.includes("@")) {
      isCombinedUsername = true
    }
    try {
      let delershipFromUsername: any;
      const filteredUsername = isCombinedUsername ? username.split("@")[0] : username;
      if (isCombinedUsername) {
        delershipFromUsername = username.split("@")[1];
      }

      const user = username
        ? await getUser({ username: filteredUsername })
        : await getUser({ email: email });
      if (!user) {
        throw new Error("Invalid login credentials");
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        throw new Error("Invalid login credentials");
      }

      const { accessToken, user: loggedInUser } = await this.generateTokens(
        user
      );

      if (isCombinedUsername) {
        const dealership = loggedInUser.dealerships.filter(
          (dealership: any) => {
            return dealership.dealershipName.toLowerCase() === delershipFromUsername;
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
  @Authorized()
  @Mutation(() => Boolean)
  async changePassword(
    @Arg("oldPassword") oldPassword: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      const user = await getUser({ userId: ctx.payload!.userId });
      if (!user) throw new Error("User not found");

      const valid = await bcrypt.compare(oldPassword, user.password);
      if (!valid) throw new Error("Please enter the correct old password");

      const matched = await compare(newPassword, user.password);
      if (matched) throw new Error("Please enter a new password");  

      // check if password is valid (at least 8 characters)
      if (newPassword.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      // check if password is valid (at least 1 number)
      if (!/\d/.test(newPassword)) {
        throw new Error("Password must contain at least 1 number");
      }
      // check if password is valid (at least 1 uppercase letter)
      if (!/[A-Z]/.test(newPassword)) {
        throw new Error("Password must contain at least 1 uppercase letter");
      }
      // check if password is valid (at least 1 lowercase letter)
      if (!/[a-z]/.test(newPassword)) {
        throw new Error("Password must contain at least 1 lowercase letter");
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      user.password = hashedPassword;
      await user.save();
      return true;
    } catch (error) {
      throw new Error(error.message);
    }
  }
  
  // change username
  @Authorized()
  @Mutation(() => Boolean)
  async changeUsername(
    @Arg("newUsername") newUsername: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      const user = await getUser({ userId: ctx.payload!.userId });
      if (!user) throw new Error("User not found");

      // check if username is valid (no special characters)
      if (!/^[a-zA-Z0-9]+$/.test(newUsername)) {
        throw new Error("Username must only contain letters and numbers");
      }

      let usernameExists: boolean = false;
      await getUser({ username: newUsername })
        .then(() => {
          usernameExists = true;
          return true;
        })
        .catch(() => {
          usernameExists = false;
          return false;
        });
      if (usernameExists) {
        throw new Error("Username already exists");
      }

      user.username = newUsername;
      await user.save();
      return true;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  // change email
  @Authorized()
  @Mutation(() => Boolean)
  async changeEmail(
    @Arg("newEmail") newEmail: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      const user = await getUser({ userId: ctx.payload!.userId });
      if (!user) throw new Error("User not found");

      // check if email is valid
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        throw new Error("Please enter a valid email address");
      }

      let emailExists: boolean = false;
      await getUser({ email: newEmail })
        .then(() => {
          emailExists = true;
          return true;
        })
        .catch(() => {
          emailExists = false;
          return false;
        });

      if (emailExists) {
        throw new Error("Email already exists");
      }

      user.email = newEmail;
      await user.save();
      return true;
    } catch (error) {
      throw new Error(error.message);
    }
  }
}
