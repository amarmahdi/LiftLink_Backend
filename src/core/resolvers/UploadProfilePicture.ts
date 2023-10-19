import {
  Resolver,
  Query,
  Arg,
  Mutation,
  Ctx,
  UseMiddleware,
  Authorized,
} from "type-graphql";
import { MyContext } from "../helpers/MyContext";
import { ProfilePicture } from "../entity/ProfilePicture";
import { User } from "../entity/User";

@Resolver()
export class UploadProfilePicture {
  @Query(() => ProfilePicture)
  async getProfilePicture(
    @Arg("userId") userId: string,
    @Ctx() ctx: MyContext
  ) {
    const user = await User.findOne({ where: { userId: userId } });
    if (!user) throw new Error("User not found");
    const profilePicture = await ProfilePicture.findOne({
      where: {
        user: {
          userId,
        },
      },
    });
    if (!profilePicture) throw new Error("Profile picture not found");
    return profilePicture;
  }

  @Mutation(() => ProfilePicture)
  @Authorized()
  async uploadProfilePicture(
    @Arg("pictureLink") pictureLink: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      const user = await User.findOne({
        where: { username: (<any>ctx.payload).username },
      });
      // console.log("user: ", user)
      if (!user) throw new Error("User not found");
      const profilePicture = await ProfilePicture.find({
        relations: ["user"],
        where: {
          user: {
            userId: user.userId,
          },
          isCurrent: true,
        },
      });
      profilePicture.forEach(async (pic) => {
        await ProfilePicture.update(
          { pictureId: pic.pictureId },
          { isCurrent: false }
        );
      });
      const newProfilePicture = await ProfilePicture.create({
        pictureLink: pictureLink,
        user: user,
        isCurrent: true,
      }).save();
      return newProfilePicture;
    } catch (err: any) {
      throw new Error(err);
    }
  }
}
