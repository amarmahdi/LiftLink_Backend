import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
  ManyToOne,
  ManyToMany,
  BaseEntity,
  JoinColumn,
} from "typeorm";
import { User } from "./User";
import { Dealership } from "./Dealership";
import { ObjectType, Field } from "type-graphql";
import { VehicleCheck } from "./VehicleCheck";
import { Order } from "./Order";

export enum ValetStatus {
  IN_PROGRESS = "IN_PROGRESS",
  NOT_STARTED = "NOT_STARTED",
  CUSTOMER_VEHICLE_PICK_UP = "CUSTOMER_VEHICLE_PICK_UP",
  CUSTOMER_VEHICLE_DROP_OFF = "CUSTOMER_VEHICLE_DROP_OFF",
  VALET_VEHICLE_PICK_UP = "VALET_VEHICLE_PICK_UP",
  VALET_VEHICLE_DROP_OFF = "VALET_VEHICLE_DROP_OFF",
  DEALERSHIP_TO_CUSTOMER_STARTED = "DEALERSHIP_TO_CUSTOMER_STARTED",
  DEALERSHIP_TO_CUSTOMER_COMPLETED = "DEALERSHIP_TO_CUSTOMER_COMPLETED",
  CUSTOMER_TO_DEALERSHIP_STARTED = "CUSTOMER_TO_DEALERSHIP_STARTED",
  CUSTOMER_TO_DEALERSHIP_COMPLETED = "CUSTOMER_TO_DEALERSHIP_COMPLETED",
  CUSTOMER_RETURN_STARTED = "CUSTOMER_RETURN_STARTED",
  CUSTOMER_RETURN_COMPLETED = "CUSTOMER_RETURN_COMPLETED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

@ObjectType()
@Entity()
export class Valet extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn("uuid")
  valetId!: string;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.driverValets)
  driver!: User;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.customerValets)
  customer!: User;

  @Field(() => Dealership)
  @ManyToOne(() => Dealership, (dealership) => dealership.valets)
  dealership!: Dealership;

  @Field(() => VehicleCheck, { nullable: true })
  @OneToOne(() => VehicleCheck, (vehicleCheck) => vehicleCheck.vehicleCheckId, {
    nullable: true,
  })
  @JoinColumn()
  customerVehiclChecks!: VehicleCheck;

  @Field(() => VehicleCheck, { nullable: true })
  @OneToOne(() => VehicleCheck, (vehicleCheck) => vehicleCheck.vehicleCheckId, {
    nullable: true,
  })
  @JoinColumn()
  valetVehicleChecks!: VehicleCheck;

  @Field({ nullable: true })
  @OneToOne(() => Order, (order) => order.orderId, {
    nullable: true,
  })
  @JoinColumn()
  order!: Order;

  @Field({ nullable: true })
  @Column({ type: "enum", enum: ValetStatus, default: ValetStatus.NOT_STARTED })
  valetStatus!: ValetStatus;

  @Field({ nullable: true })
  @Column({ nullable: true})
  valetPickUpTime!: Date;

  @Field({ nullable: true })
  @Column({ nullable: true})
  valetDropOffTime!: Date;

  @Field({ nullable: true })
  @Column({ nullable: true})
  customerPickUpTime!: Date;

  @Field({ nullable: true })
  @Column({ nullable: true})
  customerDropOffTime!: Date;

  @Field({ nullable: true })
  @Column({ nullable: true})
  comments!: string;

  @Field({ nullable: true })
  @Column({ nullable: true})
  createdAt!: Date;

  @Field({ nullable: true })
  @Column({ nullable: true})
  updatedAt!: Date;
}
