import {
  Resolver,
  Mutation,
  Arg,
  Ctx,
  Query,
  UseMiddleware,
  Authorized,
} from "type-graphql";
import { User } from "../entity/User";
import { MyContext } from "../helpers/MyContext";
import { searchUsers } from "../helpers/searchUsers";
import { verifyAccessToken } from "../helpers/authChecker";
import { getRepository } from "typeorm";

export async function getUser({
  userId,
  username,
  dealershipId,
  accountType,
  email,
}: {
  userId?: string | undefined;
  username?: string | undefined;
  dealershipId?: string;
  accountType?: string;
  email?: string;
}) {
  const userData = getRepository(User)
    .createQueryBuilder("user")
    .leftJoinAndSelect("user.profilePicture", "profilePicture")
    .leftJoinAndSelect("user.car", "car")
    .leftJoinAndSelect("car.carImage", "carImage")
    .leftJoinAndSelect("user.address", "address")
    .leftJoinAndSelect("user.dealerships", "dealerships")
    .leftJoinAndSelect("user.order", "order")
    .where(
      userId
        ? "user.userId = :userId"
        : email
        ? "user.email = :email"
        : "user.username = :username",
      {
        userId,
        username,
        email,
      }
    );

  if (dealershipId) {
    userData.andWhere("dealerships.dealershipId = :dealershipId", {
      dealershipId,
    });
  }

  if (accountType) {
    userData.andWhere("user.accountType = :accountType", { accountType });
  }

  const user = await userData.getOne();

  if (!user) {
    throw new Error("User not found");
  }

  user.profilePicture = user.profilePicture.filter((pic) => pic.isCurrent);

  return user;
}

@Resolver()
export class UserInfoResolver {
  @Query((returns) => User)
  @Authorized()
  async getUserInfo(@Ctx() ctx: MyContext) {
    try {
      const user = await getUser({ username: (<any>ctx.payload).username });
      return user;
    } catch (error) {
      console.error("Error getting user info:", error);
      throw new Error("Failed to get user info");
    }
  }

  @Query(() => User)
  @Authorized()
  async getUserInfoById(@Arg("userId") userId: string) {
    try {
      const user = await getUser({ userId });
      return user;
    } catch (error) {
      console.error("Error getting user info:", error);
      throw new Error("Failed to get user info");
    }
  }

  @Query(() => [User])
  async searchUsers(
    @Arg("searchTerm") searchTerm: string,
    @Arg("accountType") accountType: string
  ) {
    try {
      const users = await searchUsers(searchTerm, accountType);
      return users;
    } catch (err) {
      console.error(err);
      throw new Error("Failed to search users");
    }
  }

  @Query(() => Boolean)
  async isLoggedIn(@Ctx() ctx: MyContext) {
    try {
      const isValid = verifyAccessToken(
        ctx.req.headers.authorization!.split(" ")[1]
      );
      if (!isValid) return false;
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  @Mutation(() => Boolean)
  @Authorized()
  async updatePhoneNumber(
    @Arg("phoneNumber") phoneNumber: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      const user = await getUser({ userId: (<any>ctx.payload).userId });
      user.phoneNumber = phoneNumber;
      user.isVerified = true;
      await user.save();
      return true;
    } catch (err) {
      console.error(err);
      throw new Error("Failed to update phone number");
    }
  }

  @Mutation(() => Boolean)
  @Authorized()
  async updateName(
    @Arg("firstName") firstName: string,
    @Arg("lastName") lastName: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      const user = await getUser({ userId: (<any>ctx.payload).userId });
      user.firstName = firstName;
      user.lastName = lastName;
      await user.save();
      return true;
    } catch (err) {
      console.error(err);
      throw new Error("Failed to update name");
    }
  }
}
