import { FastifyInstance } from "fastify";
import auth from "./auth/auth.routes";
import recipe from "./recipe/recipe.routes";
import users from "./users/users.routes";
import setting from "./settings/setting.routes";
import personalization from "./personalization/personalization.routes";
import subscriptionRoutes from "./subscription/subscription.routes";
import favoriteRoutes from "./favorite/favorite.routes";
import aiRoutes from "./ai/ai.routes";
import transactionRoutes from "./transactions/transactions.routes";
import stripeRoutes from "./webhooks/stripe/webhooks.routes";

async function routesV1(fastify: FastifyInstance) {
  const moduleRoutes = [
    { path: "/auth", route: auth },
    { path: "/recipe", route: recipe },
    { path: "/users", route: users },
    { path: "/setting", route: setting },
    { path: "/personalization", route: personalization },
    { path: "/subscription", route: subscriptionRoutes },
    { path: "/favorite", route: favoriteRoutes },
    { path: "/transactions", route: transactionRoutes },
    { path: "/ai", route: aiRoutes },
    { path: "/webhooks/stripe", route: stripeRoutes },
  ];

  moduleRoutes.forEach(({ path, route }) => {
    fastify.register(route, { prefix: path });
  });
}

export default routesV1;
