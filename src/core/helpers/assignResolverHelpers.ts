/* eslint-disable @typescript-eslint/no-explicit-any */
import { getRepository } from "typeorm";
import { AssignStatus, AssignedOrders } from "../entity/AssignedOrder";
import { AssignType } from "../resolvers/AssignResolver";
import { AccountType } from "../types/AccountTypes";
import { Order, OrderStatus } from "../entity/Order";
import { ApolloError } from "apollo-server-core";
import { User } from "../entity/User";
import { CarInfo } from "../entity/CarInfo";
import { Dealership } from "../entity/Dealership";
import { getUser } from "../resolvers/UserInfo";
import { createPaymentIntent } from "../resolvers/PaymentResolver";
import { PaymentIntent } from "../entity/PaymentIntent";

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

export class AssignResolverHelpers {
  validatePayment(
    paymentIssued: boolean,
    type: AssignType,
    paymentAmount: string
  ) {
    if (paymentIssued && type === "RETURN" && !paymentAmount) {
      throw new Error(
        "Payment amount is required for return orders when payment is issued"
      );
    }
  }

  async fetchOrder(orderId: string) {
    const orderRepository = getRepository(Order);
    const order = await orderRepository
      .createQueryBuilder("order")
      .where("order.orderId = :orderId", { orderId })
      .getOne();
    if (!order) {
      throw new Error(`Order with id ${orderId} not found`);
    }
    return order;
  }

  validateOrder(orderData: Order, type: AssignType) {
    if (!orderData) {
      throw new ApolloError("Order not found");
    }
    if (
      orderData.orderStatus === OrderStatus.INITIATED.valueOf() &&
      type === AssignType.RETURN.valueOf()
    ) {
      throw new ApolloError("Order not ready for return");
    }
    if (
      [
        OrderStatus.ACCEPTED.valueOf() || OrderStatus.RETURN_ACCEPTED.valueOf(),
      ].includes(orderData.orderStatus)
    ) {
      throw new ApolloError("Order has already been accepted");
    }
  }

  validateOrderForAssignOrders(orderData: Order, errorMessage: string) {
    if (!orderData) {
      throw new ApolloError(errorMessage);
    }
    if (orderData.orderStatus !== OrderStatus.ASSIGNED.valueOf()) {
      throw new ApolloError("Order is not in ASSIGNED status");
    }
  }

  async fetchUser(userId: string) {
    const userRepository = getRepository(User);
    const user = await userRepository
      .createQueryBuilder("user")
      .where("user.userId = :userId", { userId })
      .getOne();
    if (!user) {
      throw new ApolloError("User not found");
    }
    return user;
  }

  validateUser(user: User, errorMessage: string) {
    if (!user) {
      throw new ApolloError(errorMessage);
    }
  }

  validateDrivers(drivers: User[], errorMessage: string) {
    if (drivers.length === 0) {
      throw new ApolloError(errorMessage);
    }
  }

  async fetchDrivers(drivers: string[]) {
    const userRepository = getRepository(User);
    const driverData = await userRepository
      .createQueryBuilder("user")
      .where("user.userId IN (:...drivers)", { drivers })
      .getMany();
    if (driverData.length === 0) {
      throw new ApolloError("Driver not found");
    }
    return driverData;
  }

  validateDriversData(driversData: User[], errorMessage: string) {
    if (driversData.length === 0) {
      throw new ApolloError(errorMessage);
    }
  }

  async fetchValetVehicle(valetVehicleId: string) {
    const carInfoRepository = getRepository(CarInfo);
    const valetVehicleData = await carInfoRepository
      .createQueryBuilder("carInfo")
      .leftJoinAndSelect("carInfo.carImage", "carImage")
      .where("carInfo.carId = :carId", { carId: valetVehicleId })
      .getOne();
    if (!valetVehicleData) {
      throw new ApolloError("Valet vehicle not found");
    }
    return valetVehicleData;
  }

  async fetchDealership(dealershipId: string) {
    const dealershipRepository = getRepository(Dealership);
    const dealership = await dealershipRepository
      .createQueryBuilder("dealership")
      .where("dealership.dealershipId = :dealershipId", { dealershipId })
      .getOne();
    if (!dealership) {
      throw new ApolloError("Dealership not found");
    }
    return dealership;
  }

  validateAssignedOrders(
    assignedOrders: AssignedOrders[],
    errorMessage: string
  ) {
    if (assignedOrders.length === 0) {
      throw new ApolloError(errorMessage);
    }
  }
  async validateAssignedOrder(
    assignId: string,
    notFoundMessage: string,
    validStatuses: string[],
    invalidStatusMessage: string
  ) {
    const assignedOrder = (await this.fetchAssignedOrders(
      { assignId },
      true
    )) as AssignedOrders;
    if (!assignedOrder) {
      throw new ApolloError(notFoundMessage);
    }
    if (!validStatuses.includes(assignedOrder.assignStatus)) {
      throw new ApolloError(invalidStatusMessage);
    }
    return assignedOrder;
  }

  async validateUserAcceptOrder(
    username: string,
    errorMessage: string,
    accountType: AccountType
  ): Promise<User> {
    const user = await getUser({ username });
    if (!user) {
      throw new ApolloError(errorMessage);
    }
    if (user.accountType !== accountType.valueOf()) {
      throw new ApolloError(`User is not a ${accountType}`);
    }
    return user;
  }

  async createAssignedOrder({
    orderData,
    assignedByData,
    driverData,
    customerData,
    dealership,
    type,
    valetVehicle,
    paymentAmount,
    paymentIssued,
  }: {
    orderData: Order;
    assignedByData: User;
    driverData: User[];
    customerData: User;
    dealership: Dealership;
    type: AssignType;
    valetVehicle: CarInfo | null;
    paymentAmount: string;
    paymentIssued: boolean;
  }) {
    const assignedOrder = AssignedOrders.create({
      order: [orderData],
      assignedById: assignedByData.userId,
      drivers: driverData,
      customerId: customerData.userId,
      assignDate: new Date(),
      dealership: dealership as any,
    });

    if (type === AssignType.RETURN.valueOf()) {
      if (paymentIssued) {
        const createPayment = await createPaymentIntent(
          Number.parseInt(paymentAmount)
        );
        if (!createPayment) throw new ApolloError("Payment not found");

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

        if (!payment) throw new ApolloError("Payment not created");
        assignedOrder.order[0].payment = payment;
      }
      assignedOrder.assignStatus = AssignStatus.RETURN_ASSIGNED;
      assignedOrder.order[0].orderStatus = OrderStatus.RETURN_ASSIGNED;
      await assignedOrder.save();
      await assignedOrder.order[0].save();
    } else {
      assignedOrder.assignStatus = AssignStatus.ASSIGNED;
      assignedOrder.order[0].orderStatus = OrderStatus.ASSIGNED;
      await assignedOrder.save();
      await assignedOrder.order[0].save();
    }

    if (valetVehicle) {
      valetVehicle.available = false;
      await valetVehicle.save();
    }

    return assignedOrder;
  }

  async fetchAssignedOrders(
    options: FetchAssignedOrdersOptions,
    getOne: boolean = false
  ) {
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
  }
}
