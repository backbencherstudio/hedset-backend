import { FastifyInstance } from "fastify";
import { createRecipe, deleteRecipe, getAllRecipes, updateRecipe } from "./recipe.controllers";
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

  fastify.delete(
    "/delete/:id",
    {
      preHandler: [verifyUser("admin")],
    },
    deleteRecipe
  );

  fastify.get(
    "/all",
    {
      preHandler: [verifyUser("admin")],
    },
    getAllRecipes
  );
};

export default authRoutes;
