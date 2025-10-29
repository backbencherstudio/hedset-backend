import { FastifyInstance } from "fastify";

import { upload } from "../../../config/storage.config";
import { verifyUser } from "../../../middleware/auth.middleware";
import { checkout } from "./transactions.controllers";

const transactionRoutes = (fastify: FastifyInstance) => {
  fastify.post(
    "/checkout",
    {
      preHandler: [verifyUser("admin", "user"), upload.single("image")],
    },
    checkout
  );
};

export default transactionRoutes;
