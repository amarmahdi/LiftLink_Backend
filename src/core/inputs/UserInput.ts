import { InputType, Field } from "type-graphql";
import { AccountType } from "../types/AccountTypes";

@InputType()
export class UserInput {
  @Field()
  username!: string;

  @Field()
  password!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  email!: string;

  @Field()
  phoneNumber!: string;

  @Field()
  accountType!: AccountType;
}
