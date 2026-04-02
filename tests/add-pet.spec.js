import { test, expect } from '@playwright/test';
import { SwaggerPetstorePage } from '../pages/petstore.page.js';
import { petData, generatePetData } from '../test-data/pet-data.js';

test.describe('Petstore - Add Pet Tests', () => {
  let petstore;

  test.beforeEach(async ({ page }) => {
    petstore = new SwaggerPetstorePage(page);
    await petstore.goto();
  });

  test('should add a new pet with valid data', async ({ page }) => {
    const newPet = petData.dog;
    
    await petstore.addPet(newPet);
    
    const responseCode = await petstore.getResponseCode();
    const responseBody = await petstore.getResponseBody();
    
    expect(responseCode).toBe('200');
    expect(responseBody.id).toBe(newPet.id);
    expect(responseBody.name).toBe(newPet.name);
    expect(responseBody.status).toBe(newPet.status);
    
    await petstore.takeScreenshot('pet-added');
  });

});