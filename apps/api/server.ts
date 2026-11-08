import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { fromFastifyRequest } from 'fastify-type-provider-schema';
import { schema } from './schema';

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({ logger: true });

  // Schema validation
  server.setValidatorCompiler(({ schema }) => {
    return fromFastifyRequest(schema);
  });

  // Health check
  server.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes will be added here as we build out the application

  return server;
}

export type Server = FastifyInstance;
