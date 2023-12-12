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
import { MyContext } from "../helpers/MyContext";
import { OrderStatus } from "../entity/Order";
import { AssignOrderInput } from "../inputs/AssignOrderInput";
import usernameToken from "../helpers/usernameToken";
import { getUser } from "./UserInfo";
import { AssignResolverHelpers } from "../helpers/assignResolverHelpers";

export enum AssignType {
  INITIAL = "INITIAL",
  RETURN = "RETURN",
}

const Helpers = new AssignResolverHelpers();

// Importing necessary libraries and tools
@Resolver()
export class AssignResolver {
  // Fetch all assigned orders
  @Authorized()
  @Query(() => [AssignedOrders])
  async getAllAssignedOrders(@Ctx() _ctx: MyContext) {
    try {
      // Fetching all assigned orders from the database
      const assignedOrders = await Helpers.fetchAssignedOrders({});

      // Returning the fetched orders
      return assignedOrders;
    } catch (error) {
      throw new ApolloError("Failed to get assigned orders " + error);
    }
  }

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
      const assignedOrder = await Helpers.fetchAssignedOrders({
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
        const assignedOrder = await Helpers.fetchAssignedOrders(
          { assignId },
          true
        );
        if (!assignedOrder) throw new ApolloError("Assigned order not found");
        return assignedOrder;
      }
      // If an orderId is provided, fetch the assigned order with that order ID
      else if (orderId) {
        const assignedOrder = await Helpers.fetchAssignedOrders(
          { orderId },
          true
        );
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
  // AssignResolver.ts
  @Mutation(() => AssignedOrders)
  @Authorized()
  async assignOrder(
    @Arg("input") input: AssignOrderInput,
    @Arg("type") type: AssignType,
    @Arg("paymentAmount", { nullable: true }) paymentAmount: string,
    @Arg("paymentIssued", { nullable: true }) paymentIssued: boolean,
    @Ctx() ctx: MyContext,
    @PubSub("ORDER_ASSIGNED") publish: any
  ) {
    try {
      const { order, drivers, customer, valetVehicleId, dealershipId } = input;
      type = type.toUpperCase() as AssignType;

      Helpers.validatePayment(paymentIssued, type, paymentAmount);

      const orderData = await Helpers.fetchOrder(order);
      Helpers.validateOrder(orderData, type);

      const assignedByData = await Helpers.fetchUser((<any>ctx.payload).userId);
      Helpers.validateUser(assignedByData, "User not found");

      Helpers.validateDrivers(drivers as any, "Please select a driver");

      const dvrs = await Helpers.fetchDrivers(drivers);
      Helpers.validateDriversData(dvrs, "Driver not found");

      const valetVehicle = await Helpers.fetchValetVehicle(valetVehicleId);

      const dealership = await Helpers.fetchDealership(dealershipId);

      const driverData = await Promise.all(dvrs);
      const customerData = await Helpers.fetchUser(customer);
      Helpers.validateUser(customerData, "Customer not found");

      const getAssignedOrders = await Helpers.fetchAssignedOrders({
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

      Helpers.validateAssignedOrders(
        getAssignedOrders as any,
        "Order has already been assigned"
      );

      const assignedOrder = await Helpers.createAssignedOrder({
        orderData,
        assignedByData,
        driverData,
        customerData,
        dealership,
        type,
        valetVehicle,
        paymentAmount,
        paymentIssued,
      });

      await publish(assignedOrder);
      return assignedOrder;
    } catch (error) {
      throw new ApolloError("Failed to assign order" + " " + error);
    }
  }

  @Authorized()
  @Mutation(() => AssignedOrders)
  async acceptOrder(@Arg("assignId") assignId: string, @Ctx() ctx: MyContext) {
    try {
      const username = (<any>ctx.payload).username;
      const user = await Helpers.validateUserAcceptOrder(
        username,
        "User not found",
        AccountType.DRIVER
      );

      const assignedOrder = await Helpers.validateAssignedOrder(
        assignId,
        "Assigned order not found",
        [
          AssignStatus.ASSIGNED.valueOf(),
          AssignStatus.RETURN_ASSIGNED.valueOf(),
        ],
        "Order has already been accepted"
      );

      Helpers.validateOrderForAssignOrders(
        assignedOrder.order[0],
        "Order not found"
      );

      const order = assignedOrder.order[0];

      if (order.orderStatus === OrderStatus.ASSIGNED.valueOf()) {
        if (user.order && user.order.length > 0) {
          user.order = [...user.order, order];
        } else {
          user.order = [order];
        }
        await user.save();
      }

      const statusMap = {
        [AssignStatus.ASSIGNED.valueOf()]: OrderStatus.ACCEPTED,
        [AssignStatus.RETURN_ASSIGNED.valueOf()]: OrderStatus.RETURN_ACCEPTED,
      };

      const assignedOrderStatusMap = {
        [AssignStatus.ASSIGNED.valueOf()]: AssignStatus.ACCEPTED,
        [AssignStatus.RETURN_ASSIGNED.valueOf()]: AssignStatus.RETURN_ACCEPTED,
      };

      order.orderStatus = statusMap[assignedOrder.assignStatus];
      assignedOrder.assignStatus =
        assignedOrderStatusMap[assignedOrder.assignStatus];
      order.driver = user;

      const getCustomer = await getUser({ userId: assignedOrder.customerId });
      if (!getCustomer) throw new ApolloError("Customer not found");
      order.customer = getCustomer;
      await order.save();

      assignedOrder.acceptDate = new Date();
      assignedOrder.acceptedById = user.userId;
      assignedOrder.drivers = [user];
      await assignedOrder.save();

      return assignedOrder;
    } catch (error) {
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
      const assignedOrder = (await Helpers.fetchAssignedOrders(
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
      const assignedOrder = await Helpers.fetchAssignedOrders({
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
    // @Arg("page") page: number,
    // // The number of items per page for pagination
    // @Arg("perPage") perPage: number,
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
      const assignedOrders = await Helpers.fetchAssignedOrders({
        userId: user.userId,
        accountType: user.accountType as AccountType,
        assignStatus: [AssignStatus.ACCEPTED, AssignStatus.RETURN_ACCEPTED],
        // page,
        // perPage,
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
