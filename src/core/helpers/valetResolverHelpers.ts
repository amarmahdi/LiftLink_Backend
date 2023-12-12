/* eslint-disable @typescript-eslint/no-explicit-any */
import { getConnection, getRepository } from "typeorm";
import { Order, OrderStatus } from "../entity/Order";
import { getUser } from "../resolvers/UserInfo";
import { AssignStatus, AssignedOrders } from "../entity/AssignedOrder";
import { Valet, ValetStatus } from "../entity/Valet";
import { ValetInput } from "../inputs/ValetInput";
import { User } from "../entity/User";
import { Dealership } from "../entity/Dealership";
import { CarInfo } from "../entity/CarInfo";
import { VehicleCheck } from "../entity/VehicleCheck";
import { AccountType } from "../types/AccountTypes";

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

export class ValetResolverHelpers {
  async getUserById(userId: string) {
    const user = await getUser({ userId });
    if (!user) throw new Error("User not found");
    return user;
  }

  async getOrderById(orderId: string) {
    const order = await getRepository(Order)
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.customer", "customer")
      .leftJoinAndSelect("order.vehicle", "vehicle")
      .leftJoinAndSelect("order.serviceType", "serviceType")
      .leftJoinAndSelect("order.dealership", "dealership")
      .where("order.orderId = :orderId", { orderId })
      .getOne();
    if (!order) throw new Error("Order not found");
    return order;
  }

  async getAssignedOrderById(orderId: string) {
    const assignedOrder = await getRepository(AssignedOrders)
      .createQueryBuilder("assignedOrder")
      .leftJoinAndSelect("assignedOrder.order", "order")
      .where("order.orderId = :orderId", { orderId })
      .getOne();
    if (!assignedOrder) throw new Error("Assigned order not found");
    return assignedOrder;
  }

  async createQueryBuilderWithCommonJoins(alias: string) {
    return getRepository(Valet)
      .createQueryBuilder(alias)
      .leftJoinAndSelect(`${alias}.customer`, "customer")
      .leftJoinAndSelect("customer.profilePicture", "profilePicture")
      .leftJoinAndSelect(`${alias}.dealership`, "dealership")
      .leftJoinAndSelect(`${alias}.order`, "order")
      .leftJoinAndSelect("order.vehicle", "vehicle")
      .leftJoinAndSelect(`${alias}.driver`, "driver")
      .leftJoinAndSelect(
        `${alias}.customerVehiclChecks`,
        "customerVehiclChecks"
      )
      .leftJoinAndSelect(`${alias}.valetVehicleChecks`, "valetVehicleChecks");
  }

  async getValetById(valetId: string, driverId?: string) {
    let query = (await this.createQueryBuilderWithCommonJoins("valet"))
      .leftJoinAndSelect("order.driver", "driver")
      .where("valet.valetId = :valetId", { valetId });

    if (driverId) {
      query = query.andWhere("driver.userId = :driverId", { driverId });
    }

    const valet = await query.getOne();
    if (!valet) throw new Error("Valet not found");
    return valet;
  }

  async createValetFun(inputs: ValetInput, customer: User, driver: User) {
    const valetStatuses = [
      ValetStatus.COMPLETED,
      ValetStatus.CANCELLED,
      ValetStatus.IN_PROGRESS,
      ValetStatus.RETURN_IN_PROGRESS,
    ];

    const existsInCustomer = await (
      await this.createQueryBuilderWithCommonJoins("valet")
    )
      .where("valet.customer.userId = :userId", { userId: customer.userId })
      .andWhere("valet.valetStatus IN (:...valetStatus)", {
        valetStatus: valetStatuses,
      })
      .getMany();

    if (existsInCustomer.length > 0) {
      throw new Error(
        `Valet already in ${existsInCustomer[0].valetStatus} state`
      );
    }

    if (driver.isOnService) throw new Error("Driver is on service");

    const [dealership, order, valetExists] = await Promise.all([
      getRepository(Dealership).findOne((inputs as any).dealershipId),
      getRepository(Order).findOne((inputs as any).orderId),
      (await this.createQueryBuilderWithCommonJoins("valet"))
        .where("order.orderId = :orderId", { orderId: inputs.orderId })
        .getOne(),
    ]);

    if (!dealership) throw new Error("Dealership not found");
    if (!order) throw new Error("Order not found");
    if (valetExists) throw new Error("Valet already exists");

    const requiredInputs = [
      "frontImage",
      "backImage",
      "leftImage",
      "rightImage",
      "mileage",
      "gasLevel",
    ];
    for (const input of requiredInputs) {
      if (!(inputs as any)[input]) throw new Error(`Please provide ${input}`);
    }

    const queryRunner = getConnection().createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const createValet = Valet.create({
        comments: inputs.comments,
        customer: customer,
        dealership: dealership,
        driver: driver,
        order: order,
        createdAt: new Date(),
        valetStatus: ValetStatus.VALET_VEHICLE_PICK_UP,
      });

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
  async updateValetState(
    valet: Valet,
    state: string,
    date: Date,
    inputs: ValetInput
  ) {
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
      valet.driver.isOnService = false;
      await valet.driver.save();
    }
    if (state === ValetStatus.CUSTOMER_RETURN_STARTED.valueOf()) {
      valet.returnStartTime = date;
    }
    if (state === ValetStatus.CUSTOMER_RETURN_COMPLETED.valueOf()) {
      valet.returnEndTime = date;
      await this.updateAssignedOrderAndVehicle(valet);
    }
    valet.valetStatus = state.toUpperCase() as ValetStatus;
    valet.updatedAt = date;
  }

  async getVehicleById(vehicleId: string): Promise<CarInfo | undefined> {
    const vehicleRepository = getRepository(CarInfo);
    const vehicle = await vehicleRepository.findOne(vehicleId as any);
    return vehicle as CarInfo;
  }

  async updateAssignedOrderAndVehicle(valet: Valet) {
    const order = await this.getOrderById((valet as any).orderId);
    const assignedOrder = await this.getAssignedOrderById(
      (valet as any).orderId
    );

    assignedOrder.assignStatus = AssignStatus.COMPLETED;
    await assignedOrder.save();

    order.orderStatus = OrderStatus.COMPLETED;
    order.updatedDate = new Date();
    await order.save();

    if (valet.order.valetVehicleRequest) {
      const vehicle = await this.getVehicleById((valet.order as any).vehicleId);
      (vehicle as any).available = true;
      await (vehicle as any).save();
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

  async valetExistsFun(orderId: string) {
    const valetExists = await (
      await this.createQueryBuilderWithCommonJoins("valet")
    )
      .leftJoinAndSelect("order.vehicle", "vehicle")
      .where("order.orderId = :orderId", { orderId })
      .getOne();
    if (!valetExists) throw new Error("Valet not found");
    return valetExists;
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

  async getStartedDriverValets(
    driverId: string,
    statuses: string[]
  ): Promise<Valet[]> {
    const queryBuilder = await this.createQueryBuilderWithCommonJoins("valet");
    return queryBuilder
      .where("valet.driver.userId = :driver", { driver: driverId })
      .andWhere("valet.valetStatus IN (:...valetStatus)", {
        valetStatus: statuses,
      })
      .orderBy("valet.createdAt", "DESC")
      .getMany();
  }
}
