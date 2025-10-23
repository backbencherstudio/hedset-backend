import fs from "fs";
import { FastifyRequest, FastifyReply } from "fastify";
import { getImageUrl } from "../../../utils/baseurl";

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
    } = request.body;

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

    // Validate budget type
    const validBudgetTypes = ["High", "Medium", "Low"];
    if (!validBudgetTypes.includes(budget)) {
      if (request.file?.path) removeFile(request.file.path);
      return reply.status(400).send({
        success: false,
        message: "Budget must be one of: High, Medium, Low",
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

    const createRecipe = await prisma.recipe.create({
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

    return reply.status(201).send({
      success: true,
      message: "Recipe Created Successfully!",

      data: {
        ...createRecipe,
        image: createRecipe.image ? getImageUrl(createRecipe.image) : null,
      },
    });
  } catch (error) {
    if (request.file?.path) removeFile(request.file.path);
    request.log.error(error);
    return reply
      .status(500)
      .send({ success: false, error: error, message: "Internal Server Error" });
  }
};
