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
import { AccountType } from "../types/AccountTypes";
import { OrderStatus } from "../entity/Order";
import { Valet, ValetStatus } from "../entity/Valet";
import { ValetInput } from "../inputs/ValetInput";
import { getConnection } from "typeorm";
import { getUser } from "./UserInfo";
import { verifyAccessToken } from "../helpers/authChecker";
import { AssignStatus } from "../entity/AssignedOrder";
import { ValidationError } from "apollo-server-core";
import { DatabaseError } from "pg";
import { ValetResolverHelpers } from "../helpers/valetResolverHelpers";

@ObjectType()
class LatLong {
  @Field()
  id!: string;

  @Field()
  latitude!: number;

  @Field()
  longitude!: number;
}

const Helpers = new ValetResolverHelpers();

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

  @Authorized()
  @Mutation(() => Valet)
  async createValet(@Arg("inputs") inputs: ValetInput, @Ctx() ctx: any) {
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const driver = await Helpers.getUserById((<any>ctx.payload).userId);
      const customer = await Helpers.getUserById((inputs as any).customerId);

      const valet = await Helpers.createValetFun(inputs, customer, driver);

      if (valet.order.valetVehicleRequest) {
        await Helpers.updateVehicleCheckFun({
          user: driver,
          inputs: inputs,
          valet: valet,
        });
        valet.valetPickUpTime = new Date();
      }

      const order = await Helpers.getOrderById((inputs as any).orderId);
      const assignedOrder = await Helpers.getAssignedOrderById(
        (inputs as any).orderId
      );

      assignedOrder.assignStatus = AssignStatus.PENDING;
      valet.driver = driver;

      await queryRunner.manager.save(valet);
      await queryRunner.manager.save(assignedOrder);

      order.orderStatus = OrderStatus.IN_PROGRESS;
      order.updatedDate = new Date();
      await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();

      return valet;
    } catch (err: any) {
      await queryRunner.rollbackTransaction();

      if (err instanceof ValidationError) {
        console.error(err);
        throw new Error("Validation failed");
      } else if (err instanceof DatabaseError) {
        console.error(err);
        throw new Error("Database operation failed");
      } else {
        console.error(err);
        throw new Error("Failed to create valet");
      }
    } finally {
      await queryRunner.release();
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
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const username = (<any>ctx.payload).username;
      const driver = await getUser({
        username,
        accountType: AccountType.DRIVER.valueOf(),
      });
      if (!driver) throw new Error("Driver not found");

      const valet = await Helpers.getValetById(valetId, driver.userId);
      if (!valet) throw new Error("Valet not found");

      if (valet.driver.userId !== driver.userId) {
        throw new Error("Driver is not assigned to this valet");
      }
      await Helpers.validateValetStatus(valet, state as ValetStatus);
      const date = new Date();

      await Helpers.updateValetState(valet, state, date, inputs);
      valet.valetStatus = state.toUpperCase() as ValetStatus;
      valet.driver = driver;
      valet.updatedAt = date;
      await queryRunner.manager.save(valet);

      await queryRunner.commitTransaction();

      return valet;
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      console.error(err);
      throw new Error("Failed to update valet");
    } finally {
      await queryRunner.release();
    }
  }

  @Authorized()
  @Query(() => Boolean)
  async valetExists(@Arg("orderId") orderId: string) {
    try {
      await Helpers.valetExistsFun(orderId);
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

      const statuses = [
        ValetStatus.CUSTOMER_TO_DEALERSHIP_STARTED.valueOf(),
        ValetStatus.DEALERSHIP_TO_CUSTOMER_COMPLETED.valueOf(),
        ValetStatus.DEALERSHIP_TO_CUSTOMER_STARTED.valueOf(),
        ValetStatus.VALET_VEHICLE_DROP_OFF.valueOf(),
        ValetStatus.VALET_VEHICLE_PICK_UP.valueOf(),
        ValetStatus.CUSTOMER_VEHICLE_PICK_UP.valueOf(),
        ValetStatus.CUSTOMER_RETURN_STARTED.valueOf(),
      ];

      const valets = await Helpers.getStartedDriverValets(
        driver.userId,
        statuses
      );
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
      const valet = await Helpers.valetExistsFun(orderId);
      return valet;
    } catch (err: any) {
      throw new Error("Failed to get valet");
    }
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
      const valet = await Helpers.getValetById(valetId);

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
