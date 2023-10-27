import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  BaseEntity,
} from "typeorm";
import { User } from "./User";
import { ObjectType, Field } from "type-graphql";
import { Valet } from "./Valet";

@ObjectType()
@Entity()
export class VehicleCheck extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn("uuid")
  vehicleCheckId!: string;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.checks)
  user!: User;

  @Field({ nullable: true })
  @Column({ nullable: true })
  vehicleCheckStatus!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  frontImage!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  backImage!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  leftImage!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  rightImage!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  checkInTime!: Date;

  @Field({ nullable: true })
  @Column({ nullable: true })
  checkOutTime!: Date;

  @Field({ nullable: true })
  @Column({ nullable: true })
  mileage!: number;

  @Field({ nullable: true })
  @Column({ nullable: true })
  gasLevel!: number;

  // @Field(() => Valet, { nullable: true })
  // @ManyToOne(() => Valet, (valet) => valet.customerVehiclChecks, {
  //   eager: true,
  //   createForeignKeyConstraints: false,
  //   nullable: true,
  // })
  // customerVehicleChecks!: Valet;

  // @Field(() => Valet, { nullable: true })
  // @ManyToOne(() => Valet, (valet) => valet.valetVehicleChecks, {
  //   eager: true,
  //   createForeignKeyConstraints: false,
  //   nullable: true,
  // })
  // valetVehicleChecks!: Valet;
}
