import { Field, InputType } from "type-graphql";

@InputType()
export class OrderInput {
  @Field()
  orderDeliveryDate!: Date;

  @Field()
  serviceTypeId!: string;

  @Field()
  pickupLocation!: string;

  @Field()
  notes!: string;

  @Field()
  vehicleId!: string;

  @Field()
  dealershipId!: string;

  @Field()
  valetVehicleRequest!: boolean;
}