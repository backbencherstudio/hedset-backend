import { FastifyInstance } from "fastify";

import { upload } from "../../../config/storage.config";
import { verifyUser } from "../../../middleware/auth.middleware";
import { getAllFavorite, manageFavorite } from "./favorite.controllers";

const favoriteRoutes = (fastify: FastifyInstance) => {
  fastify.post(
    "/recipe/:recipeId",
    {
      preHandler: [verifyUser("user")],
    },
    manageFavorite
  );

  fastify.get(
    "/recipe/list",
    {
      preHandler: [verifyUser("user")],
    },
    getAllFavorite
  );
};

export default favoriteRoutes;
