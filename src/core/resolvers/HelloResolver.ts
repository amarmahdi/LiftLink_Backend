import { Query, Resolver, Subscription, Root, Authorized } from "type-graphql";

@Resolver()
export class HelloResolver {
  @Query(() => String)
  async hello() {
    return "Hello World!";
  }

  @Authorized()
  @Subscription(() => String, {
    subscribe: async function* () {
      for await (const word of ["Hello", "Bonjour", "Ciao"]) {
        setInterval(() => {
        }, 3000);
        yield { hello: word };
      }
    },
  })
  async helloWorld(
    @Root() helloPayload: { hello: string }
  ) {
    return helloPayload.hello;
  }

  @Query(() => Boolean)
  async ping() {
    return true;
  }
}
