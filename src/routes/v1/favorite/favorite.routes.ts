import { FastifyInstance } from "fastify";

import { upload } from "../../../config/storage.config";
import { verifyUser } from "../../../middleware/auth.middleware";
 

const favoriteRoutes = (fastify: FastifyInstance) => {
  fastify.post(
    "/",
    {
      preHandler: [verifyUser("user")],
    },
    manageFavorite
  );

//   fastify.get(
//     "/",
//     {
//       preHandler: [verifyUser("user")],
//     },
//     checkOk
//   );
};

export default favoriteRoutes;
