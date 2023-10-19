import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, BaseEntity } from "typeorm";
import { ObjectType, Field } from "type-graphql";

@ObjectType()
@Entity()
export class Address extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn('uuid')
  addressId!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  street!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  city!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  state!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  zipCode!: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  country!: string;
}