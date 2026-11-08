import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });
}
