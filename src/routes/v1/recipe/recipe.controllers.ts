import fs from "fs";
import { getImageUrl } from "../../../utils/baseurl";
import { FileService } from "../../../utils/fileService";

export const createRecipe = async (request, reply) => {
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
      request.file?.path && FileService.removeFileByPath(request.file.path);
      return reply.status(400).send({
        success: false,
        message: `${missingField} is required!`,
      });
    }

    if (!["High", "Medium", "Low"].includes(budget)) {
      request.file?.path && FileService.removeFile(request.file.path);
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
    if (request.file?.path) FileService.removeFile(request.file.path);
    request.log.error(error);
    return reply
      .status(500)
      .send({ success: false, error: error, message: "Internal Server Error" });
  }
};

export const updateRecipe = async (request, reply) => {
  try {
    const { id } = request.params;
    const prisma = request.server.prisma;

    const existingRecipe = await prisma.recipe.findUnique({ where: { id } });
    if (!existingRecipe) {
      request.file?.path && FileService.removeFile(request.file.path);
      return reply
        .status(404)
        .send({ success: false, message: "Recipe not found" });
    }

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

    if (budget && !["High", "Medium", "Low"].includes(budget)) {
      request.file?.path && FileService.removeFile(request.file.path);
      return reply
        .status(400)
        .send({ success: false, message: "Invalid budget value" });
    }

    const updateData = {
      name,
      recipeType,
      categories,
      dietaryPreference,
      description,
      budget,
      minCookingTime: minCookingTime && parseInt(minCookingTime),
      maxCookingTime: maxCookingTime && parseInt(maxCookingTime),
      calories: calories && parseInt(calories),
      image: request.file?.filename,
    };

    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key]
    );

    if (request.file && existingRecipe.image)
      FileService.removeFile(existingRecipe.image);
    if (Object.keys(updateData).length === 0) {
      request.file?.path && FileService.removeFile(request.file.path);
      return reply
        .status(400)
        .send({ success: false, message: "No fields to update" });
    }

    const updatedRecipe = await prisma.recipe.update({
      where: { id },
      data: updateData,
    });

    return reply.status(200).send({
      success: true,
      message: "Recipe updated successfully",
      data: {
        ...updatedRecipe,
        image: updatedRecipe.image ? getImageUrl(updatedRecipe.image) : null,
      },
    });
  } catch (error) {
    request.file?.path && FileService.removeFile(request.file.path);
    request.log.error(error);

    if (error.code === "P2025") {
      return reply
        .status(404)
        .send({ success: false, message: "Recipe not found" });
    }

    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const deleteRecipe = async (request, reply) => {
  try {
    const { id } = request.params;
    const prisma = request.server.prisma;

    const existingRecipe = await prisma.recipe.findUnique({
      where: { id },
    });

    if (!existingRecipe) {
      return reply.status(404).send({
        success: false,
        message: "Recipe not found",
      });
    }

    if (existingRecipe.image) {
      FileService.removeFile(existingRecipe.image);
    }

    await prisma.recipe.delete({
      where: { id },
    });

    return reply.status(200).send({
      success: true,
      message: "Recipe deleted successfully",
    });
  } catch (error) {
    request.log.error(error);

    if (error.code === "P2025") {
      return reply.status(404).send({
        success: false,
        message: "Recipe not found",
      });
    }

    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
