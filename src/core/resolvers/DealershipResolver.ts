import {
  Resolver,
  Query,
  Arg,
  Mutation,
  UseMiddleware,
  Ctx,
  Authorized,
} from "type-graphql";
import { Dealership } from "../entity/Dealership";
import { MyContext } from "../helpers/MyContext";
import { User } from "../entity/User";
import { DealershipInput } from "../inputs/DealershipInput";
import { AccountType } from "../types/AccountTypes";
import { UserDealershipConfirmation } from "../entity/Confirmation";
import { searchDealerships } from "../helpers/searchUsers";
import { AssignStatus, AssignedOrders } from "../entity/AssignedOrder";
import { getRepository } from "typeorm";

const isIncluded = async (arr: any, field: any, name: any) => {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][field] === name) {
      return true;
    }
  }
  return false;
};

@Resolver()
export class DealershipResolver {
  @Query(() => [Dealership])
  @Authorized()
  async getDealership(@Ctx() ctx: MyContext) {
    try {
      const username = (<any>ctx.payload).username;
      const user = await User.findOne({
        where: { username },
        relations: [
          "dealerships",
          "dealerships.servicePackages",
          "dealerships.assignedOrders",
          "dealerships.car",
        ],
      });
      if (!user) throw new Error("User not found");
      return user.dealerships;
    } catch (error) {
      console.error(error);
      throw new Error("Failed to get dealerships " + error);
    }
  }

  @Mutation(() => Dealership)
  @Authorized()
  async addDealership(
    @Arg("input")
    {
      dealershipName,
      dealershipAddress,
      dealershipCity,
      dealershipState,
      dealershipZipCode,
      dealershipCountry,
    }: DealershipInput,
    @Ctx() ctx: MyContext
  ) {
    try {
      const user = await User.findOne({
        where: { username: (<any>ctx.payload).username },
      });
      if (!user) throw new Error("User not found");
      if (!user.isDealership) throw new Error("User is not a dealership");
      if (
        !dealershipName ||
        !dealershipAddress ||
        !dealershipCity ||
        !dealershipState ||
        !dealershipZipCode ||
        !dealershipCountry
      ) {
        throw new Error("Dealership information is incomplete");
      }
      const existingDealership = await Dealership.findOne({
        where: { dealershipName },
      });
      if (existingDealership) throw new Error("Dealership already exists");
      const dealership = await Dealership.create({
        dealershipName,
        dealershipAddress,
        dealershipCity,
        dealershipState,
        dealershipZipCode,
        dealershipCountry,
      }).save();
      user.dealerships = [...user.dealerships, dealership];
      await user.save();
      return dealership;
    } catch (error) {
      console.error(error);
      throw new Error("Failed to add dealership: " + error);
    }
  }

  @Mutation(() => Dealership)
  @Authorized()
  async updateDealership(
    @Arg("input")
    {
      dealershipName,
      dealershipAddress,
      dealershipCity,
      dealershipState,
      dealershipZipCode,
      dealershipCountry,
    }: DealershipInput,
    @Ctx() ctx: MyContext
  ) {
    try {
      const user = await User.findOne({
        where: { username: (<any>ctx.payload).username },
      });
      if (!user) throw new Error("User not found");
      if (!user.isDealership) throw new Error("User is not a dealership");
      if (
        !dealershipName ||
        !dealershipAddress ||
        !dealershipCity ||
        !dealershipState ||
        !dealershipZipCode ||
        !dealershipCountry
      ) {
        throw new Error("Dealership information is incomplete");
      }
      const dealership = await Dealership.findOne({
        where: { dealershipName },
      });
      if (!dealership) throw new Error("Dealership not found");
      dealership.dealershipName = dealershipName;
      dealership.dealershipAddress = dealershipAddress;
      dealership.dealershipCity = dealershipCity;
      dealership.dealershipState = dealershipState;
      dealership.dealershipZipCode = dealershipZipCode;
      dealership.dealershipCountry = dealershipCountry;
      await dealership.save();
      return dealership;
    } catch (error) {
      console.error(error);
      throw new Error("Failed to update dealership");
    }
  }

  @Mutation(() => String)
  @Authorized()
  async addUsersToDealership(
    @Arg("userId") userId: string,
    @Arg("dealershipName") dealershipName: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      const dusername = (<any>ctx.payload).username;
      const duser = await User.findOne({ where: { username: dusername } });
      if (!duser) throw new Error("User not found");
      if (!duser.isDealership) throw new Error("User is not a dealership");
      const dealership = await Dealership.findOne({
        where: { dealershipName },
      });
      if (!dealership) throw new Error("Dealership not found");
      const user = await User.findOne({ where: { userId } });
      if (!user) throw new Error("User not found");
      if (
        user.accountType !== AccountType.DRIVER.valueOf() &&
        user.accountType !== AccountType.MANAGER.valueOf()
      )
        throw new Error("User is not a driver or manager");
      if (user.isDealership) throw new Error("User is a dealership");
      const userInDealership = await isIncluded(
        user.dealerships,
        "dealershipName",
        dealershipName
      );
      if (userInDealership) throw new Error("User is already in dealership");
      await UserDealershipConfirmation.create({
        user,
        dealership,
      }).save();
      return "Confirmation sent";
    } catch (error) {
      console.error(error);
      throw new Error("Failed to add user to dealership");
    }
  }

  @Mutation(() => String)
  @Authorized()
  async removeUsersFromDealership(
    @Arg("userId") userId: string,
    @Arg("dealershipName") dealershipName: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      const dusername = (<any>ctx.payload).username;
      const duser = await getRepository(User)
        .createQueryBuilder("user")
        .where("user.username = :username", { username: dusername })
        .getOne();

      if (!duser) throw new Error("User not found");
      if (
        duser.accountType !== AccountType.MANAGER &&
        duser.accountType !== AccountType.ADMIN
      )
        throw new Error("User is not a manager or admin");

      const dealership = await getRepository(Dealership)
        .createQueryBuilder("dealership")
        .where("dealership.dealershipName = :dealershipName", {
          dealershipName,
        })
        .getOne();

      if (!dealership) throw new Error("Dealership not found");

      const user = await getRepository(User)
        .createQueryBuilder("user")
        .leftJoinAndSelect("user.dealerships", "dealership")
        .where("user.userId = :userId", { userId })
        .getOne();

      if (!user) throw new Error("User not found");
      if (!user.dealerships) throw new Error("User is not in any dealership");

      const userInDealership = user.dealerships.some(
        (dealership) => dealership.dealershipName === dealershipName
      );

      if (!userInDealership) throw new Error("User is not in dealership");

      user.dealerships = user.dealerships.filter(
        (dealership) => dealership.dealershipName !== dealershipName
      );

      const removeFromAssignedOrders = await getRepository(AssignedOrders)
        .createQueryBuilder("assignedOrder")
        .leftJoinAndSelect("assignedOrder.drivers", "driver")
        .where("driver.userId = :userId", { userId })
        .andWhere("assignedOrder.assignStatus = :assignStatus", {
          assignStatus: AssignStatus.PENDING,
        })
        .andWhere("driver.dealerships = :dealerships", {
          dealerships: user.dealerships,
        })
        .getMany();

      removeFromAssignedOrders.forEach(async (assignedOrder) => {
        assignedOrder.drivers = assignedOrder.drivers.filter(
          (driver) => driver.userId !== user.userId
        );
        await assignedOrder.save();
      });

      await getRepository(User).save(user);

      return "User removed from dealership";
    } catch (error) {
      console.error(error);
      throw new Error("Failed to remove user from dealership " + error);
    }
  }

  @Query(() => [User])
  @Authorized()
  async getEmployeesInDealership(
    @Arg("dealershipName") dealershipName: string,
    @Arg("accountType", { nullable: true }) accountType: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      if (!dealershipName) throw new Error("Dealership name is required");
      const dusername = (<any>ctx.payload).username;
      const duser = await User.findOne({ where: { username: dusername } });
      if (!duser) throw new Error("User not found");

      const dealership = await getRepository(Dealership)
        .createQueryBuilder("dealership")
        .where("dealership.dealershipName = :dealershipName", {
          dealershipName,
        })
        .getOne();

      if (!dealership) throw new Error("Dealership not found");

      const existsInAccount = await isIncluded(
        duser.dealerships,
        "dealershipName",
        dealershipName
      );
      if (!existsInAccount)
        throw new Error(`This account is not in dealership`);

      if (accountType) {
        accountType = accountType.toLowerCase();
        if (
          accountType !== AccountType.DRIVER.valueOf() &&
          accountType !== AccountType.MANAGER.valueOf()
        )
          throw new Error("Invalid account type");
      }

      const users = !accountType
        ? await getRepository(User)
            .createQueryBuilder("user")
            .leftJoin("user.dealerships", "dealership")
            .where("dealership.dealershipId = :dealershipId", {
              dealershipId: dealership.dealershipId,
            })
            .andWhere("user.accountType != :adminAccountType", {
              adminAccountType: AccountType.ADMIN.valueOf(),
            })
            .getMany()
        : await getRepository(User)
            .createQueryBuilder("user")
            .leftJoin("user.dealerships", "dealership")
            .where("dealership.dealershipId = :dealershipId", {
              dealershipId: dealership.dealershipId,
            })
            .andWhere("user.accountType = :accountType", {
              accountType,
            })
            .andWhere("user.accountType != :adminAccountType", {
              adminAccountType: AccountType.ADMIN.valueOf(),
            })
            .getMany();
      return users;
    } catch (error) {
      console.error(error);
      throw new Error("Failed to get drivers in dealership: " + error);
    }
  }

  @Query(() => [User])
  @Authorized()
  async getAvailableDriversInDealership(
    @Arg("dealershipId") dealershipId: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      const username = (<any>ctx.payload).username;
      const drivers = await getRepository(User)
        .createQueryBuilder("user")
        .leftJoinAndSelect("user.dealerships", "dealership")
        .where("dealership.dealershipId = :dealershipId", { dealershipId })
        .andWhere("user.accountType = :accountType", {
          accountType: AccountType.DRIVER.valueOf(),
        })
        .andWhere("user.username != :username", { username })
        .andWhere("user.isActive = :isActive", { isActive: true })
        .andWhere("user.isOnService = :isOnService", { isOnService: false })
        .getMany();
      return drivers;
    } catch (error) {
      console.error(error);
      throw new Error("Failed to get available drivers in dealership");
    }
  }

  @Query(() => Number)
  @Authorized()
  async getNumberOfDriversInDealership(
    @Arg("dealershipId") dealershipId: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      if (!dealershipId) throw new Error("Dealership name is required");
      const dusername = (<any>ctx.payload).username;
      const duser = await User.findOne({ where: { username: dusername } });
      if (!duser) throw new Error("User not found");
      const dealership = await Dealership.findOne({ where: { dealershipId } });
      if (!dealership) throw new Error("Dealership not found");
      const existsInAccount = await isIncluded(
        duser.dealerships,
        "dealershipId",
        dealershipId
      );
      if (!existsInAccount)
        throw new Error(`This account is not in dealership`);
      const users = await User.find({
        where: {
          dealerships: {
            dealershipId: dealership.dealershipId,
          },
          accountType: AccountType.DRIVER,
        },
      });
      return users.length;
    } catch (error) {
      console.error(error);
      throw new Error("Failed to get number of drivers in dealership");
    }
  }

  @Query(() => Number)
  @Authorized()
  async getNumberOfManagersInDealership(
    @Arg("dealershipId") dealershipId: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      if (!dealershipId) throw new Error("Dealership name is required");
      const dusername = (<any>ctx.payload).username;
      const duser = await User.findOne({ where: { username: dusername } });
      if (!duser) throw new Error("User not found");
      const dealership = await Dealership.findOne({ where: { dealershipId } });
      if (!dealership) throw new Error("Dealership not found");
      const existsInAccount = await isIncluded(
        duser.dealerships,
        "dealershipId",
        dealershipId
      );
      if (!existsInAccount)
        throw new Error(`This account is not in dealership`);
      const users = await User.find({
        where: {
          dealerships: {
            dealershipId: dealership.dealershipId,
          },
          accountType: AccountType.MANAGER,
        },
      });
      return users.length;
    } catch (error) {
      console.error(error);
      throw new Error("Failed to get number of managers in dealership");
    }
  }

  @Query(() => [Dealership])
  @Authorized()
  async findDealerships(@Arg("searchTerm") searchTerm: string) {
    try {
      const searchResults = await searchDealerships(searchTerm);
      return searchResults;
    } catch (error: any) {
      console.error(error);
      throw new Error("Failed to search dealerships " + error);
    }
  }
}
