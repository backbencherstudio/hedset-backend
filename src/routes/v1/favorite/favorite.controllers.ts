export const manageFavorite = async (request, reply) => {
  const { recipeId } = request.params;
  const userId = request.user.id;
  const prisma = request.server.prisma;

  try {
    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId },
      select: { id: true },
    });

    if (!recipe) {
      return reply.status(404).send({
        success: false,
        message: "Recipe not found!",
      });
    }

    const existingFavorite = await prisma.favoriteRecipe.findFirst({
      where: {
        userId: userId,
        recipeId: recipeId,
      },
    });

    if (existingFavorite) {
      await prisma.favoriteRecipe.delete({
        where: {
          id: existingFavorite.id,
        },
      });

      return reply.status(200).send({
        success: true,
        message: "Recipe removed from favorites!",
        isFavorited: false,
        id: existingFavorite.id,
      });
    } else {
      const newFavorite = await prisma.favoriteRecipe.create({
        data: {
          userId: userId,
          recipeId: recipeId,
        },
      });

      return reply.status(200).send({
        success: true,
        message: "Recipe added to favorites!",
        isFavorited: true,
        id: newFavorite.id,
      });
    }
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      error: error.message,
      message: "Internal Server Error",
    });
  }
};

export const getAllFavorite = async (request, reply) => {
  try {
    const userId = request.user.id;
    const prisma = request.server.prisma;

    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalItems = await prisma.favoriteRecipe.count({
      where: {
        userId: userId,
      },
    });

    const totalPages = Math.ceil(totalItems / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const favorites = await prisma.favoriteRecipe.findMany({
      where: {
        userId: userId,
      },
      include: {
        recipe: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: skip,
      take: limit,
    });

    const recipes = favorites.map(favorite => favorite.recipe);

    return reply.status(200).send({
      success: true,
      message: "Favorite recipes retrieved successfully!",
      data: recipes,
      pagination: {
        totalItems: totalItems,
        totalPages: totalPages,
        currentPage: page,
        itemsPerPage: limit,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
      },
    });
  } catch (error) {
    return reply.status(500).send({
      success: false,
      error: error.message,
      message: "Internal Server Error",
    });
  }
};