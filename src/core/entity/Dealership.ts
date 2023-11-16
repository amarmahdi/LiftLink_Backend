import { Entity, PrimaryGeneratedColumn, Column, OneToMany, BaseEntity } from "typeorm";
import { ObjectType, Field } from "type-graphql";
import { CarInfo } from "./CarInfo";
import { ServicePackages } from "./ServicePackages";
import { Order } from "./Order";
import { AssignedOrders } from "./AssignedOrder";
import { Valet } from "./Valet";

@ObjectType()
@Entity()
export class Dealership extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn('uuid')
  dealershipId!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipName!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipPhoneNumber!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipEmail!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipAddress!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipCity!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipState!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipZipCode!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipCountry!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipWebsite!: string;


  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipLogo!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipDescription!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipHours!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipLatitude!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipLongitude!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipType!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipRating!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipReviews!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dealershipAverageRating!: string;

  @Field()
  @Column({ default: false})
  active!: boolean;

  @Field(() => [CarInfo], { nullable: true })
  @OneToMany(() => CarInfo, carInfo => carInfo.dealership, { nullable: true })
  car!: CarInfo[];

  @Field(() => [ServicePackages], { nullable: true })
  @OneToMany(() => ServicePackages, servicePackages => servicePackages.dealership, { nullable: true })
  servicePackages!: ServicePackages[];

  @Field(() => [Order], { nullable: true })
  @OneToMany(() => Order, order => order.dealership, { nullable: true })
  order!: Order[];

  @Field(() => [AssignedOrders], { nullable: true })
  @OneToMany(() => AssignedOrders, assignedOrders => assignedOrders.dealership, { nullable: true })
  assignedOrders!: AssignedOrders[];

  @Field(() => [Valet], { nullable: true })
  @OneToMany(() => Valet, valet => valet.dealership, { nullable: true })
  valets!: Valet[];

  @Field()
  @Column()
  createdBy!: string;
}
