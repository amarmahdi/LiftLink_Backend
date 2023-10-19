import { Dealership } from "./Dealership";
import { Field, ObjectType } from "type-graphql";
import {
  Entity,
  BaseEntity,
  Column,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

@ObjectType()
@Entity()
export class ServicePackages extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn("uuid")
  servicePackageId!: string;

  @Field()
  @Column()
  servicePackageName!: string;

  @Field()
  @Column()
  servicePackageDescription!: string;

  @Field()
  @Column()
  servicePackagePrice!: string;

  @Field()
  @Column()
  servicePackageDuration!: string;

  @Field()
  @Column()
  servicePackageType!: string;

  @Field()
  @Column()
  dealershipId!: string;

  @Field(() => Dealership, { nullable: true })
  @ManyToOne(() => Dealership, (dealership) => dealership.servicePackages)
  dealership!: Dealership;
}
