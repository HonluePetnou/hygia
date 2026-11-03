import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Branche la documentation OpenAPI sur `/docs`. */
export function setupDocs(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('HYGIA — service IA clinique')
    .setDescription('Copilote sourcé et résumé pré-consultation, modèle simulé (données fictives)')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
