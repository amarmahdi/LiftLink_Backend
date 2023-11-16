import { InputType, Field } from "type-graphql";

@InputType()
export class AssignOrderInput {
  @Field()
  order!: string;

  @Field(() => [String], { nullable: true })
  drivers!: string[];

  @Field()
  customer!: string;

  @Field({ nullable: true })
  valetVehicleId!: string;

  @Field({ nullable: true })
  dealershipId!: string;
}
