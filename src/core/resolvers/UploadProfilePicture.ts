/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Resolver,
  Query,
  Arg,
  Mutation,
  Ctx,
  Authorized,
} from "type-graphql";
import { MyContext } from "../helpers/MyContext";
import { ProfilePicture } from "../entity/ProfilePicture";
import { User } from "../entity/User";
import { getRepository } from "typeorm";

@Resolver()
export class UploadProfilePicture {
  @Query(() => ProfilePicture)
  async getProfilePicture(
    @Arg("userId") userId: string
  ) {
    try {
      const user = await getRepository(User)
        .createQueryBuilder("user")
        .where("user.userId = :userId", { userId: userId })
        .getOne();

      if (!user) {
        throw new Error("User not found");
      }

      const profilePicture = await getRepository(ProfilePicture)
        .createQueryBuilder("profilePicture")
        .leftJoinAndSelect("profilePicture.user", "user")
        .where("user.userId = :userId", { userId: userId })
        .getOne();

      if (!profilePicture) {
        throw new Error("Profile picture not found");
      }

      return profilePicture;
    } catch (error) {
      console.error("Error getting profile picture:", error);
      throw new Error("Failed to get profile picture");
    }
  }

  @Mutation(() => ProfilePicture)
  @Authorized()
  async uploadProfilePicture(
    @Arg("pictureLink") pictureLink: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      const user = await getRepository(User)
        .createQueryBuilder("user")
        .where("user.username = :username", { username: ctx.payload.username })
        .getOne();

      if (!user) {
        throw new Error("User not found");
      }

      const profilePicture = await getRepository(ProfilePicture)
        .createQueryBuilder("profilePicture")
        .leftJoinAndSelect("profilePicture.user", "user")
        .where("user.userId = :userId", { userId: user.userId })
        .andWhere("profilePicture.isCurrent = :isCurrent", { isCurrent: true })
        .getMany();

      await Promise.all(
        profilePicture.map((pic: any) =>
          getRepository(ProfilePicture)
            .createQueryBuilder()
            .update(ProfilePicture)
            .set({ isCurrent: false })
            .where("pictureId = :pictureId", { pictureId: pic.pictureId })
            .execute()
        )
      );

      const newProfilePicture = await ProfilePicture.create({
        pictureLink: pictureLink,
        user: user,
        isCurrent: true,
      }).save();

      return newProfilePicture;
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      throw new Error("Failed to upload profile picture");
    }
  }
}
