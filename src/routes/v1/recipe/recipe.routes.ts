import { FastifyInstance } from "fastify";
import { createRecipe, updateRecipe } from "./recipe.controllers";
import { upload } from "../../../config/storage.config";
import { verifyUser } from "../../../middleware/auth.middleware";

const authRoutes = (fastify: FastifyInstance) => {
  fastify.post(
    "/create",
    {
      preHandler: [verifyUser("admin"), upload.single("image")],
    },
    createRecipe
  );

  fastify.patch(
    "/update/:id",
    {
      preHandler: [verifyUser("admin"), upload.single("image")],
    },
    updateRecipe
  );
};

export default authRoutes;
