import { InputType, Field } from "type-graphql";

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
  accountType!: string;
}
