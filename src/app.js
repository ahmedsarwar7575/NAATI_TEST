import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/error.js";
import { stripeWebhook } from "./controllers/stripe.controller.js";

export const app = express();

app.use(cors());
app.options("*", cors());

app.options("/api/v1/stripe/webhook", cors());

app.post(
  "/api/v1/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/v1", apiRouter);

app.use(notFound);
app.use(errorHandler);
