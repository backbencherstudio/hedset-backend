import fp from "fastify-plugin";
import fastifyRawBody from "fastify-raw-body";

export default fp(async (fastify) => {
  await fastify.register(fastifyRawBody, {
    field: "rawBody",
    global: false,
    encoding: false,
    runFirst: true,
  });
});


