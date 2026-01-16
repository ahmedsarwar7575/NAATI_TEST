  // app.js
  import express from "express";
  import cors from "cors";
  import { apiRouter } from "./routes/index.js";
  import { notFound, errorHandler } from "./middleware/error.js";
  import { stripeWebhook } from "./controllers/stripe.controller.js";
  import { env } from "./config/env.js";

  export const app = express();

  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://naati-project.vercel.app/",
  ];

  const corsOptions = {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Stripe-Signature"],
  };

  app.use(cors(corsOptions));

  app.options("*", cors(corsOptions));

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
