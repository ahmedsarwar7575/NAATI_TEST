import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { adminRouter } from "./admin.routes.js";
import { usersRouter } from "./users.routes.js";
import { contentRouter } from "./content.routes.js";
import examsRoutes from "./exams.routes.js";
import mocktest from "./mockTest.js";
export const apiRouter = Router();
import stripeRouter from "./stripe.routes.js";
import TransactionRoute from "./transaction.routes.js";
import subscriptionStatus from "./subscriptionStatus.routes.js";
import contatUsRoutes from "./contactMessages.routes.js";

apiRouter.get("/health", (req, res) => res.json({ success: true }));

apiRouter.use("/auth", authRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/content", contentRouter);
apiRouter.use("/exams", examsRoutes);
apiRouter.use("/mocktest", mocktest);
apiRouter.use("/stripe", stripeRouter);
apiRouter.use("/transaction", TransactionRoute);
apiRouter.use("/subscriptions", subscriptionStatus);
apiRouter.use("/contact", contatUsRoutes);