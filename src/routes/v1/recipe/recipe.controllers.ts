import fs from "fs";
import { FastifyRequest, FastifyReply } from "fastify";

export const createRecipe = async (request, reply) => {
  const removeFile = (filePath: string) => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  };

  try {
    const {
      name,
      minCookingTime,
      maxCookingTime,
      calories,
      recipeType,
      budget,
      categories,
      dietaryPreference,
      description,
    } = request.body as Record<string, any>;

    const missingField = [
      "name",
      "minCookingTime",
      "maxCookingTime",
      "calories",
      "recipeType",
      "budget",
      "categories",
      "dietaryPreference",
      "description",
    ].find((field) => !request.body[field]);

    if (missingField) {
      if (request.file?.path) removeFile(request.file.path);
      return reply.status(400).send({
        success: false,
        message: `${missingField} is required!`,
      });
    }

    if (!request.file) {
      return reply.status(400).send({
        success: false,
        message: "Recipe image is required!",
      });
    }

    const prisma = request.server.prisma;
    const redis = request.server.redis;

    const creteRecipe = await prisma.recipe.create({
      data: {
        name,
        minCookingTime: parseInt(minCookingTime),
        maxCookingTime: parseInt(maxCookingTime),
        calories: parseInt(calories),
        recipeType,
        budget,
        dietaryPreference,
        description,
        image: request.file.filename,
        categories,
      },
    });

    return reply.status(200).send({
      success: true,
      message: "Recipe Create Successful!",
      data: creteRecipe,
    });
  } catch (error) {
    request.log.error(error);
    return reply
      .status(500)
      .send({ succes: false, error: error, message: "Internal Server Error" });
  }
};
