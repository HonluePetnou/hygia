import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { setupDocs } from './docs.js';

const env = loadEnv();
const app = await NestFactory.create(AppModule);
setupDocs(app);
// Les clients passent par le broker ; CORS laissé pour les essais directs en développement.
app.enableCors({ origin: process.env['WEB_ORIGIN'] ?? 'http://localhost:3100' });
await app.listen(env.port);
