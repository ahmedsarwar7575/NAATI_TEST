import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/error.js";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/v1", apiRouter);

app.use(notFound);
app.use(errorHandler);
