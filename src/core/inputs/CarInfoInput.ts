import { InputType, Field } from "type-graphql";
import { CarType } from "../entity/CarInfo";

@InputType()
export class CarInfoInput {
  @Field()
  carName!: string;
  
  @Field()
  carModel!: string;

  @Field()
  carColor!: string;

  @Field()
  plateNumber!: string;

  @Field()
  carVin!: string;

  @Field()
  carType!: CarType;

  @Field()
  carImage!: string;

  @Field()
  status!: string;

  @Field()
  carMake!: string;

  @Field()
  carYear!: string;

  @Field()
  available!: boolean;

  @Field()
  mileage?: string;

  @Field()
  carInsurance!: string;

  @Field()
  carRegistration!: string;
}