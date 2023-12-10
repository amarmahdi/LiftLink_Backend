/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
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
import { getRepository } from "typeorm";
import usernameToken from "../helpers/usernameToken";
import { getUser } from "./UserInfo";
import { PaymentIntent } from "../entity/PaymentIntent";
import { createPaymentIntent } from "./PaymentResolver";

export enum AssignType {
  INITIAL = "INITIAL",
  RETURN = "RETURN",
}

interface FetchAssignedOrdersOptions {
  userId?: string;
  accountType?: AccountType;
  assignStatus?: AssignStatus[];
  dealershipId?: string;
  assignId?: string;
  orderId?: string;
  page?: number;
  perPage?: number;
}

export const fetchAssignedOrders = async (
  options: FetchAssignedOrdersOptions,
  getOne: boolean = false
) => {
  try {
    if (options.userId && !options.accountType) {
      throw new Error("Account type is required");
    }

    const queryBuilder = getRepository(AssignedOrders)
      .createQueryBuilder("assignedOrders")
      .leftJoinAndSelect("assignedOrders.order", "order")
      .leftJoinAndSelect("assignedOrders.drivers", "drivers")
      .leftJoinAndSelect("assignedOrders.dealership", "dealership")
      .leftJoinAndSelect("assignedOrders.valetVehicle", "valetVehicle");

    if (
      options.userId &&
      options.accountType === AccountType.DRIVER.valueOf()
    ) {
      queryBuilder.andWhere("drivers.userId = :driverId", {
        driverId: options.userId,
      });
    }

    if (
      options.userId &&
      options.accountType === AccountType.CUSTOMER.valueOf()
    ) {
      queryBuilder.andWhere("assignedOrders.customerId = :customerId", {
        customerId: options.userId,
      });
    }

    if (options.assignStatus) {
      queryBuilder.andWhere(
        "assignedOrders.assignStatus IN (:...assignStatus)",
        {
          assignStatus: options.assignStatus,
        }
      );
    }

    if (options.dealershipId) {
      queryBuilder.andWhere("assignedOrders.dealershipId = :dealershipId", {
        dealershipId: options.dealershipId,
      });
    }

    if (options.assignId) {
      queryBuilder.andWhere("assignedOrders.assignId = :assignId", {
        assignId: options.assignId,
      });
    }

    if (options.orderId) {
      queryBuilder.andWhere("order.orderId = :orderId", {
        orderId: options.orderId,
      });
    }

    if (options.page && options.perPage) {
      queryBuilder
        .skip((options.page - 1) * options.perPage)
        .take(options.perPage);
    }

    return getOne
      ? await queryBuilder.getOne()
      : await queryBuilder.getManyAndCount();
  } catch (error) {
    throw new Error("Failed to fetch assigned orders: " + error.message);
  }
};

// Importing necessary libraries and tools
@Resolver()
export class AssignResolver {
  // Fetch all assigned orders
  @Authorized()
  @Query(() => [AssignedOrders])
  async getAllAssignedOrders(@Ctx() _ctx: MyContext) {
    try {
      // Fetching all assigned orders from the database
      const assignedOrders = await fetchAssignedOrders({});

      // Returning the fetched orders
      return assignedOrders;
    } catch (error) {
      throw new ApolloError("Failed to get assigned orders " + error);
    }
  }

  // // Fetch assigned orders in a dealership
  // @Authorized()
  // @Query(() => [AssignedOrders])
  // async getAssignedOrdersInDealership(
  //   @Arg("dealershipId") dealershipId: string,
  //   @Ctx() ctx: MyContext
  // ) {
  //   try {
  //     // Fetching assigned orders from the database
  //     const assignedOrders = await fetchAssignedOrders({
  //       dealershipId,
  //       assignStatus: [AssignStatus.ASSIGNED],
  //     });

  //     // If no assigned orders are found, throw an ApolloError
  //     if (!assignedOrders) throw new ApolloError("Assigned orders not found");

  //     // Return the fetched orders
  //     return assignedOrders;
  //   } catch (error) {
  //     throw new ApolloError("Failed to get assigned orders");
  //   }
  // }

  // Fetch assigned orders for a user
  @Authorized()
  @Query(() => [AssignedOrders])
  async getAssignedOrders(@Arg("userId") userId: string) {
    try {
      // Fetch the user from the database
      const user = await getUser({ userId });

      // If the user is not found, throw an ApolloError
      if (!user) throw new ApolloError("User not found");

      // Fetch the assigned orders for the user
      const assignedOrder = await fetchAssignedOrders({
        userId,
        accountType: user.accountType as AccountType,
        assignStatus: [
          AssignStatus.PENDING,
          AssignStatus.ASSIGNED,
          AssignStatus.RETURN_ASSIGNED,
        ],
      });

      // If no assigned orders are found, throw an ApolloError
      if (!assignedOrder) throw new ApolloError("Orders not assigned yet!");

      // Return the fetched orders
      return assignedOrder;
    } catch (error) {
      // Log the error and throw an ApolloError
      console.error(error);
      throw new ApolloError("Failed to get assigned orders " + error);
    }
  }

  // This function is used to fetch a specific assigned order
  @Authorized()
  @Query(() => AssignedOrders)
  async getAssignedOrder(
    // The ID of the assigned order or the order
    @Arg("assignId", { nullable: true }) assignId: string,
    @Arg("orderId", { nullable: true }) orderId: string
  ) {
    try {
      // If an assignId is provided, fetch the assigned order with that ID
      if (assignId) {
        const assignedOrder = await fetchAssignedOrders({ assignId }, true);
        if (!assignedOrder) throw new ApolloError("Assigned order not found");
        return assignedOrder;
      }
      // If an orderId is provided, fetch the assigned order with that order ID
      else if (orderId) {
        const assignedOrder = await fetchAssignedOrders({ orderId }, true);
        if (!assignedOrder) throw new ApolloError("Assigned order not found");
        return assignedOrder;
      }
      // If neither assignId nor orderId is provided, throw an error
      else {
        throw new ApolloError("Assign ID or Order ID is required");
      }
    } catch (error) {
      throw new ApolloError("Failed to get assigned order " + error);
    }
  }

  // This mutation is used to assign an order to a driver
  @Mutation(() => AssignedOrders)
  @Authorized()
  async assignOrder(
    // The input data for the order assignment
    @Arg("input")
    {
      order,
      drivers,
      customer,
      valetVehicleId,
      dealershipId,
    }: AssignOrderInput,
    // The type of assignment (pickup or return)
    @Arg("type") type: AssignType,
    // The payment amount for the order (required for return orders)
    @Arg("paymentAmount", { nullable: true }) paymentAmount: string,
    @Arg("paymentIssued", { nullable: true }) paymentIssued: boolean,
    // The context of the request
    @Ctx() ctx: MyContext,
    // The publish function for the ORDER_ASSIGNED subscription
    @PubSub("ORDER_ASSIGNED") publish: any
  ) {
    type = type.toUpperCase() as AssignType;
    // If the assignment type is return, a payment amount is required
    if (paymentIssued && type === AssignType.RETURN.valueOf()) {
      if (!paymentAmount) throw new ApolloError("Payment amount is required");
    }
    try {
      // Fetch the order from the database
      const orderData = await getRepository(Order)
        .createQueryBuilder("order")
        .where("order.orderId = :orderId", { orderId: order })
        .getOne();
      // If the order is not found, throw an error
      if (!orderData) throw new ApolloError("Order not found");
      if (
        orderData.orderStatus === OrderStatus.INITIATED.valueOf() &&
        type === AssignType.RETURN.valueOf()
      ) {
        throw new ApolloError("Order not ready for return");
      }
      // If the order has already been accepted, throw an error
      if (
        orderData.orderStatus ===
        (OrderStatus.ACCEPTED.valueOf() ||
          OrderStatus.RETURN_ACCEPTED.valueOf())
      ) {
        throw new ApolloError("Order has already been accepted");
      }

      // Fetch the manager who is assigning the order
      const assignedByData = await getUser({
        username: (<any>ctx.payload).username,
      });
      // If the manager is not found, throw an error
      if (!assignedByData) throw new ApolloError("Manager not found");

      // If no drivers are selected, throw an error
      if (drivers.length === 0) throw new ApolloError("Please select a driver");

      // Fetch the selected drivers from the database
      const dvrs = await getRepository(User)
        .createQueryBuilder("user")
        .where("user.userId IN (:...drivers)", { drivers })
        .getMany();

      // If no drivers are found, throw an error
      if (dvrs.length === 0) throw new ApolloError("Driver not found");

      // If a valet vehicle is requested and the assignment type is not return,
      // fetch the valet vehicle from the database
      let valetVehicle = null;
      if (
        type !== AssignType.RETURN.valueOf() &&
        orderData.valetVehicleRequest
      ) {
        if (!valetVehicleId)
          throw new ApolloError("Valet vehicle is requested");
        const valetVehicleData = await getRepository(CarInfo)
          .createQueryBuilder("carInfo")
          .leftJoinAndSelect("carInfo.carImage", "carImage")
          .where("carInfo.carId = :carId", { carId: valetVehicleId })
          .getOne();
        // If the valet vehicle data is not found, throw an error
        if (!valetVehicleData) throw new ApolloError("Valet vehicle not found");
        // If the valet vehicle is not available, throw an error
        if (!valetVehicleData?.available)
          throw new ApolloError("Car not available");
        // Set the valet vehicle to the fetched data
        valetVehicle = valetVehicleData;
      }
      // If no dealership ID is provided, throw an error
      if (!dealershipId) throw new ApolloError("Dealership ID is required");
      // Fetch the dealership from the database
      const dealership = await getRepository(Dealership)
        .createQueryBuilder("dealership")
        .where("dealership.dealershipId = :dealershipId", { dealershipId })
        .getOne();
      // If the dealership is not found, throw an error
      if (!dealership) throw new ApolloError("Dealership not found");

      // Fetch the driver data from the database
      const driverData = await Promise.all(dvrs);
      // Fetch the customer data from the database
      const customerData = await getUser({ userId: customer });
      // If the customer is not found, throw an error
      if (!customerData) throw new ApolloError("Customer not found");

      // Fetch the assigned orders from the database
      const getAssignedOrders = await fetchAssignedOrders({
        orderId: orderData.orderId,
        assignStatus: [
          AssignStatus.ACCEPTED,
          AssignStatus.ASSIGNED,
          AssignStatus.COMPLETED,
          AssignStatus.STARTED,
          AssignStatus.CANCELLED,
          AssignStatus.RETURN_ACCEPTED,
          AssignStatus.RETURN_ASSIGNED,
          AssignStatus.RETURN_STARTED,
          AssignStatus.RETURN_CANCELLED,
        ],
      });

      // If the order has already been assigned, throw an error
      if (getAssignedOrders && (getAssignedOrders as any)[1] > 0) {
        throw new ApolloError("Order has already been assigned");
      }

      // Create a new assigned order
      const assignedOrder = AssignedOrders.create({
        order: [orderData],
        assignedById: assignedByData.userId,
        drivers: driverData,
        customerId: customerData.userId,
        assignDate: new Date(),
        dealership: dealership as any,
      });

      if (type === AssignType.RETURN.valueOf()) {
        const getAssignedOrders = await fetchAssignedOrders(
          {
            orderId: orderData.orderId,
          },
          true
        );
        assignedOrder.valetVehicle =
          (getAssignedOrders as any).valetVehicle || null;
      } else {
        assignedOrder.valetVehicle = valetVehicle as any;
      }

      // If the assignment type is return, create a payment intent
      if (type === AssignType.RETURN.valueOf()) {
        if (paymentIssued) {
          const createPayment = await createPaymentIntent(
            Number.parseInt(paymentAmount)
          );
          // If the payment intent is not created, throw an error
          if (!createPayment) throw new ApolloError("Payment not found");

          // Create a new payment intent
          const payment = await PaymentIntent.create({
            amount: createPayment.amount,
            currency: createPayment.currency,
            customer: customerData,
            order: [orderData],
            paymentIntentClientSecret: createPayment.client_secret!,
            paymentIntentId: createPayment.id,
            paymentMethodId: createPayment.payment_method! as string,
            paymentStatus: createPayment.status,
            paymentIntentCreated: new Date(),
          }).save();

          // If the payment intent is not saved, throw an error
          if (!payment) throw new ApolloError("Payment not created");
          assignedOrder.order[0].payment = payment;
        }
        // Update the assigned order and order status
        assignedOrder.assignStatus = AssignStatus.RETURN_ASSIGNED;
        assignedOrder.order[0].orderStatus = OrderStatus.RETURN_ASSIGNED;
        await assignedOrder.save();
        await assignedOrder.order[0].save();
      } else {
        // Set the status of the assigned order to ASSIGNED
        assignedOrder.assignStatus = AssignStatus.ASSIGNED;
        // Set the status of the order to PENDING
        assignedOrder.order[0].orderStatus = OrderStatus.ASSIGNED;
        // Save the assigned order to the database
        await assignedOrder.save();
        // Save the order to the database
        await assignedOrder.order[0].save();
      }
      // If a valet vehicle is assigned
      if (valetVehicle) {
        // Set the availability of the valet vehicle to false
        valetVehicle.available = false;
        // Save the valet vehicle to the database
        await valetVehicle.save();
      }

      // Publish the assigned order to the ORDER_ASSIGNED subscription
      await publish(assignedOrder);
      // Return the assigned order
      return assignedOrder;
    } catch (error) {
      // If an error occurs, throw an ApolloError with the error message
      throw new ApolloError("Failed to assign order" + " " + error);
    }
  }
  // This mutation is used to accept an order by a driver
  @Authorized()
  @Mutation(() => AssignedOrders)
  async acceptOrder(
    // The ID of the assigned order
    @Arg("assignId") assignId: string,
    // The context of the request
    @Ctx() ctx: MyContext
  ) {
    try {
      // Fetch the user who is accepting the order
      const user = await getUser({ username: (<any>ctx.payload).username });
      // If the user is not found, throw an error
      if (!user) throw new ApolloError("User not found");

      // If the user is not a driver, throw an error
      if (user.accountType !== AccountType.DRIVER.valueOf()) {
        throw new ApolloError("User is not a driver");
      }

      // Fetch the assigned order from the database
      const assignedOrder = (await fetchAssignedOrders(
        { assignId },
        true
      )) as AssignedOrders;
      // If the assigned order is not found, throw an error
      if (!assignedOrder) throw new ApolloError("Assigned order not found");

      // If the assigned order has already been accepted, throw an error
      if (
        assignedOrder.assignStatus !== AssignStatus.ASSIGNED.valueOf() &&
        assignedOrder.assignStatus !== AssignStatus.RETURN_ASSIGNED.valueOf()
      ) {
        throw new ApolloError("Order has already been accepted");
      }

      // If the order status is PENDING, add the order to the user's orders and save the user
      if (
        assignedOrder.order[0].orderStatus === OrderStatus.PENDING.valueOf()
      ) {
        user.order = [...user.order, assignedOrder.order[0]];
        await user.save();
      }

      // Fetch the order from the assigned order
      const order = assignedOrder.order[0];
      // If the order is not found, throw an error
      if (!order) throw new ApolloError("Order not found");

      // Set the order status to ACCEPTED, set the driver to the user, fetch the customer from the database, set the customer to the fetched customer, and save the order
      if (assignedOrder.assignStatus === AssignStatus.ASSIGNED.valueOf()) {
        order.orderStatus = OrderStatus.ACCEPTED;
        assignedOrder.assignStatus = AssignStatus.ACCEPTED;
      }
      if (
        assignedOrder.assignStatus === AssignStatus.RETURN_ASSIGNED.valueOf()
      ) {
        order.orderStatus = OrderStatus.RETURN_ACCEPTED;
        assignedOrder.assignStatus = AssignStatus.RETURN_ACCEPTED;
      }
      order.driver = user;
      const getCustomer = await getUser({
        userId: assignedOrder.customerId,
      });
      if (!getCustomer) throw new ApolloError("Customer not found");
      order.customer = getCustomer;
      await order.save();

      // Set the assigned order status to ACCEPTED, set the accept date to the current date, set the accepted by ID to the user's ID, set the drivers to the user, and save the assigned order
      assignedOrder.acceptDate = new Date();
      assignedOrder.acceptedById = user.userId;
      assignedOrder.drivers = [user];
      await assignedOrder.save();

      // Return the assigned order
      return assignedOrder;
    } catch (error) {
      // If an error occurs, log the error and throw an ApolloError with the error message
      console.error("Failed to accept order:" + " " + error);
      throw new Error(error);
    }
  }
  // This mutation is used to reject an order by a driver
  @Authorized()
  @Mutation(() => AssignedOrders)
  async rejectOrder(
    // The ID of the assigned order
    @Arg("assignId") assignId: string,
    // The context of the request
    @Ctx() ctx: MyContext
  ) {
    try {
      // Fetch the user who is rejecting the order
      const user = await getUser({ username: (<any>ctx.payload).username });
      // If the user is not found, throw an error
      if (!user) throw new ApolloError("User not found");

      // If the user is not a driver, throw an error
      if (user.accountType !== AccountType.DRIVER.valueOf()) {
        throw new ApolloError("User is not a driver");
      }

      // Fetch the assigned order from the database
      const assignedOrder = (await fetchAssignedOrders(
        { assignId },
        true
      )) as AssignedOrders;
      // If the assigned order is not found, throw an error
      if (!assignedOrder) throw new ApolloError("Assigned order not found");

      // If the assigned order has already been accepted, throw an error
      if (assignedOrder.assignStatus !== AssignStatus.PENDING.valueOf()) {
        throw new ApolloError("Order has already been accepted");
      }

      // If the user has already rejected the order, throw an error
      if (assignedOrder.rejectedBy.includes(user)) {
        throw new ApolloError("Order has already been rejected");
      }

      // If no one has rejected the order yet, set the rejectedBy field to the user
      // Otherwise, add the user to the rejectedBy field
      if (assignedOrder.rejectedBy.length === 0) {
        assignedOrder.rejectedBy = [user];
      } else {
        assignedOrder.rejectedBy = [...assignedOrder.rejectedBy, user];
      }

      // Return the assigned order
      return assignedOrder;
    } catch (error) {
      // If an error occurs, throw an ApolloError with the error message
      throw new ApolloError("Failed to reject order" + " " + error);
    }
  }
  // This query is used to get all unconfirmed orders for a driver
  @Authorized()
  @Query(() => [AssignedOrders])
  async getUnconfirmedOrders(
    // The context of the request
    @Ctx() ctx: MyContext
  ) {
    try {
      // Fetch the user who is requesting the unconfirmed orders
      const user = await getUser({ username: (<any>ctx.payload).username });
      // If the user is not found, throw an error
      if (!user) {
        throw new ApolloError("User not found");
      }

      // If the user is not a driver, throw an error
      if (user.accountType !== AccountType.DRIVER.valueOf()) {
        throw new ApolloError("User is not a driver");
      }

      // Fetch the assigned orders from the database that are assigned to the user and have a status of ASSIGNED or RETURN_INITIATED
      const assignedOrder = await fetchAssignedOrders({
        userId: user.userId,
        accountType: user.accountType as AccountType,
        assignStatus: [AssignStatus.ASSIGNED, AssignStatus.RETURN_ASSIGNED],
      });

      // If no assigned orders are found, throw an error
      if (!assignedOrder) throw new ApolloError("Assigned order not found");

      // Return the assigned orders
      return (assignedOrder as any)[0];
    } catch (error) {
      // If an error occurs, log the error
      console.error(error);

      // If the error is an instance of Error, throw an ApolloError with the error message and a code of USER_NOT_FOUND
      // Otherwise, throw an ApolloError with a message of "Failed to get unconfirmed orders" and a code of INTERNAL_SERVER_ERROR
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
  // This query is used to get all confirmed orders for a driver
  @Authorized()
  @Query(() => [AssignedOrders])
  async getConfirmedOrders(
    // The page number for pagination
    @Arg("page") page: number,
    // The number of items per page for pagination
    @Arg("perPage") perPage: number,
    // The context of the request
    @Ctx() ctx: MyContext
  ) {
    try {
      // Fetch the user who is requesting the confirmed orders
      const user = await getUser({ username: (<any>ctx.payload).username });
      // If the user is not found, return an ApolloError with a message of "User not found" and a code of USER_NOT_FOUND
      if (!user) {
        return new ApolloError("User not found", "USER_NOT_FOUND");
      }

      // If the user is not a driver, return an ApolloError with a message of "User is not a driver" and a code of USER_NOT_DRIVER
      if (user.accountType !== AccountType.DRIVER.valueOf()) {
        return new ApolloError("User is not a driver", "USER_NOT_DRIVER");
      }

      // Fetch the assigned orders from the database that are assigned to the user and have a status of ACCEPTED, with pagination
      const assignedOrders = await fetchAssignedOrders({
        userId: user.userId,
        accountType: user.accountType as AccountType,
        assignStatus: [AssignStatus.ACCEPTED, AssignStatus.RETURN_ACCEPTED],
        page,
        perPage,
      });

      // If no assigned orders are found, throw an ApolloError with a message of "Assigned order not found"
      if (!assignedOrders) throw new ApolloError("Assigned order not found");

      // Return the assigned orders
      return (assignedOrders as any)[0];
    } catch (error) {
      // If an error occurs, log the error
      console.error(error);

      // If the error is an instance of Error, throw an ApolloError with the error message and a code of INTERNAL_SERVER_ERROR
      // Otherwise, throw an ApolloError with a message of "Failed to get confirmed orders" and a code of INTERNAL_SERVER_ERROR
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
  // This subscription is used to listen for assigned orders
  @Subscription(() => AssignedOrders, {
    // The topic of the subscription is "ORDER_ASSIGNED"
    topics: "ORDER_ASSIGNED",
    // The filter function is used to determine who should receive the subscription data
    filter: async ({ context }) => {
      // Decode the authorization token to get the username
      const decode = await usernameToken(
        context.connectionParams.Authorization
      );
      // Fetch the user from the database using the decoded username
      const user = await getUser({ username: (<any>decode).username });
      // If the user is a driver, return true to send the subscription data to the user
      if (user?.accountType === AccountType.DRIVER.valueOf()) return true;
      // If the user is not a driver, return false to not send the subscription data to the user
      return false;
    },
  })
  // The function that is called when the subscription data is sent
  async orderAssigned(@Root() assignedOrder: boolean) {
    // Return the assigned order
    return assignedOrder;
  }
}
