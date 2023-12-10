import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  BaseEntity,
  ManyToOne
} from "typeorm";
import { ObjectType, Field } from "type-graphql";
import { User } from "./User";
import { CarInfo } from "./CarInfo";
import { ServicePackages } from "./ServicePackages";
import { Dealership } from "./Dealership";
import { PaymentIntent } from "./PaymentIntent";
import { AssignedOrders } from "./AssignedOrder";

export enum OrderStatus {
  INITIATED = "INITIATED",
  RETURN_INITIATED = "RETURN_INITIATED",
  ASSIGNED = "ASSIGNED",
  RETURN_ASSIGNED = "RETURN_ASSIGNED",
  PENDING = "PENDING",
  RETURN_PENDING = "RETURN_PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  RETURN_IN_PROGRESS = "RETURN_IN_PROGRESS",
  ACCEPTED = "ACCEPTED",
  RETURN_ACCEPTED = "RETURN_ACCEPTED",
  DECLINED = "DECLINED",
  RETURN_DECLINED = "RETURN_DECLINED",
  CANCELLED = "CANCELLED",
  RETURN_CANCELLED = "RETURN_CANCELLED",
  COMPLETED = "COMPLETED",
}

@ObjectType()
@Entity()
export class Order extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn("uuid")
  orderId!: string;

  @Field(() => User, { nullable: true })
  @ManyToOne(() => User, (user) => user.order, {
    nullable: true,
  })
  customer!: User;

  @Field(() => User, { nullable: true })
  @ManyToOne(() => User, (user) => user.order, {
    nullable: true,
  })
  driver!: User;

  @Field()
  @Column()
  orderDeliveryDate!: Date;

  @Field()
  @Column()
  pickupLocation!: string;

  @Field(() => ServicePackages, { nullable: true })
  @OneToOne(() => ServicePackages, (service) => service.servicePackageId, {
    eager: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn()
  serviceType!: ServicePackages;

  @Field()
  @Column()
  notes!: string;

  @Field(() => PaymentIntent, { nullable: true })
  @ManyToOne(() => PaymentIntent, (payment) => payment.order, {
    createForeignKeyConstraints: false,
  })
  payment!: PaymentIntent;

  @Field(() => CarInfo, { nullable: true })
  @ManyToOne(() => CarInfo, (carInfo) => carInfo.order, {
    nullable: true,
  })
  vehicle!: CarInfo;

  @Field({ nullable: true })
  @Column({ nullable: true })
  orderStatus!: OrderStatus;

  @Field(() => Dealership, { nullable: true })
  @ManyToOne(() => Dealership, (dealership) => dealership.dealershipId, {
    eager: true,
    createForeignKeyConstraints: false,
  })
  dealership!: Dealership;

  @Field(()=> AssignedOrders, { nullable: true })
  @ManyToOne(() => AssignedOrders, (assignedOrders) => assignedOrders.order, {
    createForeignKeyConstraints: false,
    nullable: true,
  })
  assigned!: AssignedOrders;

  @Field({ nullable: true })
  @Column({ default: false })
  valetVehicleRequest!: boolean;

  @Field()
  @Column()
  createdDate!: Date;

  @Field({ nullable: true })
  @Column({ nullable: true , default: new Date()})
  updatedDate!: Date;
}
