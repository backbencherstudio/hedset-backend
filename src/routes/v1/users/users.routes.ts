import { FastifyInstance } from "fastify";
import { getAllUsers } from "./users.controllers";
import { upload } from "../../../config/storage.config";
import { verifyUser } from "../../../middleware/auth.middleware";

const usersRoutes = (fastify: FastifyInstance) => {
  fastify.get(
    "/all",
    {
      preHandler: [verifyUser("admin")],
    },
    getAllUsers
  );
};

export default usersRoutes;
