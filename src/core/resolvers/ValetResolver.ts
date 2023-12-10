/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Resolver,
  Query,
  Mutation,
  Authorized,
  Arg,
  Ctx,
  Subscription,
  Field,
  ObjectType,
  PubSub,
  Root,
} from "type-graphql";
import { User } from "../entity/User";
import { AccountType } from "../types/AccountTypes";
import { Dealership } from "../entity/Dealership";
import { Order, OrderStatus } from "../entity/Order";
import { Valet, ValetStatus } from "../entity/Valet";
import { VehicleCheck } from "../entity/VehicleCheck";
import { ValetInput } from "../inputs/ValetInput";
import { getConnection, getRepository } from "typeorm";
import { getUser } from "./UserInfo";
import { verifyAccessToken } from "../helpers/authChecker";
import { AssignStatus, AssignedOrders } from "../entity/AssignedOrder";
import { CarInfo } from "../entity/CarInfo";

const stateTransitions = {
  [ValetStatus.IN_PROGRESS.valueOf()]: [
    ValetStatus.CANCELLED.valueOf(),
    ValetStatus.DEALERSHIP_TO_CUSTOMER_COMPLETED.valueOf(),
  ],
  [ValetStatus.DEALERSHIP_TO_CUSTOMER_STARTED.valueOf()]: [
    ValetStatus.VALET_VEHICLE_PICK_UP.valueOf(),
    ValetStatus.CANCELLED.valueOf(),
  ],
  [ValetStatus.DEALERSHIP_TO_CUSTOMER_COMPLETED.valueOf()]: [
    ValetStatus.DEALERSHIP_TO_CUSTOMER_STARTED.valueOf(),
    ValetStatus.CANCELLED.valueOf(),
  ],
  [ValetStatus.CUSTOMER_VEHICLE_PICK_UP.valueOf()]: [
    ValetStatus.DEALERSHIP_TO_CUSTOMER_COMPLETED.valueOf(),
    ValetStatus.CANCELLED.valueOf(),
  ],
  [ValetStatus.CUSTOMER_TO_DEALERSHIP_STARTED.valueOf()]: [
    ValetStatus.CUSTOMER_VEHICLE_PICK_UP.valueOf(),
    ValetStatus.CANCELLED.valueOf(),
  ],
  [ValetStatus.CUSTOMER_TO_DEALERSHIP_COMPLETED.valueOf()]: [
    ValetStatus.CUSTOMER_TO_DEALERSHIP_STARTED.valueOf(),
    ValetStatus.CANCELLED.valueOf(),
  ],
  [ValetStatus.CUSTOMER_RETURN_STARTED.valueOf()]: [
    ValetStatus.CUSTOMER_TO_DEALERSHIP_COMPLETED.valueOf(),
    ValetStatus.CANCELLED.valueOf(),
  ],
  [ValetStatus.CUSTOMER_RETURN_COMPLETED.valueOf()]: [
    ValetStatus.CUSTOMER_RETURN_STARTED.valueOf(),
    ValetStatus.CANCELLED.valueOf(),
  ],
};

@ObjectType()
class LatLong {
  @Field()
  id!: string;

  @Field()
  latitude!: number;

  @Field()
  longitude!: number;
}

@Resolver()
export class ValetResolver {
  @Authorized()
  @Query(() => [Valet])
  async getValets(): Promise<Valet[]> {
    try {
      const valets = await Valet.find();
      if (!valets) throw new Error("No valets found");
      return valets;
    } catch (err) {
      console.error(err);
      throw new Error("Failed to get valets");
    }
  }

  async createValetFun(inputs: ValetInput, customer: User, driver: User) {
    const existsInCustomer = await getRepository(Valet)
      .createQueryBuilder("valet")
      .leftJoinAndSelect("valet.customer", "customer")
      .leftJoinAndSelect("customer.profilePicture", "profilePicture")
      .leftJoinAndSelect("valet.dealership", "dealership")
      .leftJoinAndSelect("valet.order", "order")
      .leftJoinAndSelect("order.vehicle", "vehicle")
      .leftJoinAndSelect("valet.driver", "driver")
      .leftJoinAndSelect("valet.customerVehiclChecks", "customerVehiclChecks")
      .leftJoinAndSelect("valet.valetVehicleChecks", "valetVehicleChecks")
      .where("valet.customer.userId = :userId", { userId: customer.userId })
      .andWhere("valet.valetStatus IN (:...valetStatus)", {
        valetStatus: [
          ValetStatus.COMPLETED,
          ValetStatus.CANCELLED,
          ValetStatus.IN_PROGRESS,
          ValetStatus.RETURN_IN_PROGRESS,
        ],
      })
      .getMany();
    if (existsInCustomer.length > 0) {
      throw new Error(
        `Valet already in ${existsInCustomer[0].valetStatus} state`
      );
    }

    if (driver.isOnService) throw new Error("Driver is on service");

    const [dealership, order, valetExists] = await Promise.all([
      // Dealership.findOne({
      //   where: {
      //     dealershipId: inputs.dealershipId,
      //   },
      // }),
      getRepository(Dealership)
        .createQueryBuilder("dealership")
        .where("dealership.dealershipId = :dealershipId", {
          dealershipId: inputs.dealershipId,
        })
        .getOne(),
      // Order.findOne({
      //   where: {
      //     orderId: inputs.orderId,
      //   },
      // }),
      getRepository(Order)
        .createQueryBuilder("order")
        .leftJoinAndSelect("order.customer", "customer")
        .leftJoinAndSelect("order.vehicle", "vehicle")
        .leftJoinAndSelect("order.serviceType", "serviceType")
        .leftJoinAndSelect("order.dealership", "dealership")
        .where("order.orderId = :orderId", { orderId: inputs.orderId })
        .getOne(),
      // Valet.findOne({
      //   where: {
      //     order: {
      //       orderId: inputs.orderId,
      //     },
      //   },
      // }),
      getRepository(Valet)
        .createQueryBuilder("valet")
        .leftJoinAndSelect("valet.customer", "customer")
        .leftJoinAndSelect("customer.profilePicture", "profilePicture")
        .leftJoinAndSelect("valet.dealership", "dealership")
        .leftJoinAndSelect("valet.order", "order")
        .leftJoinAndSelect("order.vehicle", "vehicle")
        .leftJoinAndSelect("valet.driver", "driver")
        .leftJoinAndSelect("valet.customerVehiclChecks", "customerVehiclChecks")
        .leftJoinAndSelect("valet.valetVehicleChecks", "valetVehicleChecks")
        .where("order.orderId = :orderId", { orderId: inputs.orderId })
        .getOne(),
    ]);

    if (!dealership) throw new Error("Dealership not found");
    if (!order) throw new Error("Order not found");
    if (valetExists) throw new Error("Valet already exists");

    if (
      !inputs.frontImage ||
      !inputs.backImage ||
      !inputs.leftImage ||
      !inputs.rightImage
    ) {
      throw new Error("Please upload all images");
    }

    if (!inputs.mileage) throw new Error("Please enter the mileage");
    if (!inputs.gasLevel) throw new Error("Please enter the gas level");

    // const dealershipUserData = await createQueryBuilder(User, "user")
    //   .leftJoinAndSelect("user.dealerships", "dealerships")
    //   .where("dealerships.dealershipId = :dealershipId", {
    //     dealershipId: inputs.dealershipId,
    //   })
    //   .andWhere("user.accountType = :accountType", {
    //     accountType: AccountType.ADMIN.valueOf(),
    //   })
    //   .getOne();

    const queryRunner = getConnection().createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // let createCheck;
      // if (hasLoaner) {
      //   createCheck = await VehicleCheck.create({
      //     backImage: inputs.backImage,
      //     frontImage: inputs.frontImage,
      //     leftImage: inputs.leftImage,
      //     rightImage: inputs.rightImage,
      //     mileage: inputs.mileage,
      //     gasLevel: inputs.gasLevel,
      //     user:
      //       inputs.userType === AccountType.CUSTOMER.valueOf()
      //         ? customer
      //         : (dealershipUserData as any),
      //   }).save();
      //   if (!createCheck) throw new Error("Failed to create vehicle check");
      // }
      const createValet = Valet.create({
        comments: inputs.comments,
        customer: customer,
        dealership: dealership,
        driver: driver,
        order: order,
        createdAt: new Date(),
        valetStatus: ValetStatus.VALET_VEHICLE_PICK_UP,
      });
      // if (hasLoaner) {
      //   createValet.valetVehicleChecks = createCheck!;
      // }
      await createValet.save();
      order.orderStatus = OrderStatus.IN_PROGRESS;
      order.updatedDate = new Date();
      await order.save();
      if (!createValet) throw new Error("Failed to create valet");
      driver.isOnService = true;
      await driver.save();
      await queryRunner.commitTransaction();
      return createValet;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  @Authorized()
  @Mutation(() => Valet)
  async createValet(@Arg("inputs") inputs: ValetInput, @Ctx() ctx: any) {
    try {
      const driver = await getUser({
        userId: (<any>ctx.payload).userId,
      });
      if (!driver) throw new Error("Driver not found");

      const customer = await getUser({
        userId: inputs.customerId,
      });
      if (!customer) throw new Error("User not found");

      const valet = await this.createValetFun(inputs, customer, driver);

      if (valet.order.valetVehicleRequest) {
        await this.updateVehicleCheckFun({
          user: driver,
          inputs: inputs,
          valet: valet,
        });
        valet.valetPickUpTime = new Date();
      }

      const order = await getRepository(Order)
        .createQueryBuilder("order")
        .leftJoinAndSelect("order.customer", "customer")
        .leftJoinAndSelect("order.vehicle", "vehicle")
        .leftJoinAndSelect("order.serviceType", "serviceType")
        .leftJoinAndSelect("order.dealership", "dealership")
        .where("order.orderId = :orderId", { orderId: inputs.orderId })
        .getOne();
      const assignedOrder = await getRepository(AssignedOrders)
        .createQueryBuilder("assignedOrder")
        .leftJoinAndSelect("assignedOrder.order", "order")
        .where("order.orderId = :orderId", { orderId: inputs.orderId })
        .getOne();
      if (!assignedOrder) throw new Error("Assigned order not found");
      assignedOrder.assignStatus = AssignStatus.PENDING;
      valet.driver = driver;
      await valet.save();
      await assignedOrder.save();

      if (!order) throw new Error("Order not found");
      order.orderStatus = OrderStatus.IN_PROGRESS;
      order.updatedDate = new Date();
      await order.save();

      return valet;
    } catch (err: any) {
      console.error(err);
      throw new Error("Failed to create valet");
    }
  }

  async valetExistsFun(orderId: string) {
    const valetExists = await getRepository(Valet)
      .createQueryBuilder("valet")
      .leftJoinAndSelect("valet.customer", "customer")
      .leftJoinAndSelect("customer.profilePicture", "profilePicture")
      .leftJoinAndSelect("valet.dealership", "dealership")
      .leftJoinAndSelect("valet.driver", "driver")
      .leftJoinAndSelect("valet.order", "order")
      .leftJoinAndSelect("order.vehicle", "vehicle")
      .leftJoinAndSelect("valet.customerVehiclChecks", "customerVehiclChecks")
      .leftJoinAndSelect("valet.valetVehicleChecks", "valetVehicleChecks")
      .where("order.orderId = :orderId", { orderId })
      .getOne();
    if (!valetExists) throw new Error("Valet not found");
    return valetExists;
  }

  @Authorized()
  @Query(() => Boolean)
  async valetExists(@Arg("orderId") orderId: string) {
    try {
      await this.valetExistsFun(orderId);
      return true;
    } catch (err) {
      return false;
    }
  }

  @Authorized()
  @Query(() => [Valet])
  async getAllStartedDriverValets(@Ctx() ctx: any) {
    try {
      const username = (<any>ctx.payload).username;
      const driver = await getUser({
        username,
        accountType: AccountType.DRIVER.valueOf(),
      });
      if (!driver) throw new Error("Driver not found");

      const driverId = driver.userId;
      const statuses = [
        ValetStatus.CUSTOMER_TO_DEALERSHIP_STARTED.valueOf(),
        ValetStatus.DEALERSHIP_TO_CUSTOMER_COMPLETED.valueOf(),
        ValetStatus.DEALERSHIP_TO_CUSTOMER_STARTED.valueOf(),
        ValetStatus.VALET_VEHICLE_DROP_OFF.valueOf(),
        ValetStatus.VALET_VEHICLE_PICK_UP.valueOf(),
        ValetStatus.CUSTOMER_VEHICLE_PICK_UP.valueOf(),
        ValetStatus.CUSTOMER_RETURN_STARTED.valueOf(),
      ];
      const valets = await getRepository(Valet)
        .createQueryBuilder("valet")
        .leftJoinAndSelect("valet.customer", "customer")
        .leftJoinAndSelect("customer.profilePicture", "profilePicture")
        .leftJoinAndSelect("valet.dealership", "dealership")
        .leftJoinAndSelect("valet.order", "order")
        .leftJoinAndSelect("order.vehicle", "vehicle")
        .leftJoinAndSelect("valet.driver", "driver")
        .leftJoinAndSelect("valet.customerVehiclChecks", "customerVehiclChecks")
        .leftJoinAndSelect("valet.valetVehicleChecks", "valetVehicleChecks")
        .where("valet.driver.userId = :driver", { driver: driverId })
        .andWhere("valet.valetStatus IN (:...valetStatus)", {
          valetStatus: statuses,
        })
        .orderBy("valet.createdAt", "DESC")
        .getMany();
      return valets;
    } catch (error) {
      console.error(error);
      throw new Error("Failed to get started driver valets");
    }
  }

  @Authorized()
  @Query(() => Valet)
  async getValet(@Arg("orderId") orderId: string) {
    try {
      const valet = await this.valetExistsFun(orderId);
      return valet;
    } catch (err: any) {
      throw new Error("Failed to get valet");
    }
  }

  @Authorized()
  @Mutation(() => Valet)
  async updateValet(
    @Arg("valetId") valetId: string,
    @Arg("state") state: string,
    @Arg("inputs", { nullable: true }) inputs: ValetInput,
    @Ctx() ctx: any
  ) {
    try {
      const username = (<any>ctx.payload).username;
      const driver = await getUser({
        username,
        accountType: AccountType.DRIVER.valueOf(),
      });
      if (!driver) throw new Error("Driver not found");

      const valet = await getRepository(Valet)
        .createQueryBuilder("valet")
        .leftJoinAndSelect("valet.customer", "customer")
        .leftJoinAndSelect("customer.profilePicture", "profilePicture")
        .leftJoinAndSelect("valet.dealership", "dealership")
        .leftJoinAndSelect("valet.order", "order")
        .leftJoinAndSelect("order.driver", "driver")
        .where("valet.valetId = :valetId", { valetId })
        .andWhere("driver.userId = :driverId", { driverId: driver.userId })
        .getOne();
      if (!valet) throw new Error("Valet not found");

      if (valet.order.driver.userId !== driver.userId) {
        throw new Error("Driver is not assigned to this valet");
      }
      await this.validateValetStatus(valet, state as ValetStatus);

      const date = new Date();

      if (state === ValetStatus.CUSTOMER_VEHICLE_PICK_UP.valueOf()) {
        await this.updateVehicleCheckFun({
          user: valet.customer,
          inputs: inputs,
          valet: valet,
        });
        valet.customerPickUpTime = date;
      }
      if (state === ValetStatus.DEALERSHIP_TO_CUSTOMER_COMPLETED.valueOf()) {
        valet.valetDropOffTime = date;
      }
      if (state === ValetStatus.DEALERSHIP_TO_CUSTOMER_STARTED.valueOf()) {
        valet.valetPickUpTime = date;
      }
      if (state === ValetStatus.CUSTOMER_TO_DEALERSHIP_COMPLETED.valueOf()) {
        valet.customerDropOffTime = date;
      }
      if (
        state === ValetStatus.CUSTOMER_TO_DEALERSHIP_COMPLETED.valueOf() ||
        state === ValetStatus.CUSTOMER_RETURN_COMPLETED.valueOf() ||
        state === ValetStatus.COMPLETED.valueOf()
      ) {
        driver.isOnService = false;
        await driver.save();
      }
      if (state === ValetStatus.CUSTOMER_RETURN_STARTED.valueOf()) {
        valet.returnStartTime = date;
      }
      if (state === ValetStatus.CUSTOMER_RETURN_COMPLETED.valueOf()) {
        valet.returnEndTime = date;
        const assignedOrder = await getRepository(AssignedOrders)
          .createQueryBuilder("assignedOrder")
          .leftJoinAndSelect("assignedOrder.order", "order")
          .leftJoinAndSelect("assignedOrder.valetVehicle", "vehicle")
          .where("order.orderId = :orderId", { orderId: valet.order.orderId })
          .getOne();
        if (!assignedOrder) throw new Error("Assigned order not found");
        const getValetVehicle = await getRepository(CarInfo)
          .createQueryBuilder("vehicle")
          .where("vehicle.carId = :carId", {
            carId: assignedOrder.valetVehicle.carId,
          })
          .getOne();
        if (!getValetVehicle) throw new Error("Vehicle not found");
        getValetVehicle.available = true;
        assignedOrder.assignStatus = AssignStatus.COMPLETED;
        valet.order.orderStatus = OrderStatus.COMPLETED;
        await getValetVehicle.save();
        await assignedOrder.save();
        await valet.order.save();
      }
      valet.valetStatus = state.toUpperCase() as ValetStatus;
      valet.driver = driver;
      valet.updatedAt = date;
      await valet.save();
      return valet;
    } catch (err: any) {
      console.error(err);
      throw new Error("Failed to update valet");
    }
  }

  async updateVehicleCheckFun({
    user,
    inputs,
    valet,
  }: {
    user: User;
    inputs: ValetInput;
    valet: Valet;
  }) {
    try {
      const createCheck = await VehicleCheck.create({
        backImage: inputs.backImage,
        frontImage: inputs.frontImage,
        leftImage: inputs.leftImage,
        rightImage: inputs.rightImage,
        mileage: inputs.mileage,
        gasLevel: inputs.gasLevel,
        user: user,
      }).save();
      if (!createCheck) throw new Error("Failed to create vehicle check");
      if (user.accountType === AccountType.CUSTOMER.valueOf()) {
        valet.customerVehiclChecks = createCheck;
      }
      if (user.accountType === AccountType.DRIVER.valueOf()) {
        valet.valetVehicleChecks = createCheck;
      }
      await valet.save();
      return true;
    } catch (err: any) {
      console.error(err);
      throw new Error("Failed to update vehicle check");
    }
  }

  async validateValetStatus(
    valet: Valet,
    state: ValetStatus,
    isStarted = true
  ) {
    state = state.toUpperCase() as ValetStatus;
    if (valet.valetStatus.toUpperCase() === state) {
      throw new Error(`Valet already in ${state} state`);
    }

    if (
      !stateTransitions[state.toUpperCase()].includes(
        valet.valetStatus.toUpperCase()
      )
    ) {
      throw new Error(`Invalid state ${state}`);
    }

    if (!isStarted && state !== ValetStatus.COMPLETED.valueOf()) {
      throw new Error(`Invalid state ${state}`);
    }

    return;
  }

  @Authorized()
  @Mutation(() => LatLong)
  async sendDriversLocation(
    @Arg("valetId") valetId: string,
    @Arg("latitude") latitude: number,
    @Arg("longitude") longitude: number,
    @PubSub("DRIVER_LOCATION") publish: any
  ) {
    try {
      const valet = await getRepository(Valet)
        .createQueryBuilder("valet")
        .leftJoinAndSelect("valet.customer", "customer")
        .leftJoinAndSelect("valet.dealership", "dealership")
        .where("valet.valetId = :valetId", { valetId })
        .getOne();

      publish({
        id: valet?.customer.userId,
        latitude,
        longitude,
      });
      publish({
        id: valet?.dealership.dealershipId,
        latitude,
        longitude,
      });
      return {
        id: valet?.customer.userId,
        latitude,
        longitude,
      };
    } catch (err: any) {
      console.error(err);
      throw new Error("Failed to get driver location");
    }
  }

  @Subscription(() => LatLong || null, {
    topics: "DRIVER_LOCATION",
    filter: ({ payload, context }) => {
      const token = context.connectionParams.Authorization;
      const userId = (<any>verifyAccessToken(token.split(" ")[1])).userId;
      return payload.id === userId;
    },
  })
  async driverLocation(@Root() payload: LatLong) {
    return payload;
  }
}
