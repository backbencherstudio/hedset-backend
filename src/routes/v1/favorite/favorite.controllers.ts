export const manageFavorite = async (request, reply) => {
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
