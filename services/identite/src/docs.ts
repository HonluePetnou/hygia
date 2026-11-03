import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Branche la documentation OpenAPI sur `/docs`. */
export function setupDocs(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('HYGIA — service Identité et accès')
    .setDescription('Comptes, double authentification TOTP, jetons JWT, équipes de soins, bris de glace (données fictives)')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
