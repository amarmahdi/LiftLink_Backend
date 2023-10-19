import {
  Resolver,
  Query,
  Arg,
  Mutation,
  UseMiddleware,
  Ctx,
  Authorized,
} from "type-graphql";
import { CarInfo } from "../entity/CarInfo";
import { VehicleImage } from "../entity/VehicleImage";
import { CarInfoInput } from "../inputs/CarInfoInput";
import { MyContext } from "../helpers/MyContext";
import { User } from "../entity/User";
import { AccountType } from "../types/AccountTypes";
import { Dealership } from "../entity/Dealership";
import { getRepository } from "typeorm";

@Resolver()
export class CarInfoResolver {
  @Query(() => [CarInfo])
  @Authorized()
  async getCarInfo(
    @Arg("dealershipId", { nullable: true }) dealershipId: string,
    @Ctx() ctx: MyContext
  ) {
    const username = (<any>ctx.payload).username;
    const user = await User.findOne({ where: { username } });
    if (!user) throw new Error("User not found");
    if (user.accountType === AccountType.CUSTOMER.valueOf()) {
      const carInfo = await CarInfo.find({
        where: {
          user: {
            userId: user.userId,
          },
        },
      });
      return carInfo;
    }
    if (!dealershipId) throw new Error("Dealership ID is required");

    const dealership = await getRepository(Dealership)
      .createQueryBuilder("dealership")
      .leftJoinAndSelect("dealership.car", "car")
      .leftJoinAndSelect("car.carImage", "carImage")
      .where("dealership.dealershipId = :dealershipId", {
        dealershipId: dealershipId,
      })
      .getOne();
    if (!dealership) throw new Error("Dealership not found");
    return dealership.car;
  }

  @Query(() => [CarInfo])
  @Authorized()
  async getAvailableCarInfo(
    @Arg("dealershipId", { nullable: true }) dealershipId: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      const username = (<any>ctx.payload).username;
      const user = await User.findOne({ where: { username } });
      if (!user) throw new Error("User not found");
      if (!dealershipId) throw new Error("Dealership ID is required");
      const dealership = await getRepository(Dealership)
        .createQueryBuilder("dealership")
        .leftJoinAndSelect("dealership.car", "car")
        .leftJoinAndSelect("car.carImage", "carImage")
        .where("dealership.dealershipId = :dealershipId", {
          dealershipId: dealershipId,
        })
        .andWhere("car.available = :available", {
          available: true,
        })
        .getOne();
      if (!dealership) throw new Error("Dealership not found");
      return dealership.car;
    } catch (error) {
      console.error(error);
      throw new Error(error + " error: Failed to get available car info");
    }
  }

  @Authorized()
  @Mutation(() => CarInfo)
  async addCarInfo(
    @Arg("dealershipId", { nullable: true }) dealershipId: string,
    @Arg("input")
    {
      carName,
      carType,
      carColor,
      carModel,
      carImage,
      carMake,
      carYear,
      carVin,
      plateNumber,
      status,
      available,
      mileage,
      carInsurance,
      carRegistration,
    }: CarInfoInput,
    @Ctx() ctx: MyContext
  ) {
    try {
      const user = await User.findOne({
        where: { username: (<any>ctx.payload).username },
      });
      if (!user) throw new Error("User not found");
      if (
        user.accountType === AccountType.MANAGER.valueOf() ||
        user.accountType === AccountType.ADMIN.valueOf()
      ) {
        if (!dealershipId) throw new Error("Dealership ID is required");
      }

      const vehicleImage = await VehicleImage.create({
        imageLink: carImage,
      }).save();

      const carInfo = await CarInfo.create({
        carName,
        carType,
        carColor,
        carModel,
        carMake,
        carYear,
        carVin,
        plateNumber,
        status,
        available,
        mileage,
        carInsurance,
        carRegistration,
        carImage: vehicleImage,
      }).save();

      if (user.accountType === AccountType.CUSTOMER.valueOf()) {
        carInfo.user = user;
      } else if (
        user.accountType === AccountType.MANAGER.valueOf() ||
        user.accountType === AccountType.ADMIN.valueOf()
      ) {
        let currentDealership = await Dealership.findOne({
          where: { dealershipId: dealershipId },
        });
        if (!currentDealership) throw new Error("Dealership not found");
        carInfo.dealership = currentDealership;
      } else {
        throw new Error("User is not a manager or admin");
      }
      carInfo.carImage = vehicleImage;
      await carInfo.save();

      const carInfos = await CarInfo.find({
        where: {
          user: {
            userId: user.userId,
          },
        },
      });
      user.car = carInfos;
      await user.save();
      return carInfo;
    } catch (error) {
      console.error(error);
      throw new Error(error + " error: Failed to add car info");
    }
  }

  @Mutation(() => CarInfo)
  @Authorized()
  async makeCarAvailable(
    @Ctx() ctx: MyContext,
    @Arg("dealershipId", { nullable: true }) dealershipId: string,
  ) {
    try {
      const user = await User.findOne({
        where: { username: (<any>ctx.payload).username },
      });
      if (!user) throw new Error("User not found");
      if (
        user.accountType === AccountType.MANAGER.valueOf() ||
        user.accountType === AccountType.ADMIN.valueOf()
      ) {
        if (!dealershipId) throw new Error("Dealership ID is required");
      }
      const cars = await getRepository(CarInfo)
        .createQueryBuilder("carInfo")
        .leftJoinAndSelect("carInfo.dealership", "dealership")
        .where("dealership.dealershipId = :dealershipId", {
          dealershipId: dealershipId,
        })
        .getMany();
      if (!cars) throw new Error("Car not found");
      cars.forEach(async (car) => {
        car.available = true;
        await car.save();
      });
      return cars;
    } catch (error) {
      console.error(error);
      throw new Error(error + " error: Failed to make car available");
    }
  }
}
