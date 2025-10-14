import { FastifyRequest, FastifyReply } from "fastify";

export const createRecipe = async (request, reply) => {
  try {
    return reply.status(200).send({
      success: true,
      message: "send otp in your email!",
    });
  } catch (error) {
    request.log.error(error);
    return reply
      .status(500)
      .send({ succes: false, error: error, message: "Internal Server Error" });
  }
};
