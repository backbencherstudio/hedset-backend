export const manageFavorite = async (request, reply) => {

  const { recipeId } = request.params;
  const userId = request.user.id

  const prisma = request.server.prisma;

  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId },
    select: { id: true },
  });

  if (!recipe) {
    return reply.status(500).send({
      success: false,
      message: "recipe not found!",
    });
  }

  

  try {
    return reply.status(200).send({
      success: true,
      message: "Personalization data saved successfully!",
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      error: error.message,
      message: "Internal Server Error",
    });
  }
};
