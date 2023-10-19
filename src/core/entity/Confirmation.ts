import {
  Entity,
  OneToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  BaseEntity,
  Column,
} from "typeorm";
import { ObjectType, Field, registerEnumType } from "type-graphql";
import { User } from "./User";
import { Dealership } from "./Dealership";

export enum ConfirmationStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  REJECTED = "REJECTED",
}

registerEnumType(ConfirmationStatus, {
  name: "ConfirmationStatus",
  description: "Status of the user dealership confirmation",
});

@ObjectType()
@Entity()
export class UserDealershipConfirmation extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn("uuid")
  confirmationId!: string;

  @Field(() => User)
  @OneToOne(() => User, (user) => user.userId, {
    eager: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn()
  user!: User;

  @Field(() => Dealership)
  @OneToOne(() => Dealership, (dealership) => dealership.dealershipId, {
    eager: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn()
  dealership!: Dealership;

  @Field()
  @Column({ default: new Date() })
  confirmationDate!: Date;

  @Field(() => ConfirmationStatus)
  @Column({ default: ConfirmationStatus.PENDING })
  confirmationStatus!: ConfirmationStatus;

  @Field({ nullable: true })
  @Column({ nullable: true })
  updatedAt!: Date;
}
