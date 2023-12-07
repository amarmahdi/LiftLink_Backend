import {
  Resolver,
  // Query,
  Mutation,
  Arg,
  Ctx,
  Authorized,
} from "type-graphql";
import { License } from "../entity/License";
import { MyContext } from "../helpers/MyContext";
import { getUser } from "./UserInfo";

export async function getLicense({
  licenseId,
  userId,
}: {
  licenseId?: string | undefined;
  userId?: string | undefined;
}) {
  const licenseData = License.createQueryBuilder("license")
    .where(
      licenseId ? "license.licenseId = :licenseId" : "license.userId = :userId",
      {
        licenseId,
        userId,
      }
    );

  try {
    const license = await licenseData.getOne();
    return license;
  } catch (err) {
    console.log(err);
    return err;
  }
}

@Resolver(() => License)
export class LicenseResolver {
  // @Authorized()
  // @Query(() => License, { nullable: true })
  // async license(
  //   @Arg("licenseId", { nullable: true }) licenseId: string,
  //   @Arg("userId", { nullable: true }) userId: string
  // ) {
  //   try {
  //     const license = await getLicense({ licenseId, userId });
  //     return license;
  //   } catch (error) {
  //     console.error(error);
  //     throw new Error("Failed to fetch license: " + error.message);
  //   }
  // }

  @Mutation(() => License)
  @Authorized()
  async createLicense(
    @Arg("licenseNumber") licenseNumber: string,
    @Arg("licenseState") licenseState: string,
    @Arg("licenseExpiration") licenseExpiration: string,
    @Arg("licenseImageFront") licenseImageFront: string,
    @Arg("licenseImageBack") licenseImageBack: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      const userId = ctx.payload.userId;
      let licenseFound = false;
      await getLicense({ userId }).then((license) => {
        if (license) {
          licenseFound = true;
        }
      });
      if (licenseFound) {
        throw new Error("User already has a license");
      }
      const license = await License.create({
        licenseNumber,
        licenseState,
        licenseExpiration,
        licenseImageFront,
        licenseImageBack,
        userId: userId,
      }).save();

      const user = await getUser({ userId });
      user.isVerified = true;
      await user.save();

      return license;
    } catch (error) {
      console.error(error);
      throw new Error("Failed to create license: " + error.message);
    }
  }

  // @Mutation(() => License)
  // @Authorized()
  // async updateLicense(
  //   @Arg("licenseId") licenseId: string,
  //   @Arg("licenseNumber", { nullable: true }) licenseNumber: string,
  //   @Arg("licenseState", { nullable: true }) licenseState: string,
  //   @Arg("licenseExpiration", { nullable: true }) licenseExpiration: Date,
  //   @Arg("licenseImageFront", { nullable: true }) licenseImageFront: string,
  //   @Arg("licenseImageBack", { nullable: true }) licenseImageBack: string,
  //   @Arg("verified", { nullable: true }) verified: boolean
  // ) {
  //   try {
  //     const license = await getLicense({ licenseId });

  //     if (licenseNumber) {
  //       license.licenseNumber = licenseNumber;
  //     }

  //     if (licenseState) {
  //       license.licenseState = licenseState;
  //     }

  //     if (licenseExpiration) {
  //       license.licenseExpiration = licenseExpiration;
  //     }

  //     if (licenseImageFront) {
  //       license.licenseImageFront = licenseImageFront;
  //     }

  //     if (licenseImageBack) {
  //       license.licenseImageBack = licenseImageBack;
  //     }

  //     if (verified) {
  //       license.verified = verified;
  //       if (verified) {
  //         license.user.isVerified = true;
  //       }
  //     }

  //     await license.save();

  //     return license;
  //   } catch (error) {
  //     console.error(error);
  //     throw new Error("Failed to update license: " + error.message);
  //   }
  // }

  // @Mutation(() => Boolean)
  // @Authorized()
  // async deleteLicense(@Arg("licenseId") licenseId: string) {
  //   try {
  //     await License.delete({ licenseId });
  //     return true;
  //   } catch (error) {
  //     console.error(error);
  //     return false;
  //   }
  // }
}
