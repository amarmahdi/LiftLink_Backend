import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BaseEntity,
  OneToOne,
  JoinColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from "typeorm";
import { ObjectType, Field } from "type-graphql";
import { CarInfo } from "./CarInfo";
import { Address } from "./Address";
import { ProfilePicture } from "./ProfilePicture";
import { Dealership } from "./Dealership";
import { Token } from "./Tokens";
import { sign } from "crypto";
import { SignOptions } from "jsonwebtoken";
import { Order } from "./Order";
import { VehicleCheck } from "./VehicleCheck";
import { Valet } from "./Valet";
import { PaymentIntent } from "./PaymentIntent";

@ObjectType()
@Entity()
export class User extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn("uuid")
  userId!: string;

  @Field()
  @Column({ unique: true })
  username!: string;

  @Column()
  password!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  firstName!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  lastName!: string;

  @Field()
  @Column({ unique: true, nullable: true })
  email!: string;

  @Field(() => [ProfilePicture], { nullable: true })
  @OneToMany(() => ProfilePicture, (profilePicture) => profilePicture.user, {
    eager: true,
    createForeignKeyConstraints: false,
    nullable: true,
  })
  profilePicture!: ProfilePicture[];

  @Field({ nullable: true })
  @Column({ unique: false, nullable: true })
  phoneNumber!: string;

  @Field(() => String)
  @Column()
  accountType!: string;

  @Field(() => [CarInfo], { nullable: true })
  @OneToMany(() => CarInfo, (carInfo) => carInfo.user, {
    eager: true,
    createForeignKeyConstraints: false,
    nullable: true,
  })
  car!: CarInfo[];

  @Field({ nullable: true })
  @OneToOne(() => Address, (address) => address.addressId, {
    eager: true,
    createForeignKeyConstraints: false,
    nullable: true,
  })
  @JoinColumn()
  address!: Address;

  @Field()
  @Column({ default: new Date() })
  dateJoined!: Date;

  @Field({ nullable: true })
  @Column({ nullable: true })
  lastLogin!: Date;

  @Field()
  @Column()
  isActive!: boolean;

  @Field()
  @Column()
  isStaff!: boolean;

  @Field()
  @Column()
  isSuperuser!: boolean;

  @Field()
  @Column({ default: false })
  isVerified!: boolean;

  @OneToMany(() => Token, (token) => token.user, {
    eager: true,
    createForeignKeyConstraints: false,
    nullable: true,
  })
  tokens!: Token[];

  @Field({ nullable: true })
  @Column({ nullable: true })
  isDealership!: boolean;

  @Field(() => [Dealership], { nullable: true })
  @ManyToMany(() => Dealership, (dealership) => dealership.dealershipId, {
    eager: true,
    createForeignKeyConstraints: false,
    nullable: true,
  })
  @JoinTable()
  dealerships!: Dealership[];

  @Field(() => [Order], { nullable: true })
  @OneToMany(() => Order, (order) => order.customer, {
    eager: true,
    createForeignKeyConstraints: false,
    nullable: true,
  })
  order!: Order[];

  @Field(() => [VehicleCheck], { nullable: true })
  @OneToMany(() => VehicleCheck, (vehicleCheck) => vehicleCheck.user, {
    eager: true,
    createForeignKeyConstraints: false,
    nullable: true,
  })
  checks!: VehicleCheck[];

  @Field(() => [Valet], { nullable: true })
  @OneToMany(() => Valet, (valet) => valet.driver, {
    eager: true,
    createForeignKeyConstraints: false,
    nullable: true,
  })
  driverValets!: Valet[];

  @Field(() => [Valet], { nullable: true })
  @OneToMany(() => Valet, (valet) => valet.customer, {
    eager: true,
    createForeignKeyConstraints: false,
    nullable: true,
  })
  customerValets!: Valet[];

  @Field()
  @Column({ default: false })
  isOnService!: boolean;

  @Field()
  @Column()
  createdAt!: Date;

  @Field(() => [PaymentIntent], { nullable: true })
  @OneToMany(() => PaymentIntent, (paymentIntent) => paymentIntent.customer, {
    eager: true,
    createForeignKeyConstraints: false,
    nullable: true,
  })
  paymentIntent!: PaymentIntent[];

  generateAccessToken() {
    const payload = {
      userId: this.userId,
      username: this.username,
    };

    const encoder = new TextEncoder();
    const secret = encoder.encode(process.env.ACCESS_TOKEN_SECRET!);
    const options: SignOptions = {
      expiresIn: "1s",
    };
    const accessToken = sign(JSON.stringify(payload), secret, options as never);

    return accessToken;
  }
}
