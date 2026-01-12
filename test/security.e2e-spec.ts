import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Security Tests (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let clientToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Créer un ADMIN
    const adminResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'admin-test@elmarketa.com',
        password: '123456',
        role: 'ADMIN',
      });
    adminToken = adminResponse.body.access_token;

    // Créer un CLIENT
    const clientResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'client-test@elmarketa.com',
        password: '123456',
        role: 'CLIENT',
      });
    clientToken = clientResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Inventory Security', () => {
    it('CLIENT ne peut PAS accéder à /inventory/update', () => {
      return request(app.getHttpServer())
        .post('/inventory/update')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          productId: 'test-123',
          quantity: 10,
          operation: 'ADD',
        })
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toContain('Accès refusé');
        });
    });

    it('ADMIN peut accéder à /inventory/update', async () => {
      // D'abord créer un produit
      const productResponse = await request(app.getHttpServer())
        .post('/catalog')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Product',
          price: 100,
          category: 'Test',
          sku: 'TEST-001',
        });

      const productId = productResponse.body.id;

      return request(app.getHttpServer())
        .post('/inventory/update')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId,
          quantity: 10,
          operation: 'ADD',
        })
        .expect(200);
    });
  });

  describe('Catalog Security', () => {
    it('CLIENT ne peut PAS créer de produit', () => {
      return request(app.getHttpServer())
        .post('/catalog')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          name: 'Tajine',
          price: 299.99,
          category: 'Artisanat',
          sku: 'TAJ-999',
        })
        .expect(403);
    });

    it('ADMIN peut créer un produit', () => {
      return request(app.getHttpServer())
        .post('/catalog')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Tajine Admin',
          price: 299.99,
          category: 'Artisanat',
          sku: 'TAJ-ADMIN-001',
        })
        .expect(201);
    });

    it('Tout le monde peut consulter le catalogue', () => {
      return request(app.getHttpServer()).get('/catalog').expect(200);
    });
  });

  describe('Orders Security', () => {
    it('CLIENT peut créer une commande', async () => {
      // Créer un produit avec stock
      const productResponse = await request(app.getHttpServer())
        .post('/catalog')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Product for Order',
          price: 50,
          category: 'Test',
          sku: 'ORDER-TEST-001',
        });

      const productId = productResponse.body.id;

      await request(app.getHttpServer())
        .post('/inventory/update')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId,
          quantity: 100,
          operation: 'ADD',
        });

      return request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          items: [{ productId, quantity: 2 }],
        })
        .expect(201);
    });

    it('Utilisateur non authentifié ne peut PAS créer de commande', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .send({
          items: [{ productId: 'test', quantity: 1 }],
        })
        .expect(401);
    });
  });
});
