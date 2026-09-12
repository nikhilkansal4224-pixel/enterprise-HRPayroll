import "dotenv/config";
import { buildApp } from "./app";

const app = buildApp();

const port = Number(process.env.PORT ?? 4000);

app
  .listen({ port, host: "0.0.0.0" })
  .then((address) => {
    app.log.info(`hr-service listening at ${address}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
