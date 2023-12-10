/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Resolver,
  Query,
  Mutation,
  Subscription,
  Arg,
  Ctx,
  PubSub,
  Root,
  Authorized,
} from "type-graphql";
import { Order, OrderStatus } from "../entity/Order";
import { OrderInput } from "../inputs/OrderInput";
import { User } from "../entity/User";
import { MyContext } from "../helpers/MyContext";
import { AccountType } from "../types/AccountTypes";
import usernameToken from "../helpers/usernameToken";
import { CarInfo } from "../entity/CarInfo";
import { ServicePackages } from "../entity/ServicePackages";
import { Dealership } from "../entity/Dealership";
import { getRepository } from "typeorm";
import { getUser } from "./UserInfo";

@Resolver()
export class OrderResolver {
  @Mutation(() => Order)
  @Authorized()
  async createOrder(
    @Arg("input")
    {
      orderDeliveryDate,
      serviceTypeId,
      pickupLocation,
      notes,
      vehicleId,
      dealershipId,
      valetVehicleRequest,
    }: OrderInput,
    @Ctx() { payload }: MyContext,
    @PubSub("ORDER_CREATED") publish: any
  ) {
    try {
      const customerObj = await getRepository(User)
        .createQueryBuilder("user")
        .where("user.username = :username", {
          username: (<any>payload).username,
        })
        .andWhere("user.accountType = :accountType", {
          accountType: AccountType.CUSTOMER,
        })
        .getOne();

      if (!customerObj) {
        throw new Error("User not found!");
      }

      if (customerObj.accountType !== AccountType.CUSTOMER.valueOf()) {
        throw new Error("User is not a customer!");
      }

      if (!vehicleId) {
        throw new Error("Vehicle is required!");
      }

      if (!serviceTypeId) {
        throw new Error("Service type is required!");
      }

      if (!orderDeliveryDate) {
        throw new Error("Order delivery date is required!");
      }

      if (!pickupLocation) {
        throw new Error("Pickup location is required!");
      }

      if (!notes) {
        throw new Error("Notes are required!");
      }

      if (!dealershipId) {
        throw new Error("Dealership is required!");
      }

      if (valetVehicleRequest === undefined) {
        throw new Error("Valet vehicle request is required!");
      }

      const dealership = await getRepository(Dealership)
        .createQueryBuilder("dealership")
        .where("dealership.dealershipId = :dealershipId", { dealershipId })
        .getOne();

      if (!dealership) {
        throw new Error("Dealership not found!");
      }

      const serviceType = await getRepository(ServicePackages)
        .createQueryBuilder("serviceType")
        .where("serviceType.servicePackageId = :serviceTypeId", {
          serviceTypeId,
        })
        .getOne();

      if (!serviceType) {
        throw new Error("Service package not found!");
      }

      const vehicleObj = await getRepository(CarInfo)
        .createQueryBuilder("vehicle")
        .leftJoinAndSelect("vehicle.user", "user")
        .leftJoinAndSelect("vehicle.carImage", "carImage")
        .where("vehicle.carId = :vehicleId", { vehicleId })
        .getOne();

      if (!vehicleObj) {
        throw new Error("Vehicle not found!");
      }

      if (vehicleObj.user.userId !== customerObj.userId) {
        throw new Error("Vehicle does not belong to user!");
      }

      const order = await getRepository(Order)
        .createQueryBuilder("order")
        .leftJoinAndSelect("order.customer", "customer")
        .leftJoinAndSelect("order.vehicle", "vehicle")
        .where("customer.userId = :userId", { userId: customerObj.userId })
        .andWhere("vehicle.carId = :vehicleId", { vehicleId })
        .andWhere("order.orderStatus IN (:...orderStatus)", {
          orderStatus: [
            OrderStatus.CANCELLED,
            OrderStatus.COMPLETED,
          ],
        })
        .getOne();

      if (
        order &&
        order.orderStatus !== OrderStatus.CANCELLED &&
        order.orderStatus !== OrderStatus.COMPLETED
      ) {
        throw new Error("Order already exists!");
      }

      const orderCreate = await Order.create({
        orderDeliveryDate,
        serviceType,
        pickupLocation,
        notes,
        customer: customerObj,
        vehicle: vehicleObj,
        dealership,
        valetVehicleRequest,
        orderStatus: OrderStatus.INITIATED,
        createdDate: new Date(),
      }).save();

      await publish(orderCreate);

      return orderCreate;
    } catch (error) {
      throw new Error("Failed to create order " + error);
    }
  }

  @Subscription(() => Order, {
    topics: "ORDER_CREATED",
    filter: async ({ context }) => {
      try {
        const decodedPayload = await usernameToken(
          context.connectionParams.Authorization
        );
        const user = await getUser({
          username: (<any>decodedPayload).username,
        });
        if (
          user?.accountType === AccountType.ADMIN.valueOf() ||
          user?.accountType === AccountType.MANAGER.valueOf()
        ) {
          return true;
        } else {
          throw new Error("User is not authorized to perform this action");
        }
      } catch (error) {
        console.error(error);
        throw new Error("An error occurred while processing the request");
      }
    },
  })
  async orderCreated(@Root() order: Order) {
    return order;
  }

  @Authorized()
  @Query(() => [Order])
  async getOrders(@Arg("dealershipId") dealershipId: string) {
    const orders = await getRepository(Order)
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.customer", "customer")
      .leftJoinAndSelect("order.vehicle", "vehicle")
      .leftJoinAndSelect("order.serviceType", "serviceType")
      .leftJoinAndSelect("order.dealership", "dealership")
      .where("dealership.dealershipId = :dealershipId", { dealershipId })
      .orderBy("order.createdDate", "DESC")
      .getMany();
    return orders;
  }

  @Authorized()
  @Query(() => Order)
  async getOrder(@Arg("id") id: string) {
    try {
      if (id === "") {
        throw new Error("Order id is required");
      }

      const order = getRepository(Order)
        .createQueryBuilder("order")
        .leftJoinAndSelect("order.customer", "customer")
        .leftJoinAndSelect("customer.profilePicture", "profilePicture")
        .leftJoinAndSelect("order.vehicle", "vehicle")
        .leftJoinAndSelect("vehicle.carImage", "carImage")
        .leftJoinAndSelect("order.serviceType", "serviceType")
        .leftJoinAndSelect("order.dealership", "dealership")
        .where("order.orderId = :orderId", { orderId: id });

      const orderResult = await order.getOne();

      // if (orderResult!.driver !== null) {
      //   const orderWithDriver = await getRepository(Order)
      //     .createQueryBuilder("order")
      //     .leftJoinAndSelect("order.customer", "customer")
      //     .leftJoinAndSelect("customer.profilePicture", "profilePicture")
      //     .leftJoinAndSelect("order.vehicle", "vehicle")
      //     .leftJoinAndSelect("vehicle.carImage", "carImage")
      //     .leftJoinAndSelect("order.serviceType", "serviceType")
      //     .leftJoinAndSelect("order.dealership", "dealership")
      //     .leftJoinAndSelect("order.driver", "driver")
      //     .leftJoinAndSelect("driver.profilePicture", "driverProfilePicture")
      //     .where("order.orderId = :orderId", { orderId: id })
      //     .andWhere("driverProfilePicture.isCurrent = :isCurrent", {
      //       isCurrent: true,
      //     })
      //     .getOne();

      //   return orderWithDriver;
      // } else {
      return orderResult;
      // }
    } catch (err) {
      console.error(err);
      throw new Error("Failed to get order");
    }
  }

  @Authorized()
  @Query(() => [Order])
  async getOrdersByUser(@Ctx() { payload }: MyContext) {
    try {
      const user = await getUser({ username: (<any>payload).username });

      if (!user) {
        throw new Error("User not found!");
      }

      const orders = await getRepository(Order)
        .createQueryBuilder("order")
        .leftJoinAndSelect("order.customer", "customer")
        .leftJoinAndSelect("customer.profilePicture", "profilePicture")
        .leftJoinAndSelect("order.vehicle", "vehicle")
        .leftJoinAndSelect("vehicle.carImage", "carImage")
        .leftJoinAndSelect("order.serviceType", "serviceType")
        .leftJoinAndSelect("order.dealership", "dealership")
        .where("customer.userId = :userId", { userId: user.userId })
        .orderBy("order.createdDate", "DESC")
        .getMany();

      return orders;
    } catch (error) {
      console.error(error);
      throw new Error("Failed to get orders");
    }
  }
}
