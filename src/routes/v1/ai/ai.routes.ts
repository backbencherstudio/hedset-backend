import { FastifyInstance } from "fastify";

import { upload } from "../../../config/storage.config";
import { verifyUser } from "../../../middleware/auth.middleware";
import { askedQuestions } from "./ai.controllers";

const aiRoutes = (fastify: FastifyInstance) => {
  fastify.post(
    "/asked-me",
    {
      preHandler: [verifyUser("user")],
    },
    askedQuestions
  );
};

export default aiRoutes;
