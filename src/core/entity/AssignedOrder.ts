import { Field, ObjectType } from "type-graphql";
import {
  Entity,
  BaseEntity,
  PrimaryGeneratedColumn,
  OneToOne,
  Column,
  OneToMany,
  ManyToMany,
  JoinTable,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Order } from "./Order";
import { User } from "./User";
import { CarInfo } from "./CarInfo";
import { Dealership } from "./Dealership";

export enum AssignStatus {
  INITIATED = "initiated",
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  RETURN = "return",
  STARTED = "started",
  CANCELLED = "cancelled",
  COMPLETED = "completed",
}

@ObjectType()
@Entity()
export class AssignedOrders extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn("uuid")
  assignId!: string;

  @Field()
  @Column({ nullable: true })
  assignedById!: string;

  @Field(() => Order, { nullable: true })
  @OneToOne(() => Order, (order) => order.orderId, {
    nullable: true,
    eager: true,
  })
  @JoinColumn()
  order!: Order;

  @Field(() => [User], { nullable: true })
  @ManyToMany(() => User, (user) => user.userId, {
    eager: true,
    nullable: true,
    createForeignKeyConstraints: false,
  })
  @JoinTable()
  drivers!: User[];

  @Field()
  @Column({ nullable: true })
  acceptedById!: string;

  @Field(() => [User], { nullable: true })
  @ManyToMany(() => User, (user) => user.userId, {
    eager: true,
    nullable: true,
    createForeignKeyConstraints: false,
  })
  @JoinTable()
  rejectedBy!: User[];

  @Field({ nullable: true })
  @Column({ nullable: true })
  customerId!: string;

  @Field()
  @Column({ nullable: true })
  assignDate!: Date;

  @Field({ nullable: true })
  @Column({ type: "enum", enum: AssignStatus, default: AssignStatus.INITIATED })
  assignStatus!: AssignStatus;

  @Field({ nullable: true })
  @Column({ nullable: true })
  acceptDate!: Date;

  @Field({ nullable: true })
  @Column({ nullable: true })
  rejectDate!: Date;

  @Field(() => CarInfo, { nullable: true })
  @OneToMany(() => CarInfo, (carInfo) => carInfo.assignedOrders, {
    nullable: true,
  })
  valetVehicle!: CarInfo;

  @Field(() => Dealership, { nullable: true })
  @ManyToOne(() => Dealership, (dealership) => dealership.assignedOrders, {
    nullable: true,
  })
  dealership!: Dealership;
}
