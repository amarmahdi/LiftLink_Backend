import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, OneToOne, JoinColumn, OneToMany, ManyToOne } from 'typeorm';
import { ObjectType, Field } from 'type-graphql';
import { VehicleImage } from './VehicleImage';
import { User } from './User';
import { Dealership } from './Dealership';
import { AssignedOrders } from './AssignedOrder';
import { Order } from './Order';

export enum CarType {
  LOANER = 'loaner',
  CUSTOMER = 'customer',
}

@ObjectType()
@Entity()
export class CarInfo extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  @Field({ nullable: true })
  carId!: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  carName!: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  carModel!: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  carColor!: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  plateNumber!: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  carVin!: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  carType!: CarType;

  @Field({ nullable: true })
  @OneToOne(() => VehicleImage, vehicleImage => vehicleImage.imageId, { eager: true, createForeignKeyConstraints: false, nullable: true })
  @JoinColumn()
  carImage?: VehicleImage;

  @Column({ nullable: true })
  @Field({ nullable: true })
  status!: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  carMake!: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  carYear!: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  available!: boolean;

  @Column({ nullable: true })
  @Field({ nullable: true })
  mileage!: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  carInsurance!: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  carRegistration!: string;

  @Field(() => User, { nullable: true })
  @ManyToOne(() => User, user => user.car, { nullable: true })
  user!: User;

  @Field(() => Dealership, { nullable: true })
  @ManyToOne(() => Dealership, user => user.car, { nullable: true })
  dealership!: Dealership;

  @Field({ nullable: true })
  @Column({ nullable: true })
  createdDate!: Date;

  @Field({ nullable: true })
  @Column({ nullable: true })
  updatedDate!: Date;

  @Field(() => [AssignedOrders], { nullable: true })
  @OneToMany(() => AssignedOrders, assignedOrders => assignedOrders.valetVehicle, { nullable: true })
  assignedOrders!: AssignedOrders[];

  @Field(() => [Order], { nullable: true })
  @OneToMany(() => Order, order => order.vehicle, { nullable: true })
  order!: Order[];
}