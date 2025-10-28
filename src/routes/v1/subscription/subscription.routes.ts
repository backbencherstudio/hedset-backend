import { FastifyInstance } from "fastify";

import { upload } from "../../../config/storage.config";
import { verifyUser } from "../../../middleware/auth.middleware";
import {
  createStripeProducts,
  getStripeProducts,
  updateStripeProducts,
  deleteStripeProducts,
  getSingleStripeProduct
} from "./subscription.controllers";

const subscriptionRoutes = (fastify: FastifyInstance) => {
  fastify.post(
    "/stripe/product",
    {
      preHandler: [verifyUser("admin"), upload.single("image")],
    },
    createStripeProducts
  );

  fastify.get(
    "/stripe/product",
    {
      preHandler: [verifyUser("admin", "user"), upload.single("image")],
    },
    getStripeProducts
  );

  fastify.get(
    "/stripe/product/:id",
    {
      preHandler: [verifyUser("admin")],
    },
    getSingleStripeProduct
  );

  fastify.patch(
    "/stripe/product/:id",
    {
      preHandler: [verifyUser("admin"), upload.single("image")],
    },
    updateStripeProducts
  );

  fastify.delete(
    "/stripe/product/:id",
    {
      preHandler: [verifyUser("admin"), upload.single("image")],
    },
    deleteStripeProducts
  );
};

export default subscriptionRoutes;
