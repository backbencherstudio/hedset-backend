import { FastifyInstance } from "fastify";
import auth from "./auth/auth.routes";
import recipe from "./recipe/recipe.routes";

async function routesV1(fastify: FastifyInstance) {
  const moduleRoutes = [
    { path: "/auth", route: auth },
    { path: "/recipe", route: recipe },
  ];

  moduleRoutes.forEach(({ path, route }) => {
    fastify.register(route, { prefix: path });
  });
}

export default routesV1;
