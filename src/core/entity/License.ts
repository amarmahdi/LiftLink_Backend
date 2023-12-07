import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BaseEntity,
} from "typeorm";
import { ObjectType, Field } from "type-graphql";

@ObjectType()
@Entity()
export class License extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn("uuid")
  licenseId!: string;

  @Field()
  @Column({ nullable: true })
  licenseNumber!: string;

  @Field()
  @Column({ nullable: true })
  licenseState!: string;

  @Field()
  @Column({ nullable: true })
  licenseExpiration!: string;

  @Field()
  @Column({ nullable: true })
  licenseImageFront!: string;

  @Field()
  @Column({ nullable: true })
  licenseImageBack!: string;

  @Field()
  @Column()
  userId!: string;

  @Field()
  @Column({ nullable: true, default: false })
  verified!: boolean;
}