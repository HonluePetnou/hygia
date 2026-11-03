import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { setupDocs } from './docs.js';

const env = loadEnv();
const app = await NestFactory.create(AppModule);
setupDocs(app);
await app.listen(env.port);
