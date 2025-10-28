import { FastifyInstance } from "fastify";

import { upload } from "../../../config/storage.config";
import { verifyUser } from "../../../middleware/auth.middleware";
import { manageFavorite } from "./favorite.controllers";

const favoriteRoutes = (fastify: FastifyInstance) => {
  fastify.post(
    "/recipe/:recipeId",
    {
      preHandler: [verifyUser("user")],
    },
    manageFavorite
  );
};

export default favoriteRoutes;
