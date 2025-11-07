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
      targetLifestyle,
      price
    } = request.body;

    const requiredFields = [
      "name",
      "minCookingTime",
      "maxCookingTime",
      "calories",
      "recipeType",
      "budget",
      "categories",
      "dietaryPreference",
      "description",
      "targetLifestyle",
      "price"
    ];

    const missingField = requiredFields.find((field) => !request.body[field]);
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

    if (!["senior", "student"].includes(targetLifestyle)) {
      request.file?.path && FileService.removeFile(request.file.path);
      return reply.status(400).send({
        success: false,
        message: "Lifestyle must be: senior, student",
      });
    }

    if (!request.file) {
      return reply.status(400).send({
        success: false,
        message: "Recipe image is required!",
      });
    }

    const prisma = request.server.prisma;

    const minTime = parseInt(minCookingTime);
    const maxTime = parseInt(maxCookingTime);
    const cal = parseInt(calories);

    if (isNaN(minTime) || isNaN(maxTime) || isNaN(cal)) {
      request.file?.path && FileService.removeFile(request.file.path);
      return reply.status(400).send({
        success: false,
        message: "Cooking times and calories must be valid numbers.",
      });
    }

    const newRecipe = await prisma.recipe.create({
      data: {
        name,
        minCookingTime: minTime,
        maxCookingTime: maxTime,
        calories: cal,
        recipeType,
        budget,
        categories,
        dietaryPreference,
        description,
        targetLifestyle,
        image: request.file.filename,
        price: parseFloat(price),
      },
    });

    return reply.status(201).send({
      success: true,
      message: "Recipe Created Successfully!",
      data: {
        ...newRecipe,
        image: newRecipe.image ? getImageUrl(newRecipe.image) : null,
      },
    });
  } catch (error) {
    if (request.file?.path) FileService.removeFile(request.file.path);
    request.log.error(error);

    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error.message || error,
    });
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
      targetLifestyle,
      price
    } = request.body;

    if (budget && !["High", "Medium", "Low"].includes(budget)) {
      request.file?.path && FileService.removeFile(request.file.path);
      return reply
        .status(400)
        .send({ success: false, message: "Invalid budget value" });
    }

    if (targetLifestyle && !["senior", "student"].includes(targetLifestyle)) {
      request.file?.path && FileService.removeFile(request.file.path);
      return reply.status(400).send({
        success: false,
        message: "Lifestyle must be: senior, student",
      });
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
      targetLifestyle,
      price: price && parseFloat(price),
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

export const getAllRecipes = async (request, reply) => {
  try {
    const prisma = request.server.prisma;

    const page = parseInt(request.query.page as string) || 1;
    const limit = parseInt(request.query.limit as string) || 10;
    const search = (request.query.search as string) || "";
    const skip = (page - 1) * limit;

    const whereCondition: any = {};
    if (search) {
      whereCondition.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { recipeType: { contains: search, mode: "insensitive" } },
        { categories: { contains: search, mode: "insensitive" } },
        { dietaryPreference: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [totalItems, recipes] = await Promise.all([
      prisma.recipe.count({ where: whereCondition }),
      prisma.recipe.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const formattedRecipes = recipes.map((recipe) => ({
      ...recipe,
      image: recipe.image ? getImageUrl(recipe.image) : null,
    }));

    const totalPages = Math.ceil(totalItems / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return reply.status(200).send({
      success: true,
      message: "Recipes fetched successfully",
      data: formattedRecipes,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        itemsPerPage: limit,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      error: error,
      message: "Internal Server Error",
    });
  }
};

// export const getPersonalizedRecipe = async (request, reply) => {
//   try {
//     const userId = request.user?.id;
//     const prisma = request.server.prisma;
//     const redis = request.server.redis;

//     if (!userId) {
//       return reply.status(401).send({
//         success: false,
//         message: "Unauthorized user",
//       });
//     }

//     // Redis keys
//     const personalizationKey = `personalization:${userId}`;
//     const shownRecipesKey = `shownRecipes:${userId}`;

//     // 🔹 Step 1: Get personalization data
//     const personalizationData = await redis.hgetall(personalizationKey);
//     if (!Object.keys(personalizationData || {}).length) {
//       return reply.status(404).send({
//         success: false,
//         message: "No personalization data found",
//       });
//     }

//     // 🔹 Step 2: Get list of already shown recipe IDs
//     const shownRecipeIds = await redis.smembers(shownRecipesKey);

//     // 🔹 Step 3: Build initial filters
//     const filters: any = {
//       NOT: shownRecipeIds.length ? { id: { in: shownRecipeIds } } : undefined,
//     };

//     if (personalizationData.targetLifestyle) {
//       filters.targetLifestyle = personalizationData.targetLifestyle;
//     }

//     if (personalizationData.budget) {
//       filters.budget = personalizationData.budget;
//     }

//     if (personalizationData.dietaryPreference) {
//       filters.dietaryPreference = personalizationData.dietaryPreference;
//     }

//     if (personalizationData.recipeType) {
//       filters.recipeType = personalizationData.recipeType;
//     }

//     if (personalizationData.cookingTime) {
//       const cookTime = Number(personalizationData.cookingTime);
//       if (!isNaN(cookTime)) {
//         filters.AND = [
//           { minCookingTime: { lte: cookTime + 10 } },
//           { maxCookingTime: { gte: cookTime - 10 } },
//         ];
//       }
//     }

//     // 🔹 Step 4: Find recipe (not yet shown)
//     let recipe = await prisma.recipe.findFirst({
//       where: filters,
//       orderBy: { createdAt: "desc" },
//     });

//     // 🔹 Step 5: Progressive fallback logic
//     if (!recipe) {
//       const fallbackQueries = [
//         // Step 1: lifestyle + budget
//         {
//           targetLifestyle: personalizationData.targetLifestyle,
//           budget: personalizationData.budget,
//         },
//         // Step 2: lifestyle only
//         { targetLifestyle: personalizationData.targetLifestyle },
//         // Step 3: budget only
//         { budget: personalizationData.budget },
//         // Step 4: dietary preference only
//         { dietaryPreference: personalizationData.dietaryPreference },
//         // Step 5: any recipe not shown
//         {},
//       ];

//       for (const fallbackFilter of fallbackQueries) {
//         recipe = await prisma.recipe.findFirst({
//           where: {
//             ...fallbackFilter,
//             NOT: shownRecipeIds.length
//               ? { id: { in: shownRecipeIds } }
//               : undefined,
//           },
//           orderBy: { createdAt: "desc" },
//         });
//         if (recipe) break;
//       }
//     }

//     // 🔹 Step 6: If still not found — reset shown list and retry once
//     if (!recipe && shownRecipeIds.length > 0) {
//       await redis.del(shownRecipesKey); // Clear seen list
//       recipe = await prisma.recipe.findFirst({
//         orderBy: { createdAt: "desc" },
//       });
//     }

//     if (!recipe) {
//       return reply.status(404).send({
//         success: false,
//         message: "No recipes available at this time.",
//       });
//     }

//     // 🔹 Step 7: Save this recipe ID in Redis set (to mark as shown)
//     await redis.sadd(shownRecipesKey, recipe.id);
//     await redis.expire(shownRecipesKey, 24 * 60 * 60); // expires in 24h (optional)

//     // 🔹 Step 8: Return the found recipe
//     return reply.status(200).send({
//       success: true,
//       message: "Personalized recipe fetched successfully!",
//       data: {
//         ...recipe,
//         image: recipe.image ? getImageUrl(recipe.image) : null,
//       },
//     });
//   } catch (error) {
//     request.log.error(error);
//     return reply.status(500).send({
//       success: false,
//       message: "Internal Server Error",
//       error: error.message || error,
//     });
//   }
// };

//==========================================not include facurate==================

// export const getPersonalizedRecipe = async (request, reply) => {
//   try {
//     const userId = request.user?.id;
//     const prisma = request.server.prisma;
//     const redis = request.server.redis;

//     if (!userId) {
//       return reply.status(401).send({
//         success: false,
//         message: "Unauthorized user",
//       });
//     }

//     const user = await prisma.user.findUnique({
//       where: { id: userId },
//       select: { isSubscriber: true },
//     });

//     if (!user) {
//       return reply.status(404).send({
//         success: false,
//         message: "User not found",
//       });
//     }

//     if (!user.isSubscriber) {
//       const today = new Date().toISOString().split("T")[0];
//       const dailyKey = `recipe_limit:${userId}:${today}`;

//       const currentCount = await redis.get(dailyKey);
//       const count = currentCount ? parseInt(currentCount) : 0;

//       if (count >= 5) {
//         return reply.status(429).send({
//           success: false,
//           message: "Daily limit reached. Subscribe for unlimited access.",
//         });
//       }

//       await redis.incr(dailyKey);
//       await redis.expire(dailyKey, 24 * 60 * 60);
//     }

//     const personalizationKey = `personalization:${userId}`;
//     const shownRecipesKey = `shownRecipes:${userId}`;

//     const personalizationData = await redis.hgetall(personalizationKey);
//     if (!Object.keys(personalizationData || {}).length) {
//       return reply.status(404).send({
//         success: false,
//         message: "No personalization data found",
//       });
//     }

//     const shownRecipeIds = await redis.smembers(shownRecipesKey);

//     const filters: any = {
//       NOT: shownRecipeIds.length ? { id: { in: shownRecipeIds } } : undefined,
//     };

//     if (personalizationData.targetLifestyle) {
//       filters.targetLifestyle = personalizationData.targetLifestyle;
//     }

//     if (personalizationData.budget) {
//       filters.budget = personalizationData.budget;
//     }

//     if (personalizationData.dietaryPreference) {
//       filters.dietaryPreference = personalizationData.dietaryPreference;
//     }

//     if (personalizationData.recipeType) {
//       filters.recipeType = personalizationData.recipeType;
//     }

//     if (personalizationData.cookingTime) {
//       const cookTime = Number(personalizationData.cookingTime);
//       if (!isNaN(cookTime)) {
//         filters.AND = [
//           { minCookingTime: { lte: cookTime + 10 } },
//           { maxCookingTime: { gte: cookTime - 10 } },
//         ];
//       }
//     }

//     let recipe = await prisma.recipe.findFirst({
//       where: filters,
//       orderBy: { createdAt: "desc" },
//     });

//     if (!recipe) {
//       const fallbackQueries = [
//         {
//           targetLifestyle: personalizationData.targetLifestyle,
//           budget: personalizationData.budget,
//         },
//         { targetLifestyle: personalizationData.targetLifestyle },
//         { budget: personalizationData.budget },
//         { dietaryPreference: personalizationData.dietaryPreference },
//         {},
//       ];

//       for (const fallbackFilter of fallbackQueries) {
//         recipe = await prisma.recipe.findFirst({
//           where: {
//             ...fallbackFilter,
//             NOT: shownRecipeIds.length
//               ? { id: { in: shownRecipeIds } }
//               : undefined,
//           },
//           orderBy: { createdAt: "desc" },
//         });
//         if (recipe) break;
//       }
//     }

//     if (!recipe && shownRecipeIds.length > 0) {
//       await redis.del(shownRecipesKey);
//       recipe = await prisma.recipe.findFirst({
//         orderBy: { createdAt: "desc" },
//       });
//     }

//     if (!recipe) {
//       return reply.status(404).send({
//         success: false,
//         message: "No recipes available at this time.",
//       });
//     }

//     await redis.sadd(shownRecipesKey, recipe.id);
//     await redis.expire(shownRecipesKey, 24 * 60 * 60);

//     return reply.status(200).send({
//       success: true,
//       message: "Personalized recipe fetched successfully!",
//       data: {
//         ...recipe,
//         image: recipe.image ? getImageUrl(recipe.image) : null,
//       },
//     });
//   } catch (error) {
//     request.log.error(error);
//     return reply.status(500).send({
//       success: false,
//       message: "Internal Server Error",
//       error: error.message || error,
//     });
//   }
// };



export const getPersonalizedRecipe = async (request, reply) => {
  try {
    const userId = request.user?.id;
    const prisma = request.server.prisma;
    const redis = request.server.redis;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: "Unauthorized user",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSubscriber: true },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isSubscriber) {
      const today = new Date().toISOString().split("T")[0];
      const dailyKey = `recipe_limit:${userId}:${today}`;

      const currentCount = await redis.get(dailyKey);
      const count = currentCount ? parseInt(currentCount) : 0;

      if (count >= 50) {
        return reply.status(429).send({
          success: false,
          message: "Daily limit reached. Subscribe for unlimited access.",
        });
      }

      await redis.incr(dailyKey);
      await redis.expire(dailyKey, 24 * 60 * 60);
    }

    const personalizationKey = `personalization:${userId}`;
    const shownRecipesKey = `shownRecipes:${userId}`;

    const personalizationData = await redis.hgetall(personalizationKey);
    if (!Object.keys(personalizationData || {}).length) {
      return reply.status(404).send({
        success: false,
        message: "No personalization data found",
      });
    }

    const shownRecipeIds = await redis.smembers(shownRecipesKey);

    const filters: any = {
      NOT: shownRecipeIds.length ? { id: { in: shownRecipeIds } } : undefined,
    };

    if (personalizationData.targetLifestyle) {
      filters.targetLifestyle = personalizationData.targetLifestyle;
    }

    if (personalizationData.budget) {
      filters.budget = personalizationData.budget;
    }

    if (personalizationData.dietaryPreference) {
      filters.dietaryPreference = personalizationData.dietaryPreference;
    }

    if (personalizationData.recipeType) {
      filters.recipeType = personalizationData.recipeType;
    }

    if (personalizationData.cookingTime) {
      const cookTime = Number(personalizationData.cookingTime);
      if (!isNaN(cookTime)) {
        filters.AND = [
          { minCookingTime: { lte: cookTime + 10 } },
          { maxCookingTime: { gte: cookTime - 10 } },
        ];
      }
    }

    let recipe = await prisma.recipe.findFirst({
      where: filters,
      orderBy: { createdAt: "desc" },
    });

    if (!recipe) {
      const fallbackQueries = [
        {
          targetLifestyle: personalizationData.targetLifestyle,
          budget: personalizationData.budget,
        },
        { targetLifestyle: personalizationData.targetLifestyle },
        { budget: personalizationData.budget },
        { dietaryPreference: personalizationData.dietaryPreference },
        {},
      ];

      for (const fallbackFilter of fallbackQueries) {
        recipe = await prisma.recipe.findFirst({
          where: {
            ...fallbackFilter,
            NOT: shownRecipeIds.length
              ? { id: { in: shownRecipeIds } }
              : undefined,
          },
          orderBy: { createdAt: "desc" },
        });
        if (recipe) break;
      }
    }

    if (!recipe && shownRecipeIds.length > 0) {
      await redis.del(shownRecipesKey);
      recipe = await prisma.recipe.findFirst({
        orderBy: { createdAt: "desc" },
      });
    }

    if (!recipe) {
      return reply.status(404).send({
        success: false,
        message: "No recipes available at this time.",
      });
    }

    // Check if the recipe is in user's favorites
    const favorite = await prisma.favoriteRecipe.findFirst({
      where: {
        userId: userId,
        recipeId: recipe.id,
      },
      select: {
        id: true,
      },
    });

    await redis.sadd(shownRecipesKey, recipe.id);
    await redis.expire(shownRecipesKey, 24 * 60 * 60);

    return reply.status(200).send({
      success: true,
      message: "Personalized recipe fetched successfully!",
      data: {
        ...recipe,
        image: recipe.image ? getImageUrl(recipe.image) : null,
        isFavorited: !!favorite, // This will be true if recipe is in favorites
        favoriteId: favorite?.id || null, // Optional: include the favorite record ID
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error.message || error,
    });
  }
};