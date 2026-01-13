import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function createCheckoutSession(req, res) {
  try {
    const { type, userId, customerId } = req.body;
    let priceId;
    if (type === "one"){
      priceId = process.env.STRIPE_MONTHLY_PRICE_ID;
    }
    if (type === "two"){
      priceId = process.env.STRIPE_TWO_MONTHLY_PRICE_ID;
    }
    if (type === "three"){
      priceId = process.env.STRIPE_THREE_MONTHLY_PRICE_ID;
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/cancel`,
      client_reference_id: userId ? String(userId) : undefined,
      metadata: userId ? { userId: String(userId) } : undefined,
      customer: customerId || undefined
    });

    return res.status(200).json({
      sessionId: session.id,
      url: session.url
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function verifyCheckoutSession(req, res) {
  try {
    const sessionId = req.query.session_id || req.body.sessionId || req.body.session_id;
    if (!sessionId) return res.status(400).json({ error: "session_id required" });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"]
    });

    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 10 });

    const subscription = session.subscription && typeof session.subscription === "object"
      ? session.subscription
      : null;

    const paid =
      session.status === "complete" &&
      (session.payment_status === "paid" ||
        (subscription && (subscription.status === "active" || subscription.status === "trialing")));

    return res.status(200).json({
      paid,
      session: {
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        customer: session.customer && typeof session.customer === "object" ? session.customer.id : session.customer,
        subscription: subscription ? subscription.id : session.subscription
      },
      items: lineItems.data.map(li => ({
        priceId: li.price ? li.price.id : null,
        quantity: li.quantity
      }))
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function stripeWebhook(req, res) {
  try {
    const sig = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const payload = {
        type: "invoice.paid",
        invoiceId: invoice.id,
        customerId: invoice.customer,
        subscriptionId: invoice.subscription,
        billingReason: invoice.billing_reason,
        status: invoice.status,
        amountPaid: invoice.amount_paid,
        currency: invoice.currency
      };
      if (typeof req.app?.locals?.onStripeEvent === "function") {
        await req.app.locals.onStripeEvent(payload);
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const payload = {
        type: "invoice.payment_failed",
        invoiceId: invoice.id,
        customerId: invoice.customer,
        subscriptionId: invoice.subscription,
        billingReason: invoice.billing_reason,
        status: invoice.status,
        attemptCount: invoice.attempt_count,
        nextPaymentAttempt: invoice.next_payment_attempt
      };
      if (typeof req.app?.locals?.onStripeEvent === "function") {
        await req.app.locals.onStripeEvent(payload);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const payload = {
        type: "customer.subscription.deleted",
        subscriptionId: sub.id,
        customerId: sub.customer,
        status: sub.status
      };
      if (typeof req.app?.locals?.onStripeEvent === "function") {
        await req.app.locals.onStripeEvent(payload);
      }
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const payload = {
        type: "customer.subscription.updated",
        subscriptionId: sub.id,
        customerId: sub.customer,
        status: sub.status,
        currentPeriodEnd: sub.current_period_end,
        cancelAtPeriodEnd: sub.cancel_at_period_end
      };
      if (typeof req.app?.locals?.onStripeEvent === "function") {
        await req.app.locals.onStripeEvent(payload);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
}

