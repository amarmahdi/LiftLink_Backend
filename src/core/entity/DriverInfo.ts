import { Entity, Column, OneToOne, JoinColumn, BaseEntity, PrimaryGeneratedColumn } from "typeorm";
import { Field, ObjectType } from "type-graphql";
import { User } from "./User";

@ObjectType()
@Entity()
export class DriverInfo extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  driverId!: string;

  @Field(() => User)
  @OneToOne(() => User, (user) => user.userId)
  @JoinColumn()
  user!: User;

  @Field()
  @Column()
  licenseNumber!: string;

  @Field()
  @Column()
  licenseExpiry!: Date;

  @Field()
  @Column()
  licenseState!: string;

  @Field()
  @Column()
  licenseCountry!: string;

  @Field()
  @Column()
  licenseImage!: string;

  @Field()
  @Column()
  licenseStatus!: string;

  @Field()
  @Column()
  licenseVerified!: boolean;

  // @Field()
  // @Column()
  // licenseVerifiedBy!: string;

  // @Field()
  // @Column()
  // licenseVerifiedDate!: Date;

  // @Field()
  // @Column()
  // licenseVerifiedNotes!: string;

  // @Field()
  // @Column()
  // licenseVerifiedImage!: string;

  // @Field()
  // @Column()
  // licenseVerifiedStatus!: string;

  // @Field()
  // @Column()
  // licenseVerifiedExpiry!: Date;

  // @Field()
  // @Column()
  // licenseVerifiedCountry!: string;

  // @Field()
  // @Column()
  // licenseVerifiedState!: string;
}
  