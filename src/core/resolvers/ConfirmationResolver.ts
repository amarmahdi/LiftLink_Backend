/* eslint-disable @typescript-eslint/no-explicit-any */
import { Resolver, Query, Mutation, Ctx, Arg, Authorized } from "type-graphql";
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
  async getConfirmation(
    @Arg("dealershipId", { nullable: true }) dealershipId: string,
    @Ctx() ctx: any
  ) {
    try {
      const username = ctx.payload.username;
      const user = await getUser({ username });

      if (!user) {
        throw new Error(`User with username ${username} not found`);
      }

      if (user.accountType === AccountType.ADMIN.valueOf() && !dealershipId) {
        throw new Error("Admin must provide a dealership ID");
      }

      if (user.accountType === AccountType.MANAGER.valueOf() && !dealershipId) {
        throw new Error("Manager must provide a dealership ID");
      }

      const confirmation = getRepository(UserDealershipConfirmation)
        .createQueryBuilder("confirmation")
        .leftJoinAndSelect("confirmation.user", "user")
        .leftJoinAndSelect("confirmation.dealership", "dealership")
        .where("confirmation.confirmationStatus = :confirmationStatus", {
          confirmationStatus: ConfirmationStatus.PENDING,
        });
      if (user.accountType === AccountType.DRIVER.valueOf()) {
        confirmation.andWhere("confirmation.toUserId != :userId", {
          userId: user.userId,
        });
      }
      if (
        user.accountType === AccountType.ADMIN.valueOf() ||
        user.accountType === AccountType.MANAGER.valueOf()
      ) {
        console.log(dealershipId);
        confirmation.andWhere("confirmation.toDealershipId = :dealershipId", {
          dealershipId,
        });
      }
      const confirmationArray = await confirmation.getMany();

      if (!confirmationArray.length) {
        throw new Error(`No pending confirmations found for user ${username}`);
      }

      return confirmationArray;
    } catch (error) {
      throw new Error(error);
    }
  }

  @Authorized()
  @Query(() => [UserDealershipConfirmation])
  async getPendingConfirmations(@Ctx() ctx: MyContext) {
    try {
      const username = (<any>ctx.payload).username;
      const user = await getUser({ username });
      const getConfirmation = await getRepository(UserDealershipConfirmation)
        .createQueryBuilder("confirmation")
        .leftJoinAndSelect("confirmation.user", "user")
        .leftJoinAndSelect("confirmation.dealership", "dealership")
        .where("confirmation.confirmationStatus = :confirmationStatus", {
          confirmationStatus: ConfirmationStatus.PENDING.valueOf(),
        })
        .andWhere("confirmation.fromUserId = :userId", { userId: user.userId })
        .getMany();
      console.log(getConfirmation);
      if (!getConfirmation) throw new Error("Confirmation not found");
      return getConfirmation;
    } catch (err) {
      console.error(err);
      throw new Error("Failed to get pending confirmations");
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
        user.accountType !== AccountType.DRIVER.valueOf() &&
        user.accountType !== AccountType.ADMIN.valueOf()
      ) {
        throw new Error("User is not a manager, driver or dealership");
      }
      // if (user.isDealership)
      //   throw new Error(
      //     "This user is a dealership, not a driver or manager. Please contact the admin to change this user's account type"
      //   );
      // const getConfirmation = await UserDealershipConfirmation.findOne({
      //   where: {
      //     confirmationId,
      //     confirmationStatus: ConfirmationStatus.PENDING,
      //   },
      // });
      const getConfirmation = await getRepository(UserDealershipConfirmation)
        .createQueryBuilder("confirmation")
        .leftJoinAndSelect("confirmation.user", "user")
        .leftJoinAndSelect("confirmation.dealership", "dealership")
        .where("confirmation.confirmationStatus = :confirmationStatus", {
          confirmationStatus: ConfirmationStatus.PENDING,
        })
        .andWhere("confirmation.confirmationId = :confirmationId", {
          confirmationId,
        })
        .getOne();
      if (!getConfirmation) throw new Error("Confirmation not found");
      // const dealership = await Dealership.findOne({
      //   where: {
      //     dealershipId: getConfirmation.dealership.dealershipId,
      //   },
      // });
      const dealership = await getRepository(Dealership)
        .createQueryBuilder("dealership")
        .leftJoinAndSelect("dealership.user", "user")
        .where("dealership.dealershipId = :dealershipId", {
          dealershipId: getConfirmation.dealership.dealershipId,
        })
        .getOne();
      if (!dealership) throw new Error("Dealership not found");
      if (user.accountType === AccountType.DRIVER.valueOf()) {
        user.dealerships = [...user.dealerships, dealership];
      } else if (user.accountType === AccountType.MANAGER.valueOf()) {
        if (getConfirmation.fromUserId !== user.userId) {
          user.dealerships = [...user.dealerships, dealership];
        } else {
          const getDriver = await getUser({
            userId: getConfirmation.fromUserId,
          });
          if (!getDriver) throw new Error("Driver not found");
          getDriver.dealerships = [...getDriver.dealerships, dealership];
          await getDriver.save();
        }
      } else {
        const getDriver = await getUser({
          userId: getConfirmation.fromUserId,
        });
        if (!getDriver) throw new Error("Driver not found");
        getDriver.dealerships = [...getDriver.dealerships, dealership];
        await getDriver.save();
      }
      await user.save();
      getConfirmation.confirmationStatus = ConfirmationStatus.CONFIRMED;
      await getConfirmation.save();
      return getConfirmation;
    } catch (err) {
      console.error(err);
      throw new Error("Failed to accept user dealership" + err);
    }
  }

  // @Authorized()
  // @Mutation(() => UserDealershipConfirmation)
  // async rejectUserDealership(
  //   @Arg("confirmationId") confirmationId: string,
  //   @Ctx() ctx: MyContext
  // ) {
  //   try {
  //     if (confirmationId === "") throw new Error("Confirmation ID is empty");
  //     const username = (<any>ctx.payload).username;
  //     const user = await getUser({ username });
  //     if (!user) throw new Error("User not found");
  //     if (
  //       user.accountType !== AccountType.MANAGER.valueOf() &&
  //       user.accountType !== AccountType.DRIVER.valueOf()
  //     ) {
  //       throw new Error("User is not a manager or driver");
  //     }
  //     if (user.isDealership)
  //       throw new Error("This account cannot be a dealership");
  //     const getConfirmation = await UserDealershipConfirmation.findOne({
  //       where: {
  //         user: {
  //           userId: user.userId,
  //         },
  //         confirmationId,
  //         confirmationStatus: ConfirmationStatus.PENDING,
  //       },
  //     });
  //     if (!getConfirmation) throw new Error("Confirmation not found");
  //     getConfirmation.confirmationStatus = ConfirmationStatus.REJECTED;
  //     await getConfirmation.save();
  //     return getConfirmation;
  //   } catch (err) {
  //     console.error(err);
  //     throw new Error("Failed to reject dealership " + err);
  //   }
  // }

  @Query(() => Number)
  @Authorized()
  async unconfirmedRequests(@Ctx() ctx: MyContext) {
    try {
      const username = (<any>ctx.payload).username;
      const user = await getUser({ username });
      if (!user) throw new Error("User not found");
      const getConfirmation = await getRepository(UserDealershipConfirmation)
        .createQueryBuilder("confirmation")
        .leftJoinAndSelect("confirmation.user", "user")
        .leftJoinAndSelect("confirmation.dealership", "dealership")
        .where("confirmation.confirmationStatus = :confirmationStatus", {
          confirmationStatus: ConfirmationStatus.PENDING,
        });

      if (user.accountType === AccountType.ADMIN.valueOf()) {
        getConfirmation.andWhere(
          "confirmation.toDealershipId = :dealershipId",
          {
            dealershipId: user.dealerships[0].dealershipId,
          }
        );
      } else if (user.accountType === AccountType.MANAGER.valueOf()) {
        getConfirmation.andWhere(
          "confirmation.toDealershipId = :dealershipId",
          {
            dealershipId: user.dealerships[0].dealershipId,
          }
        );
      } else {
        getConfirmation.andWhere("confirmation.fromUserId = :userId", {
          userId: user.userId,
        });
      }
      const confirmationArray = await getConfirmation.getManyAndCount();
      return (confirmationArray as any)[1];
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
