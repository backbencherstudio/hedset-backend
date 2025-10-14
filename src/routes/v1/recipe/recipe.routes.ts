import { FastifyInstance } from "fastify";
import { createRecipe } from "./recipe.controllers";
import { upload } from "../../../config/storage.config";
import { verifyUser } from "../../../middleware/auth.middleware";

const authRoutes = (fastify: FastifyInstance) => {
  fastify.post(
    "/create",
    {
      preHandler: [verifyUser("user", "admin"), upload.single("avatar")],
    },
    createRecipe
  );
};

export default authRoutes;
