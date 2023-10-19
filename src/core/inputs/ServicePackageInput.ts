import { InputType, Field } from "type-graphql";

@InputType()
export class ServicePackageInput {
  @Field()
  servicePackageName!: string;

  @Field()
  servicePackageDescription!: string;

  @Field()
  servicePackagePrice!: string;

  @Field()
  servicePackageDuration!: string;

  @Field()
  servicePackageType!: string;

  @Field()
  dealershipId!: string;
}