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

@Resolver()
export class UserInfoResolver {
  @Query((returns) => User)
  @Authorized()
  async getUserInfo(@Ctx() ctx: MyContext) {
    try {
      const user = await User.findOne({
        relations: ["profilePicture", "car", "address", "dealerships"],
        where: {
          username: (<any>ctx.payload).username,
        },
      });
      if (!user) throw new Error("User not found");
      user.profilePicture = user.profilePicture.filter((pic) => pic.isCurrent);
      return user;
    } catch (err: any) {
      console.error(err);
      throw new Error("Failed to get user info " + err);
    }
  }

  @Query(() => User)
  @Authorized()
  async getUserInfoById(@Arg("userId") userId: string) {
    try {
      const user = await User.findOne({
        relations: ["profilePicture", "car", "address", "dealerships"],
        where: {
          userId,
        },
      });
      if (!user) throw new Error("User not found");
      user.profilePicture = user.profilePicture.filter((pic) => pic.isCurrent);
      return user;
    } catch (err: any) {
      console.error(err);
      throw new Error("Failed to get user info by id " + err);
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
}
