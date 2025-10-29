import Stripe from "stripe";

const stripe = new Stripe(
  "sk_test_51QuTWKClJBhr3sfikQjjaxPgDjsndVS0WlfusMAoxLzAsEOC7NYTKzGTSVkngmlKmSuNa6HGa0wRVLit80kVDRpa004vfKxrUO"
);

export const checkout = async (request, reply) => {
  try {
    const { subscriptionPackageId } = request.body;

    const userId = request.user?.id;
    const prisma = request.server.prisma;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!subscriptionPackageId) {
      return reply.status(400).send({
        success: false,
        message: "Subscription package ID is required",
      });
    }

    const subscriptionPackage = await prisma.subscriptionPackage.findUnique({
      where: { id: subscriptionPackageId },
    });

    if (!subscriptionPackage) {
      return reply.status(404).send({
        success: false,
        message: "Subscription package not found",
      });
    }

    if (!subscriptionPackage.stripePriceId) {
      return reply.status(400).send({
        success: false,
        message: "Stripe priceId not configured for this package",
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: subscriptionPackage.stripePriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",

      success_url:
        "myflutterapp://payment-success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "myflutterapp://payment-cancel",

      client_reference_id: userId,
      metadata: {
        userId: userId,
        subscriptionPackageId: subscriptionPackageId,
      },
    });

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        userId: userId,
        subscriptionPackageId: subscriptionPackageId,
        amount: subscriptionPackage.amount,
        currency: subscriptionPackage.currency,
        stripeSessionId: session.id,
        status: "pending",
        autoRenewal: true,
      },
    });

    

    return reply.status(200).send({
      success: true,
      message: "Checkout session created successfully",
      data: {
        sessionId: session.id,
        url: session.url,
        transactionId: transaction.id,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "taka nai, apni gorib!",
      error: error.message,
    });
  }
};
