import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Branche la documentation OpenAPI sur `/docs`. */
export function setupDocs(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('HYGIA — service Dossiers')
    .setDescription('Patients, chronologie, bris de glace et journal des accès (données fictives)')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
