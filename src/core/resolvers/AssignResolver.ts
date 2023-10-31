import {
  Arg,
  Authorized,
  Ctx,
  Mutation,
  PubSub,
  Query,
  Resolver,
  Root,
  Subscription,
} from "type-graphql";
import { ApolloError } from "apollo-server-core";
import { AccountType } from "../types/AccountTypes";
import { AssignedOrders, AssignStatus } from "../entity/AssignedOrder";
import { CarInfo } from "../entity/CarInfo";
import { Dealership } from "../entity/Dealership";
import { MyContext } from "../helpers/MyContext";
import { Order, OrderStatus } from "../entity/Order";
import { User } from "../entity/User";
import { AssignOrderInput } from "../inputs/AssignOrderInput";
import { createQueryBuilder, getRepository } from "typeorm";
import usernameToken from "../helpers/usernameToken";
import { getUser } from "./UserInfo";

@Resolver()
export class AssignResolver {
  @Authorized()
  @Query(() => [AssignedOrders])
  async getAllAssignedOrders(@Ctx() ctx: MyContext) {
    try {
      const assignedOrders = await getRepository(AssignedOrders)
        .createQueryBuilder("assignedOrders")
        .getMany();

      console.log(assignedOrders);
      return assignedOrders;
    } catch (error) {
      console.error(error);
      throw new ApolloError("Failed to get assigned orders " + error);
    }
  }

  @Authorized()
  @Query(() => [AssignedOrders])
  async getAssignedOrdersInDealership(
    @Arg("dealershipId") dealershipId: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      const assignedOrders = await getRepository(AssignedOrders)
        .createQueryBuilder("assignedOrders")
        .leftJoinAndSelect("assignedOrders.dealership", "dealership")
        .where("dealership.dealershipId = :dealershipId", {
          dealershipId: dealershipId,
        })
        .getMany();

      if (!assignedOrders) {
        throw new ApolloError("Assigned orders not found");
      }

      return assignedOrders;
    } catch (error) {
      console.error("Error getting assigned orders:", error);
      throw new ApolloError("Failed to get assigned orders");
    }
  }

  @Authorized()
  @Query(() => [AssignedOrders])
  async getAssignedOrders(
    @Arg("userId") userId: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      const user = await getUser({ userId });
      if (!user) throw new ApolloError("User not found");

      if (user.accountType === AccountType.CUSTOMER.valueOf()) {
        const assignedOrder = await getRepository(AssignedOrders)
          .createQueryBuilder("assignedOrders")
          .leftJoinAndSelect("assignedOrders.order", "order")
          .leftJoinAndSelect("assignedOrders.drivers", "drivers")
          .leftJoinAndSelect("assignedOrders.dealership", "dealership")
          .where("assignedOrders.customerId = :customerId", {
            customerId: user.userId,
          })
          .andWhere("assignedOrders.assignStatus = :assignStatus", {
            assignStatus: AssignStatus.PENDING,
          })
          .getMany();
        if (!assignedOrder) throw new ApolloError("Orders not assigned yet!");
        return assignedOrder;
      }

      if (user.accountType === AccountType.DRIVER.valueOf()) {
        const assignedOrder = await getRepository(AssignedOrders)
          .createQueryBuilder("assignedOrders")
          .leftJoinAndSelect("assignedOrders.order", "order")
          .leftJoinAndSelect("assignedOrders.drivers", "drivers")
          .leftJoinAndSelect("assignedOrders.dealership", "dealership")
          .where("drivers.userId = :userId", { userId: user.userId })
          .andWhere("assignedOrders.assignStatus = :assignStatus", {
            assignStatus: AssignStatus.PENDING,
          })
          .getMany();
        if (!assignedOrder) throw new ApolloError("No Assigned order found");
        return assignedOrder;
      }
    } catch (error) {
      console.error(error);
      throw new ApolloError("Failed to get assigned orders " + error);
    }
  }

  @Authorized()
  @Query(() => AssignedOrders)
  async getAssignedOrder(
    @Arg("assignId", { nullable: true }) assignId: string,
    @Arg("orderId", { nullable: true }) orderId: string,
    @Ctx() ctx: MyContext
  ) {
    try {
      let assignedOrder: AssignedOrders | undefined | null;

      if (assignId) {
        assignedOrder = await getRepository(AssignedOrders)
          .createQueryBuilder("assignedOrders")
          .leftJoinAndSelect("assignedOrders.order", "order")
          .leftJoinAndSelect("assignedOrders.drivers", "drivers")
          .leftJoinAndSelect("assignedOrders.valetVehicle", "valetVehicle")
          .leftJoinAndSelect("assignedOrders.dealership", "dealership")
          .where("assignedOrders.assignId = :assignId", { assignId })
          .getOne();
        console.log('from assign id', assignedOrder)
      } else if (orderId) {
        assignedOrder = await getRepository(AssignedOrders)
          .createQueryBuilder("assignedOrders")
          .leftJoinAndSelect("assignedOrders.drivers", "drivers")
          // .leftJoinAndSelect("assignedOrders.valetVehicle", "valetVehicle")
          .leftJoinAndSelect("assignedOrders.dealership", "dealership")
          .leftJoinAndSelect("assignedOrders.order", "order")
          .where("order.orderId = :orderId", { orderId })
          .getOne();
          console.log('from order id', assignedOrder)
      }

      if (!assignedOrder) {
        throw new ApolloError("Assigned order not found");
      }

      return assignedOrder;
    } catch (error) {
      throw new ApolloError("Failed to get assigned order " + error);
    }
  }
  // on Initiated status, the order is not yet accepted by the driver
  @Mutation(() => AssignedOrders)
  @Authorized()
  async assignOrder(
    @Arg("input")
    {
      order,
      drivers,
      customer,
      status,
      valetVehicleId,
      dealershipId,
    }: AssignOrderInput,
    @Ctx() ctx: MyContext,
    @PubSub("ORDER_ASSIGNED") publish: any
  ) {
    try {
      const orderData = await Order.findOne({ where: { orderId: order } });
      if (!orderData) throw new ApolloError("Order not found");

      if (orderData.orderStatus === OrderStatus.ACCEPTED.valueOf()) {
        throw new ApolloError("Order has already been accepted");
      }

      const assignedByData = await getUser({
        username: (<any>ctx.payload).username,
      });
      if (!assignedByData) throw new ApolloError("Manager not found");

      if (drivers.length === 0) throw new ApolloError("Please select a driver");

      const dvrs = await getRepository(User)
        .createQueryBuilder("user")
        .where("user.userId IN (:...drivers)", { drivers })
        .getMany();

      if (dvrs.length === 0) throw new ApolloError("Driver not found");

      let valetVehicle = null;
      if (orderData.valetVehicleRequest) {
        if (!valetVehicleId) throw new ApolloError("Valet vehicle is requested");
        const valetVehicleData = await CarInfo.findOne({
          where: { carId: valetVehicleId },
        });
        if (!valetVehicleData) throw new ApolloError("Valet vehicle not found");
        if (!valetVehicleData?.available) throw new ApolloError("Car not available");
        valetVehicle = valetVehicleData;
      }

      if (!dealershipId) throw new ApolloError("Dealership ID is required");
      const dealership = await Dealership.findOne({
        where: { dealershipId: dealershipId },
      });
      if (!dealership) throw new ApolloError("Dealership not found");

      const driverData = await Promise.all(dvrs);
      const customerData = await User.findOne({ where: { userId: customer } });
      if (!customerData) throw new ApolloError("Customer not found");

      const getAssignedOrder = await getRepository(AssignedOrders)
        .createQueryBuilder("assignedOrders")
        .leftJoinAndSelect("assignedOrders.order", "order")
        .where("order.orderId = :orderId", { orderId: orderData.orderId })
        .andWhere("assignedOrders.assignStatus = :assignStatus", {
          assignStatus: AssignStatus.INITIATED,
        })
        .getMany();

      if (getAssignedOrder.length > 0) {
        throw new ApolloError("Order has already been assigned");
      }

      const assignedOrder = AssignedOrders.create({
        order: orderData,
        assignedById: assignedByData.userId,
        drivers: driverData,
        customerId: customerData.userId,
        assignStatus: status,
        assignDate: new Date(),
        valetVehicle: valetVehicle as any,
        dealership: dealership as any,
      });

      orderData.orderStatus = OrderStatus.PENDING;
      await orderData.save();
      await assignedOrder.save();

      if (valetVehicle) {
        valetVehicle.available = false;
        await valetVehicle.save();
      }

      await publish(assignedOrder);
      return assignedOrder;
    } catch (error) {
      // console.log(error);
      throw new ApolloError("Failed to assign order" + " " + error);
    }
  }

  // accept pending order
  @Authorized()
  @Mutation(() => AssignedOrders)
  async acceptOrder(
    @Arg("assignId") assignId: string,
    @Ctx() ctx: MyContext,
    @PubSub("ORDER_ASSIGNED") publish: any
  ) {
    try {
      const user = await getUser({ username: (<any>ctx.payload).username });
      if (!user) throw new ApolloError("User not found");

      if (user.accountType !== AccountType.DRIVER.valueOf()) {
        throw new ApolloError("User is not a driver");
      }

      const assignedOrder = await createQueryBuilder(
        AssignedOrders,
        "assignedOrders"
      )
        .leftJoinAndSelect("assignedOrders.order", "order")
        .leftJoinAndSelect("assignedOrders.drivers", "drivers")
        .where("drivers.userId = :userId", { userId: user.userId })
        .andWhere("assignedOrders.assignId = :assignId", {
          assignId: assignId,
        })
        .getOne();

      if (!assignedOrder) throw new ApolloError("Assigned order not found");

      if (assignedOrder.assignStatus !== AssignStatus.PENDING.valueOf()) {
        throw new ApolloError("Order has already been accepted");
      }

      user.order = [...user.order, assignedOrder.order];
      await user.save();

      const order = assignedOrder.order;
      if (!order) throw new ApolloError("Order not found");

      order.orderStatus = OrderStatus.ACCEPTED;
      order.driver = user;
      const getCustomer = await getUser({
        userId: assignedOrder.customerId,
      });
      if (!getCustomer) throw new ApolloError("Customer not found");
      order.customer = getCustomer;
      await order.save();

      assignedOrder.assignStatus = AssignStatus.ACCEPTED;
      assignedOrder.acceptDate = new Date();
      assignedOrder.acceptedById = user.userId;
      await assignedOrder.save();

      return assignedOrder;
    } catch (error) {
      console.error("Failed to accept order:", error);
      throw new ApolloError("Failed to accept order", "ACCEPT_ORDER_ERROR", {
        originalError: error,
      });
    }
  }

  @Authorized()
  @Mutation(() => AssignedOrders)
  async rejectOrder(
    @Arg("assignId") assignId: string,
    @Ctx() ctx: MyContext,
    @PubSub("ORDER_ASSIGNED") publish: any
  ) {
    try {
      const user = await getUser({ username: (<any>ctx.payload).username });
      if (!user) throw new ApolloError("User not found");

      if (user.accountType !== AccountType.DRIVER.valueOf()) {
        throw new ApolloError("User is not a driver");
      }

      const assignedOrder = await AssignedOrders.findOne({
        relations: ["order"],
        where: { assignId: assignId },
      });
      if (!assignedOrder) throw new ApolloError("Assigned order not found");

      if (assignedOrder.assignStatus !== AssignStatus.PENDING.valueOf()) {
        throw new ApolloError("Order has already been accepted");
      }

      if (assignedOrder.rejectedBy.includes(user)) {
        throw new ApolloError("Order has already been rejected");
      }

      if (assignedOrder.rejectedBy.length === 0) {
        assignedOrder.rejectedBy = [user];
      } else {
        assignedOrder.rejectedBy = [...assignedOrder.rejectedBy, user];
      }

      // await publish(assignedOrder);
      return assignedOrder;
    } catch (error) {
      throw new ApolloError("Failed to reject order" + " " + error);
    }
  }

  @Authorized()
  @Query(() => [AssignedOrders])
  async getUnconfirmedOrders(@Ctx() ctx: MyContext) {
    try {
      const user = await getUser({ username: (<any>ctx.payload).username });

      if (!user) {
        throw new ApolloError("User not found");
      }

      if (user.accountType !== AccountType.DRIVER.valueOf()) {
        throw new ApolloError("User is not a driver");
      }

      const assignedOrder = await AssignedOrders.createQueryBuilder(
        "assignedOrders"
      )
        .leftJoinAndSelect("assignedOrders.drivers", "drivers")
        .leftJoinAndSelect("assignedOrders.dealership", "dealership")
        .leftJoinAndSelect("assignedOrders.order", "order")
        .leftJoinAndSelect("assignedOrders.rejectedBy", "rejectedBy")
        .andWhere("assignedOrders.assignStatus = :assignStatus", {
          assignStatus: AssignStatus.PENDING,
        })
        .andWhere("drivers.userId = :userId", { userId: user.userId })
        .getMany();

      if (assignedOrder.length === 0) {
        throw new ApolloError("No orders found");
      }

      // const unconfirmedOrders = assignedOrder.filter((order) => {
      //   return order.drivers.some((driver) => {
      //     return driver.userId === user.userId;
      //   });
      // });

      // if (unconfirmedOrders.length === 0) {
      //   throw new ApolloError("No unconfirmed orders found");
      // }

      // return unconfirmedOrders;
      return assignedOrder;
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        throw new ApolloError(error.message, "USER_NOT_FOUND");
      } else {
        throw new ApolloError(
          "Failed to get unconfirmed orders",
          "INTERNAL_SERVER_ERROR"
        );
      }
    }
  }

  @Authorized()
  @Query(() => [AssignedOrders])
  async getConfirmedOrders(
    @Arg("page") page: number,
    @Arg("perPage") perPage: number,
    @Ctx() ctx: MyContext
  ) {
    try {
      const user = await getUser({ username: (<any>ctx.payload).username });
      if (!user) {
        return new ApolloError("User not found", "USER_NOT_FOUND");
      }
      if (user.accountType !== AccountType.DRIVER.valueOf()) {
        return new ApolloError("User is not a driver", "USER_NOT_DRIVER");
      }

      const [assignedOrders, totalCount] =
        await AssignedOrders.createQueryBuilder("assignedOrders")
          .leftJoinAndSelect("assignedOrders.dealership", "dealership")
          .leftJoinAndSelect("assignedOrders.order", "order")
          .leftJoinAndSelect("assignedOrders.drivers", "drivers")
          .where("assignedOrders.assignStatus = :assignStatus", {
            assignStatus: AssignStatus.ACCEPTED,
          })
          .andWhere("assignedOrders.acceptedById = :userId", {
            userId: user.userId,
          })
          .andWhere("order.orderStatus = :orderStatus", {
            orderStatus: OrderStatus.ACCEPTED,
          })
          .skip((page - 1) * perPage)
          .take(perPage)
          .getManyAndCount();

      console.log(assignedOrders);

      if (assignedOrders.length === 0) {
        return new ApolloError("No assigned orders found", "NO_ORDERS_FOUND");
      }

      return assignedOrders;
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        throw new ApolloError(error.message, "INTERNAL_SERVER_ERROR");
      } else {
        throw new ApolloError(
          "Failed to get confirmed orders",
          "INTERNAL_SERVER_ERROR"
        );
      }
    }
  }

  @Subscription(() => AssignedOrders, {
    topics: "ORDER_ASSIGNED",
    filter: async ({ payload, args, context }) => {
      const decode = await usernameToken(
        context.connectionParams.Authorization
      );
      const user = await getUser({ username: (<any>decode).username });
      console.log(payload);
      if (user?.accountType === AccountType.DRIVER.valueOf()) return true;
      return false;
    },
  })
  async orderAssigned(@Root() assignedOrder: boolean) {
    return assignedOrder;
  }
}
