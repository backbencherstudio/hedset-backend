export const createPersonalization = async (request, reply) => {
  try {
    const {
      targetLifestyle,
      cookingTime,
      budget,
      dietaryPreference,

      recipeType, // optional or "other"
    } = request.body;

    const parsedCookingTime = Number(cookingTime);

    if (cookingTime) {
      if (
        cookingTime === undefined ||
        cookingTime === null ||
        !Number.isInteger(parsedCookingTime)
      ) {
        return reply.status(400).send({
          success: false,
          message: "Cooking time must be an integer or a convert able string.",
        });
      }
    }

    if (budget && !["High", "Medium", "Low"].includes(budget)) {
      return reply.status(400).send({
        success: false,
        message: "Budget must be one of: High, Medium, Low",
      });
    }

    if (targetLifestyle && !["senior", "student"].includes(targetLifestyle)) {
      return reply.status(400).send({
        success: false,
        message: "Lifestyle must be: senior, student",
      });
    }

    if (
      dietaryPreference &&
      !["Meat", "Vegetarian", "Vegan", "Nut Free"].includes(dietaryPreference)
    ) {
      return reply.status(400).send({
        success: false,
        message: "dietaryPreference must be: Meat, Vegetarian, Vegan, Nut Free",
      });
    }

    const userId = request.user?.id;

    const prisma = request.server.prisma;
    const redis = request.server.redis;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return reply.status(200).send({
        success: false,
        message: "user not found",
      });
    }

    const redisKey = `personalization:${userId}`;

    await redis.hset(redisKey, {
      targetLifestyle,
      cookingTime: parsedCookingTime,
      budget,
      dietaryPreference,
      recipeType,
    });

    return reply.status(200).send({
      success: true,
      message: "Personalization data saved successfully!",
      data: {
        targetLifestyle,
        cookingTime,
        budget,
        dietaryPreference,
        recipeType,
      },
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
