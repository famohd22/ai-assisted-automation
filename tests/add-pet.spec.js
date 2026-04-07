//import { test, expect } from '@playwright/test';
import { test, expect } from '../fixtures/custom-test.js';
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

    test('should add pet and verify via GET', async ({ page }) => {
    // Create new pet
    const newPet = generatePetData();
    await petstore.addPet(newPet);
    
    // Verify response from POST
    const postResponse = await petstore.getResponseBody();
    expect(postResponse.id).toBe(newPet.id);
    
    // Now verify we can retrieve it via GET
    const getResponse = await petstore.getPetById(newPet.id);
    expect(getResponse.id).toBe(newPet.id);
    expect(getResponse.name).toBe(newPet.name);
    expect(getResponse.status).toBe(newPet.status);
    await petstore.takeScreenshot('get-pet-before');
  });
});