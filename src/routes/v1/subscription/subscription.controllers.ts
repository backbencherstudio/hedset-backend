import path from "path";
import Stripe from "stripe";
import { FastifyRequest, FastifyReply } from "fastify";
import { FileService } from "../../../utils/fileService";
import { getImageUrl } from "../../../utils/baseurl";

const stripe = new Stripe(
  "sk_test_51QuTWKClJBhr3sfikQjjaxPgDjsndVS0WlfusMAoxLzAsEOC7NYTKzGTSVkngmlKmSuNa6HGa0wRVLit80kVDRpa004vfKxrUO"
);

export const createStripeProducts = async (request, reply) => {
  try {
    const {
      name,
      description,
      amount,
      currency = "usd",
      interval = "month",
      interval_count = 1,
    } = request.body;

    const prisma = request.server.prisma;

    if (!name || !description || !amount) {
      return reply.status(400).send({
        success: false,
        message:
          "Missing required fields: name, description, and amount are required",
      });
    }

    if (amount <= 0) {
      return reply.status(400).send({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    const validIntervals = ["day", "week", "month", "year"];
    if (!validIntervals.includes(interval)) {
      return reply.status(400).send({
        success: false,
        message: "Invalid interval. Must be: day, week, month, or year",
      });
    }

    if (interval_count < 1 || !Number.isInteger(interval_count)) {
      return reply.status(400).send({
        success: false,
        message: "Interval count must be a positive integer",
      });
    }

    const product = await stripe.products.create({
      name,
      description: Array.isArray(description)
        ? description.join(", ")
        : description,
    });

    const priceData = {
      product: product.id,
      unit_amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      recurring: {
        interval: interval,
        interval_count: interval_count,
      },
    };

    const price = await stripe.prices.create(priceData);

    const subscriptionPackage = await prisma.subscriptionPackage.create({
      data: {
        name,
        description: Array.isArray(description)
          ? description.join(", ")
          : description,
        amount,
        currency,
        interval,
        interval_count,
        stripeProductId: product.id,
        stripePriceId: price.id,
      },
    });

    return reply.status(201).send({
      success: true,
      message: "Subscription product created successfully",
      data: {
        id: subscriptionPackage.id,
        name: subscriptionPackage.name,
        description: subscriptionPackage.description,
        amount: subscriptionPackage.amount,
        currency: subscriptionPackage.currency,
        interval: subscriptionPackage.interval,
        interval_count: subscriptionPackage.interval_count,
        stripeProductId: subscriptionPackage.stripeProductId,
        stripePriceId: subscriptionPackage.stripePriceId,
        billingPeriod: `Every ${interval_count} ${interval}${
          interval_count > 1 ? "s" : ""
        }`,
        createdAt: subscriptionPackage.createdAt,
      },
    });
  } catch (error) {
    request.log.error(error);

    // Handle Stripe-specific errors
    if (error.type?.startsWith("Stripe")) {
      return reply.status(400).send({
        success: false,
        message: "Stripe API error",
        error: error.message,
      });
    }

    return reply.status(500).send({
      success: false,
      message: "Failed to create product",
      error: error.message,
    });
  }
};

export const getStripeProducts = async (request, reply) => {
  try {
    const page = parseInt(request.query.page as string) || 1;
    const limit = parseInt(request.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const prisma = request.server.prisma;

    const [totalItems, products] = await Promise.all([
      prisma.subscriptionPackage.count(),
      prisma.subscriptionPackage.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return reply.status(200).send({
      success: true,
      message: "Subscription products fetched successfully",
      data: products,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        itemsPerPage: limit,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error) {
    return reply.status(500).send({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};

export const getSingleStripeProduct = async (request, reply) => {
  try {
    const { id } = request.params;
    const prisma = request.server.prisma;

    if (!id) {
      return reply.status(400).send({
        success: false,
        message: "Product ID is required",
      });
    }

    const product = await prisma.subscriptionPackage.findUnique({
      where: { id: id },
    });

    if (!product) {
      return reply.status(404).send({
        success: false,
        message: "Subscription product not found",
      });
    }

    let stripeProduct = null;
    let stripePrice = null;

    if (product.stripeProductId) {
      try {
        stripeProduct = await stripe.products.retrieve(product.stripeProductId);
        
        if (product.stripePriceId) {
          stripePrice = await stripe.prices.retrieve(product.stripePriceId);
        }
      } catch (stripeError) {
        request.log.warn(`Stripe fetch failed for product ${id}:`, stripeError);
      }
    }

    const responseData = {
      id: product.id,
      name: product.name,
      description: product.description,
      amount: product.amount,
      currency: product.currency,
      interval: product.interval,
      interval_count: product.interval_count,
      stripeProductId: product.stripeProductId,
      stripePriceId: product.stripePriceId,
      billingPeriod: `Every ${product.interval_count} ${product.interval}${product.interval_count > 1 ? 's' : ''}`,
      isActive: stripeProduct ? stripeProduct.active : true,
    //   stripeProduct: stripeProduct ? {
    //     active: stripeProduct.active,
    //     metadata: stripeProduct.metadata,
    //     created: stripeProduct.created,
    //   } : null,
    //   stripePrice: stripePrice ? {
    //     unit_amount: stripePrice.unit_amount,
    //     currency: stripePrice.currency,
    //     type: stripePrice.type,
    //     recurring: stripePrice.recurring,
    //   } : null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    return reply.status(200).send({
      success: true,
      message: "Subscription product fetched successfully",
      data: responseData,
    });
  } catch (error) {
    request.log.error(error);
    
    return reply.status(500).send({
      success: false,
      message: "Failed to fetch product",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};


export const updateStripeProducts = async (request, reply) => {
  try {
    const prisma = request.server.prisma;
    const { id } = request.params;
    const { name, description, amount, currency, interval, interval_count } =
      request.body;

    if (!id) {
      return reply.status(400).send({
        success: false,
        message: "Product ID is required",
      });
    }

    const existingProduct = await prisma.subscriptionPackage.findUnique({
      where: { id: id },
    });

    if (!existingProduct) {
      return reply.status(404).send({
        success: false,
        message: "Subscription product not found",
      });
    }

    if (!existingProduct.stripeProductId) {
      return reply.status(400).send({
        success: false,
        message: "Stripe product ID not found for this subscription",
      });
    }

    await stripe.products.update(existingProduct.stripeProductId, {
      name: name || existingProduct.name,
      description: Array.isArray(description)
        ? description.join(", ")
        : description || existingProduct.description,
    });

    let stripePriceId = existingProduct.stripePriceId;

    if (
      amount !== undefined &&
      (amount !== existingProduct.amount ||
        currency !== existingProduct.currency ||
        interval !== existingProduct.interval ||
        interval_count !== existingProduct.interval_count)
    ) {
      const priceData: any = {
        product: existingProduct.stripeProductId,
        unit_amount: Math.round((amount || existingProduct.amount) * 100),
        currency: (currency || existingProduct.currency).toLowerCase(),
      };

      if (existingProduct.isRecurring) {
        priceData.recurring = {
          interval: interval || existingProduct.interval,
          interval_count: interval_count || existingProduct.interval_count,
        };
      }

      const newPrice = await stripe.prices.create(priceData);
      stripePriceId = newPrice.id;
    }

    const updatedProduct = await prisma.subscriptionPackage.update({
      where: { id: id },
      data: {
        name: name || existingProduct.name,
        description:
          Array.isArray(description) && description.length
            ? description.join(", ")
            : description || existingProduct.description,
        amount: amount ?? existingProduct.amount,
        currency: currency || existingProduct.currency,
        interval: interval || existingProduct.interval,
        interval_count: interval_count || existingProduct.interval_count,
        stripePriceId,
      },
    });

    return reply.status(200).send({
      success: true,
      message: "Subscription product updated successfully",
      data: {
        id: updatedProduct.id,
        name: updatedProduct.name,
        description: updatedProduct.description,
        amount: updatedProduct.amount,
        currency: updatedProduct.currency,
        interval: updatedProduct.interval,
        interval_count: updatedProduct.interval_count,
        stripeProductId: updatedProduct.stripeProductId,
        stripePriceId: updatedProduct.stripePriceId,
        billingPeriod: `Every ${updatedProduct.interval_count} ${
          updatedProduct.interval
        }${updatedProduct.interval_count > 1 ? "s" : ""}`,
        updatedAt: updatedProduct.updatedAt,
      },
    });
  } catch (error) {
    request.log.error(error);

    if (error.type?.startsWith("Stripe")) {
      return reply.status(400).send({
        success: false,
        message: "Stripe API error",
        error: error.message,
      });
    }

    return reply.status(500).send({
      success: false,
      message: "Failed to update product",
      error: error.message,
    });
  }
};

export const deleteStripeProducts = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const prisma = request.server.prisma;
    const { id } = request.params as any;

    if (!id) {
      return reply.status(400).send({
        success: false,
        message: "Product ID is required",
      });
    }

    // Fetch existing product
    const existingProduct = await prisma.subscriptionPackage.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return reply.status(404).send({
        success: false,
        message: "Subscription product not found",
      });
    }

    // Delete product in Stripe
    if (existingProduct.stripeProductId) {
      await stripe.products.update(existingProduct.stripeProductId, {
        active: false,
      });
    }

    // Delete product in your database
    await prisma.subscriptionPackage.delete({
      where: { id },
    });

    return reply.status(200).send({
      success: true,
      message: "Subscription product deleted successfully",
    });
  } catch (error: any) {
    request.log.error(error);

    if (error.type?.startsWith("Stripe")) {
      return reply.status(400).send({
        success: false,
        message: "Stripe API error",
        error: error.message,
      });
    }

    return reply.status(500).send({
      success: false,
      message: "Failed to delete product",
      error: error.message,
    });
  }
};
