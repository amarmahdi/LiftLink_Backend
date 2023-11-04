import {
  Resolver,
  Query,
  Mutation,
  UseMiddleware,
  Ctx,
  Arg,
  Authorized,
} from "type-graphql";
import { User } from "../entity/User";
import {
  ConfirmationStatus,
  UserDealershipConfirmation,
} from "../entity/Confirmation";
import { MyContext } from "../helpers/MyContext";
import { AccountType } from "../types/AccountTypes";
import { Dealership } from "../entity/Dealership";
import { getUser } from "./UserInfo";
import { getRepository } from "typeorm";

@Resolver()
export class ConfirmationResolver {
  @Authorized()
  @Query(() => [UserDealershipConfirmation])
  async getConfirmation(@Ctx() ctx: any) {
    try {
      const username = ctx.payload.username;
      const user = await getUser({ username });

      if (!user) {
        throw new Error(`User with username ${username} not found`);
      }

      const confirmation = await getRepository(UserDealershipConfirmation)
        .createQueryBuilder("confirmation")
        .leftJoinAndSelect("confirmation.user", "user")
        .leftJoinAndSelect("confirmation.dealership", "dealership")
        .where("confirmation.confirmationStatus = :confirmationStatus", {
          confirmationStatus: ConfirmationStatus.PENDING,
        })
        .andWhere("user.userId = :userId", { userId: user.userId })
        .getMany();

      if (!confirmation.length) {
        throw new Error(`No pending confirmations found for user ${username}`);
      }

      return confirmation;
    } catch (error) {
      console.error("Error getting confirmation: ", error);
      throw new Error("Error getting confirmation");
    }
  }

  @Authorized()
  @Mutation(() => UserDealershipConfirmation)
  async acceptUserDealership(
    @Arg("confirmationId") confirmationId: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      const username = (<any>ctx.payload).username;
      const user = await getUser({ username });
      if (!user) throw new Error("User not found");
      if (
        user.accountType !== AccountType.MANAGER.valueOf() &&
        user.accountType !== AccountType.DRIVER.valueOf()
      ) {
        throw new Error("User is not a manager or driver");
      }
      if (user.isDealership)
        throw new Error(
          "This user is a dealership, not a driver or manager. Please contact the admin to change this user's account type"
        );
      const getConfirmation = await UserDealershipConfirmation.findOne({
        where: {
          confirmationId,
          confirmationStatus: ConfirmationStatus.PENDING,
        },
      });
      if (!getConfirmation) throw new Error("Confirmation not found");
      const dealership = await Dealership.findOne({
        where: {
          dealershipId: getConfirmation.dealership.dealershipId,
        },
      });
      if (!dealership) throw new Error("Dealership not found");
      user.dealerships = [...user.dealerships, dealership];
      await user.save();
      getConfirmation.confirmationStatus = ConfirmationStatus.CONFIRMED;
      await getConfirmation.save();
      return getConfirmation;
    } catch (err) {
      console.error(err);
      throw new Error("Failed to accept user dealership" + err);
    }
  }

  @Authorized()
  @Mutation(() => UserDealershipConfirmation)
  async rejectUserDealership(
    @Arg("confirmationId") confirmationId: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      if (confirmationId === "") throw new Error("Confirmation ID is empty");
      const username = (<any>ctx.payload).username;
      const user = await getUser({ username });
      if (!user) throw new Error("User not found");
      if (
        user.accountType !== AccountType.MANAGER.valueOf() &&
        user.accountType !== AccountType.DRIVER.valueOf()
      ) {
        throw new Error("User is not a manager or driver");
      }
      if (user.isDealership)
        throw new Error("This account cannot be a dealership");
      const getConfirmation = await UserDealershipConfirmation.findOne({
        where: {
          user: {
            userId: user.userId,
          },
          confirmationId,
          confirmationStatus: ConfirmationStatus.PENDING,
        },
      });
      if (!getConfirmation) throw new Error("Confirmation not found");
      getConfirmation.confirmationStatus = ConfirmationStatus.REJECTED;
      await getConfirmation.save();
      return getConfirmation;
    } catch (err) {
      console.error(err);
      throw new Error("Failed to reject dealership " + err);
    }
  }

  @Query(() => Number)
  @Authorized()
  async unconfirmedRequests(@Ctx() ctx: MyContext) {
    try {
      const username = (<any>ctx.payload).username;
      const user = await getUser({ username });
      if (!user) throw new Error("User not found");
      const getConfirmation = await UserDealershipConfirmation.find({
        where: {
          user: {
            userId: user.userId,
          },
          confirmationStatus: ConfirmationStatus.PENDING,
        },
      });
      if (!getConfirmation) throw new Error("Confirmation not found");
      return getConfirmation.length;
    } catch (err) {
      console.error(err);
      throw new Error("Failed to confirm dealership");
    }
  }

  // @Authorized()
  // @Query(() => [UserDealershipConfirmation])
  // async getConfirmedOrders(
  //   @Ctx() ctx: MyContext
  // ) {
  //   try {
  //     const username = (<any>ctx.payload).username;
  //     const user = await getUser({ username })
  //     if (!user) throw new Error("User not found");
  //     const getConfirmation = await UserDealershipConfirmation.find({
  //       where: {
  //         user: {
  //           userId: user.userId,
  //         },
  //         confirmationStatus: ConfirmationStatus.CONFIRMED,
  //       },
  //     });
  //     if (!getConfirmation) throw new Error("Confirmation not found");
  //     getConfirmation.forEach(async (confirmation) => {
  //       confirmation.confirmationStatus = ConfirmationStatus.CONFIRMED;
  //       await confirmation.save();
  //     });
  //     return getConfirmation;
  //   } catch (err) {
  //     console.error(err);
  //     throw new Error("Failed to confirm dealership");
  //   }
  // }
}
