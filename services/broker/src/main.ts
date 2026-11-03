import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

const env = loadEnv();
// Pas d'analyse du corps : il est transmis tel quel au service.
const app = await NestFactory.create(AppModule, { bodyParser: false });
app.enableCors({
  origin: env.webOrigin,
  exposedHeaders: ['ETag', 'x-correlation-id'],
  allowedHeaders: ['content-type', 'x-user-id', 'x-user-role', 'x-correlation-id', 'accept', 'if-match'],
});
await app.listen(env.port);
