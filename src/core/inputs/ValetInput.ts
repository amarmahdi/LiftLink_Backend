import { InputType, Field } from "type-graphql";

@InputType()
export class ValetInput {
  @Field({ nullable: true })
  customerId?: string;

  @Field({ nullable: true })
  dealershipId?: string;

  @Field({ nullable: true })
  orderId?: string;

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
