import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { setupDocs } from './docs.js';

const env = loadEnv();
const app = await NestFactory.create(AppModule);
setupDocs(app);
// Démo sans broker : le web (port 3100) appelle directement le service ; le broker remplacera ceci.
app.enableCors({
  origin: process.env['WEB_ORIGIN'] ?? 'http://localhost:3100',
  exposedHeaders: ['ETag'],
});
await app.listen(env.port);
