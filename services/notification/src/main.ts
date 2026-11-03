import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

const env = loadEnv();
const app = await NestFactory.create(AppModule);
const config = new DocumentBuilder()
  .setTitle('HYGIA — service Notification')
  .setDescription(
    'Canaux WhatsApp (bac à sable), SMS, e-mail et console ; rappels (au plus une fois) ; cloche SSE',
  )
  .setVersion('0.1.0')
  .build();
SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
app.enableCors({
  origin: process.env['WEB_ORIGIN'] ?? 'http://localhost:3100',
  exposedHeaders: ['ETag'],
});
await app.listen(env.port);
