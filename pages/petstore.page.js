/**
 * Page Object for Swagger Petstore UI
 */
export class SwaggerPetstorePage {
  constructor(page) {
    this.page = page;
    
    // Cookie popup
    this.cookieAllowAllButton = page.locator('button.ch2-allow-all-btn');
    
    // Endpoint selectors
    this.addPetEndpoint = page.locator('#operations-pet-addPet');
    this.getPetByIdEndpoint = page.locator('#operations-pet-getPetById');
    this.updatePetEndpoint = page.locator('#operations-pet-updatePet');
    this.deletePetEndpoint = page.locator('#operations-pet-deletePet');
    
    // Common UI elements
    this.tryItOutButton = page.locator('.try-out__btn:not(.cancel)');
    this.executeButtonAdd = page.locator('.execute');
    this.executeButtonGet = page.locator('#operations-pet-getPetById');
    this.requestBodyTextarea = page.locator('.body-param__text');
    this.responseCode = page.locator('.response-col_status');
    this.responseBody = page.locator('.response-col_description pre');
  }

  async goto() {
    await this.page.goto('https://petstore.swagger.io/', { waitUntil: 'networkidle' });

    // Accept cookies if popup appears
    try {
      await this.cookieAllowAllButton.waitFor({ timeout: 5000 });
      await this.cookieAllowAllButton.click();
      console.log('Cookies accepted');
    } catch {
      // No cookie popup found, continue
    }

    await this.waitForSwaggerToLoad();
  }

  async waitForSwaggerToLoad() {
    await this.page.waitForSelector('.swagger-ui', { timeout: 15000 });
    // Short wait for Swagger UI to fully render
    await this.page.waitForTimeout(1000);
  }

  async expandAddPetEndpoint() {
    //await this.addPetEndpoint.scrollIntoViewIfNeeded();
    await this.addPetEndpoint.click();
    await this.page.waitForTimeout(500);
  }

  async clickTryItOut() {
    await this.tryItOutButton.click();
    await this.page.waitForTimeout(300);
  }

  async addPet(petData) {

    // Step 1: Expand the endpoint
    await this.expandAddPetEndpoint();
    
    // Step 2: Click "Try it out" button
    await this.clickTryItOut();
    
    // Step 3: Fill in the request body
    await this.requestBodyTextarea.fill(JSON.stringify(petData, null, 2));
    
    // Step 4: Execute the request
    await this.executeButtonAdd.click();
    
    // Step 5: Wait for response
    await this.page.waitForTimeout(1500);
  }

  async getResponseCode() {
    const codeElement = this.responseCode.filter({ hasText: '200' });

    const fullText = await codeElement.textContent();

    // Extract only the number (200, 400, 500, etc.)
    const statusCode = fullText.match(/\d+/)?.[0];
    console.log(statusCode);
    return statusCode;
  }

  async getResponseBody() {
    const bodyElement = this.responseBody.first();
    const responseText = await bodyElement.textContent();
    try {
      return JSON.parse(responseText);
    } catch (e) {
      return responseText;
    }
  }

    async getPetById(petId) {
    // Expand the GET endpoint
    await this.getPetByIdEndpoint.scrollIntoViewIfNeeded();
    await this.getPetByIdEndpoint.click();
    await this.page.waitForTimeout(500);
    
    // Click Try it out
    await this.tryItOutButton.click();
    
    // Fill pet ID
    await this.page.locator('input[placeholder="petId"]').fill(petId.toString());
    
    // Execute
    await this.executeButtonGet.click();
    await this.page.waitForTimeout(1000);
    
    return await this.getResponseBody();
  }

  async takeScreenshot(name) {
    await this.page.screenshot({ path: `screenshots/${name}-${Date.now()}.png` });
  }

  async clearRequestBody() {
    await this.requestBodyTextarea.clear();
  }
}