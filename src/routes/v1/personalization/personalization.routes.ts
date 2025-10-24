import { FastifyInstance } from "fastify";

import { upload } from "../../../config/storage.config";
import { verifyUser } from "../../../middleware/auth.middleware";
import { createPersonalization } from "./personalization.controllers";


const usersRoutes = (fastify: FastifyInstance) => {
  fastify.post(
    "/",
    {
      preHandler: [verifyUser("user")],
    },
    createPersonalization
  );

};

export default usersRoutes;
