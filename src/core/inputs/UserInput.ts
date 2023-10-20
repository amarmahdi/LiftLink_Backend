import { InputType, Field } from "type-graphql";
import { AccountType } from "../types/AccountTypes";

@InputType()
export class UserInput {
  @Field()
  username!: string;

  @Field()
  password!: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field()
  email!: string;

  @Field({ nullable: true })
  phoneNumber?: string;

  @Field()
  accountType!: AccountType;
}
