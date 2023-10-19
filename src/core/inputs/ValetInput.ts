import { InputType, Field } from "type-graphql";

@InputType()
export class ValetInput {
  @Field()
  customerId!: string;

  @Field()
  dealershipId!: string;

  @Field()
  orderId!: string;

  @Field()
  frontImage!: string;

  @Field()
  backImage!: string;

  @Field()
  leftImage!: string;

  @Field()
  rightImage!: string;

  @Field()
  mileage!: number;

  @Field()
  gasLevel!: number;

  @Field()
  comments!: string;

  @Field()
  userType!: string;
}
