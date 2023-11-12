import {
  BaseEntity,
  Column,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from "typeorm";
import { ObjectType, Field } from "type-graphql";
import { CarInfo } from "./CarInfo";

@ObjectType()
@Entity()
export class VehicleImage extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  @Field()
  imageId!: string;

  @Column()
  @Field()
  imageLink!: string;

  @Field(() => CarInfo, { nullable: true })
  @OneToOne(() => CarInfo, (carInfo) => carInfo.carId)
  @JoinColumn()
  car!: CarInfo;
}
