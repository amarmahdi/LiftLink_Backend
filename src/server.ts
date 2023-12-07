import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { json } from "body-parser";
import cors from "cors";
import { buildSchema } from "type-graphql";
import { createConnection } from "typeorm";
import { authChecker } from "./core/helpers/authChecker";
import {
  HelloResolver,
  CarInfoResolver,
  UploadProfilePicture,
  OrderResolver,
  UserResolver,
  AssignResolver,
  UserInfoResolver,
  DealershipResolver,
  ConfirmationResolver,
  ServicePackageResolver,
  PaymentResolver,
  LicenseResolver,
} from "./core/resolvers/index";
import dotenv from "dotenv";
import { ValetResolver } from "./core/resolvers/ValetResolver";
dotenv.config();

(async () => {
  const app = express();
  const httpServer = createServer(app);
  const wsServer = new WebSocketServer({
    server: httpServer,
  });
  await createConnection()
    .then(() => {
      console.log("Connected to database");
    })
    .catch((err) => {
      console.log(err);
    });
  const schema = await buildSchema({
    resolvers: [
      HelloResolver,
      CarInfoResolver,
      UploadProfilePicture,
      OrderResolver,
      UserResolver,
      AssignResolver,
      UserInfoResolver,
      DealershipResolver,
      ConfirmationResolver,
      ServicePackageResolver,
      ValetResolver,
      PaymentResolver,
      LicenseResolver,
    ],
    validate: false,
    authChecker,
  });
  const serverCleanup = useServer(
    {
      schema,
      // onConnect: async (ctx) => {
      //   console.log("Connected to websocket")
      // },
      // onSubscribe: async (ctx, msg) => {
      //   console.log("Subscribed to websocket")
      // },
      // onOperation: async (ctx, msg, args, op) => {
      //   console.log("Operation")
      // },
      // onNext: async (msg, args, value) => {
      //   console.log("Next")
      // },
      // onError: async (msg, args, err) => {
      //   console.log("Error")
      // },
      // onComplete: async (msg, args) => {
      //   console.log("Complete")
      // },
      // onDisconnect: async (msg) => {
      //   console.log("Disconnected from websocket")
      // },
      context: async ({ connectionParams }) => ({ connectionParams }),
    },
    wsServer
  );
  const server = new ApolloServer({
    schema,
    introspection: true,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });
  await server.start();
  app.get("/", (_req, res) => {
    res.send("Hello World");
  });
  app.use(
    "/graphql",
    cors<cors.CorsRequest>(),
    json(),
    expressMiddleware(server, {
      context: async ({ req, res }) => ({ req, res }),
    })
  );
  const PORT = 8000;
  httpServer.listen(PORT, () => {
    console.log(`Server is now running on http://localhost:${PORT}/graphql`);
  });
})();
