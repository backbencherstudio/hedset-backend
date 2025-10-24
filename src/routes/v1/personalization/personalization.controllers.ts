


export const createPersonalization = async (request, reply) => {
  try {
    const {} = request.body

  } catch (error) {
    return reply.status(500).send({
      success: false,
      error: error.message,
      message: "Internal Server Error",
    });
  }
};
