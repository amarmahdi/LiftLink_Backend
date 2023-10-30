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

  @Field({ nullable: true})
  @Column({ nullable: true})
  servicePackagePrice!: string;

  @Field({ nullable: true})
  @Column({ nullable: true})
  servicePackageDuration!: string;

  @Field({ nullable: true})
  @Column({ nullable: true})
  servicePackageType!: string;

  @Field()
  @Column()
  dealershipId!: string;

  @Field(() => Dealership, { nullable: true })
  @ManyToOne(() => Dealership, (dealership) => dealership.servicePackages)
  dealership!: Dealership;
}
