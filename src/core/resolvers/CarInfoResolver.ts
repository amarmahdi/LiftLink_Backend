/* eslint-disable @typescript-eslint/no-explicit-any */
import { Resolver, Query, Arg, Mutation, Ctx, Authorized } from "type-graphql";
import { CarInfo } from "../entity/CarInfo";
import { VehicleImage } from "../entity/VehicleImage";
import { CarInfoInput } from "../inputs/CarInfoInput";
import { MyContext } from "../helpers/MyContext";
import { AccountType } from "../types/AccountTypes";
import { Dealership } from "../entity/Dealership";
import { getRepository } from "typeorm";
import { getUser } from "./UserInfo";

@Resolver()
export class CarInfoResolver {
  @Query(() => [CarInfo])
  @Authorized()
  async getCarInfo(
    @Arg("dealershipId", { nullable: true }) dealershipId: string,
    @Ctx() ctx: MyContext
  ) {
    const username = (<any>ctx.payload).username;
    const user = await getUser({ username });
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
      const user = await getUser({ username });
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
      const user = await getUser({ username: (<any>ctx.payload).username });
      if (!user) throw new Error("User not found");
      if (
        user.accountType === AccountType.MANAGER.valueOf() ||
        user.accountType === AccountType.ADMIN.valueOf()
      ) {
        if (!dealershipId) throw new Error("Dealership ID is required");
      }

      const getVehicle = await getRepository(CarInfo)
        .createQueryBuilder("carInfo")
        .leftJoinAndSelect("carInfo.dealership", "dealership")
        .where("dealership.dealershipId = :dealershipId", {
          dealershipId: dealershipId,
        })
        .getMany();

      if (getVehicle.length > 0) {
        if (getVehicle.some((vehicle) => vehicle.carVin === carVin)) {
          throw new Error("Car VIN already exists");
        }
        if (getVehicle.some((vehicle) => vehicle.plateNumber === plateNumber)) {
          throw new Error("Plate number already exists");
        }
        if (
          getVehicle.some(
            (vehicle) => vehicle.carRegistration === carRegistration
          )
        ) {
          throw new Error("Car registration already exists");
        }
      }

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
      }).save();

      if (user.accountType === AccountType.CUSTOMER.valueOf()) {
        carInfo.user = user;
      } else if (
        user.accountType === AccountType.MANAGER.valueOf() ||
        user.accountType === AccountType.ADMIN.valueOf()
      ) {
        const currentDealership = await getRepository(Dealership)
          .createQueryBuilder("dealership")
          .where("dealership.dealershipId = :dealershipId", {
            dealershipId: dealershipId,
          })
          .getOne();
        if (!currentDealership) throw new Error("Dealership not found");
        carInfo.dealership = currentDealership;
      } else {
        throw new Error("User is not a manager or admin");
      }
      if (user.car.length > 0) {
        user.car = [...user.car, carInfo];
      } else {
        user.car = [carInfo];
      }
      await carInfo.save();
      await user.save();
      return carInfo;
    } catch (error) {
      console.error(error);
      throw new Error(error + " error: Failed to add car info");
    }
  }

  @Authorized()
  @Mutation(() => CarInfo)
  async addVehicleImage(
    @Arg("carInfoId") carInfoId: string,
    @Arg("carImage") carImage: string
  ) {
    try {
      const carInfo = await CarInfo.findOne({
        where: { carId: carInfoId },
      });
      if (!carInfo) throw new Error("Car info not found");

      const vehicleImage = await VehicleImage.create({
        imageLink: carImage,
      }).save();

      carInfo.carImage = vehicleImage;
      await carInfo.save();

      return carInfo;
    } catch (error) {
      console.error(error);
      throw new Error(
        error + " error: Failed to add vehicle image to car info"
      );
    }
  }

  @Mutation(() => CarInfo)
  @Authorized()
  async makeCarAvailable(
    @Ctx() ctx: MyContext,
    @Arg("dealershipId", { nullable: true }) dealershipId: string
  ) {
    try {
      const user = await getUser({ username: (<any>ctx.payload).username });
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
