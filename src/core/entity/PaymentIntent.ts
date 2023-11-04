import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  BaseEntity,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { ObjectType, Field } from "type-graphql";
import { User } from "./User";
import { Order } from "./Order";

// export enum PaymentStatus {
//   INITIATED = "INITIATED",
//   FAILED = "FAILED",
//   SUCCEEDED = "SUCCEEDED",
// }

@ObjectType()
@Entity()
export class PaymentIntent extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn("uuid")
  paymentId!: string;

  @Field(() => User, { nullable: true })
  @ManyToOne(() => User, (user) => user.paymentIntent, {
    nullable: true,
  })
  customer!: User;

  @Field(() => [Order], { nullable: true })
  @OneToMany(() => Order, (order) => order.payment, {
    createForeignKeyConstraints: false,
    nullable: true,
  })
  order!: Order[];

  @Field()
  @Column()
  amount!: number;

  @Field()
  @Column()
  currency!: string;

  @Field()
  @Column()
  paymentStatus!: string;

  @Field()
  @Column()
  paymentIntentId!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  paymentMethodId!: string;

  @Field()
  @Column()
  paymentIntentClientSecret!: string;

  @Field()
  @Column({ default: new Date() })
  paymentIntentCreated!: Date;
}
