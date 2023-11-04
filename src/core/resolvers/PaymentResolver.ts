import { Arg, Mutation, Resolver } from "type-graphql";
import { PaymentIntent } from "../entity/PaymentIntent";
import Stripe from "stripe";
import { getUser } from "./UserInfo";
import { getRepository } from "typeorm";
import { Order } from "../entity/Order";
import { User } from "../entity/User";
const stripe = new Stripe(
  "sk_test_51O867pHXB7vtaAnHoaysucLCxo7kEQmHhHJGJIzzRtHQUneBb1y84m9seTm9YyYpONvg7M7Kthz8zp0ONdD454I500hTLP9ea0"
);

export const createPaymentIntent = async (amount: number) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "cad",
      metadata: { integration_check: "accept_a_payment" },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return paymentIntent;
  } catch (error) {
    console.error("Error creating payment intent FROM CREATE INTENT: ", error);
    throw new Error("Error creating payment intent");
  }
};

export const confirmPaymentIntent = async (paymentIntentId: string) => {
  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    console.error("Error confirming payment intent FROM CONFIRM: ", error);
    throw new Error("Error confirming payment intent");
  }
};

export const createPaymentDbEntry = async (
  paymentIntent: Stripe.PaymentIntent,
  user: User,
  order: Order,
) => {
  try {
    const clientSecret = paymentIntent.client_secret;
    const paymentIntentId = paymentIntent.id;
    const paymentMethodId = paymentIntent.payment_method;
    const paymentStatus = paymentIntent.status;
    const currency = paymentIntent.currency;

    // console.log({
    //   paymentIntentId,
    //   paymentMethodId: paymentMethodId! as string,
    //   paymentStatus,
    //   paymentIntentClientSecret: clientSecret!,
    //   amount: paymentIntent.amount,
    //   currency,
    //   customer: user,
    //   order: [order],
    // });
    

    const payment = await PaymentIntent.create({
      paymentIntentId,
      paymentMethodId: paymentMethodId! as string,
      paymentStatus,
      paymentIntentClientSecret: clientSecret!,
      amount: paymentIntent.amount,
      currency,
      customer: user,
      order: [order],
    }).save();

    return payment;
  } catch (error) {
    console.error("Error creating payment intent FROM DB: ", error);
    throw new Error("Error creating payment intent");
  }
};

@Resolver()
export class PaymentResolver {
  @Mutation(() => PaymentIntent)
  async createPaymentIntent(
    @Arg("amount") amount: number,
    @Arg("userId") userId: string,
    @Arg("orderId") orderId: string
  ) {
    try {
      const user = await getUser({ userId });
      if (!user) {
        throw new Error("User not found!");
      }

      const order = await getRepository(Order)
        .createQueryBuilder("order")
        .where("order.orderId = :orderId", { orderId })
        .getOne();
      if (!order) {
        throw new Error("Order not found!");
      }

      const paymentIntent = await createPaymentIntent(amount);

      const payment = await createPaymentDbEntry(paymentIntent, user, order);

      return payment;
    } catch (error) {
      console.error("Error creating payment intent: ", error);
      throw new Error("Error creating payment intent");
    }
  }
}
