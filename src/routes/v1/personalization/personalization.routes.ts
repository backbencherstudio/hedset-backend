import { FastifyInstance } from "fastify";

import { upload } from "../../../config/storage.config";
import { verifyUser } from "../../../middleware/auth.middleware";
import { checkOk, createPersonalization } from "./personalization.controllers";

const usersRoutes = (fastify: FastifyInstance) => {
  fastify.post(
    "/",
    {
      preHandler: [verifyUser("user")],
    },
    createPersonalization
  );

  fastify.get(
    "/",
    {
      preHandler: [verifyUser("user")],
    },
    checkOk
  );
};

export default usersRoutes;
