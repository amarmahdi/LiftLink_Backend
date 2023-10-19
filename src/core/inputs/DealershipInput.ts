import { InputType, Field } from "type-graphql";
import { Dealership } from "../entity/Dealership";

@InputType()
export class DealershipInput implements Partial<Dealership> {
  @Field({ nullable: true })
  dealershipName!: string;

  @Field({ nullable: true })
  dealershipPhoneNumber!: string;

  @Field({ nullable: true })
  dealershipEmail!: string;

  @Field({ nullable: true })
  dealershipAddress!: string;

  @Field({ nullable: true })
  dealershipCity!: string;

  @Field({ nullable: true })
  dealershipState!: string;

  @Field({ nullable: true })
  dealershipZipCode!: string;

  @Field({ nullable: true })
  dealershipCountry!: string;

  @Field({ nullable: true })
  dealershipWebsite!: string;

  @Field({ nullable: true })
  dealershipLogo!: string;

  @Field({ nullable: true })
  dealershipDescription!: string;

  @Field({ nullable: true })
  dealershipHours!: string;
}