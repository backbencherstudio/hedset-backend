import { FastifyReply, FastifyRequest } from "fastify";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY; // Add this

if (!webhookSecret) {
  throw new Error("Missing STRIPE_WEBHOOK_SECRET environment variable");
}

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable");
}

// FIX: Use stripeSecretKey, not webhookSecret!
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-10-29.clover", // Use latest version
});

export const manageWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const signatureHeader = request.headers["stripe-signature"];

    if (!signatureHeader) {
      return reply.status(400).send({
        success: false,
        message: "Missing Stripe signature header",
      });
    }

    if (!request.body) {
      console.log("============Missing request body===============");
      return reply.status(400).send({
        success: false,
        message: "Missing request body",
      });
    }

    console.log("============Request Body===============");
  //   {
  // id: 'evt_1SUOzQELyaXPVXi6xlR8VuZl',
  // object: 'event',
  // api_version: '2025-01-27.acacia',
  // created: 1763372692,
  // data: {
  //   object: {
  //     id: 'price_1SUOzPELyaXPVXi6uNUEMrtA',
  //     object: 'price',
  //     active: true,
  //     billing_scheme: 'per_unit',
  //     created: 1763372691,
  //     currency: 'usd',
  //     custom_unit_amount: null,
  //     livemode: false,
  //     lookup_key: null,
  //     metadata: {},
  //     nickname: null,
  //     product: 'prod_TRHYIaWADzVKv9',
  //     recurring: [Object],
  //     tax_behavior: 'unspecified',
  //     tiers_mode: null,
  //     transform_quantity: null,
  //     type: 'recurring',
  //     unit_amount: 599,
  //     unit_amount_decimal: '599'
  //   }
  // },
    let dataPreview: any = (request.body as any)?.data?.object
    console.log(dataPreview)
    console.log("==================================");

    // This should now work if raw body is configured
    if (!Buffer.isBuffer(request.body)) {
      console.log("============Body is not buffer===============");
      console.log("Body type:", typeof request.body);
      console.log("Body:", request.body);
      return reply.status(400).send({
        success: false,
        message: "Invalid request body - expected raw buffer",
      });
    }

    const rawBody = request.body;
    
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signatureHeader,
      webhookSecret
    );

    console.log("==================================");
    console.log("Stripe event type:", event.type);
    console.log("Stripe event ID:", event.id);
    console.log("==================================");

    // FIX: Remove the unreachable code!
    return reply.send({ 
      success: true, 
      received: true, 
      eventType: event.type 
    });

  } catch (error) {
    console.error("Error processing Stripe webhook:", error);
    return reply.status(400).send({
      success: false,
      message: "Webhook Error: " + (error instanceof Error ? error.message : "Unknown error"),
    });
  }
};