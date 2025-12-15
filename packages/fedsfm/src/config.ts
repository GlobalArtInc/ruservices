import { AppSettings, ApiSettings, Credentials, Certificate } from './types.js';
import { BASE_URL, TEST_ENDPOINTS, PROD_ENDPOINTS } from './const.js';

export class ConfigurationService {
  private appSettings: AppSettings | null = null;

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    this.appSettings = {
      apiSettings: this.buildApiSettings(),
      credentials: {
        userName: process.env.FEDSFM_API_USERNAME || '',
        password: process.env.FEDSFM_API_PASSWORD || ''
      },
      certificate: {
        serialNumber: process.env.FEDSFM_API_CERTIFICATE_SERIAL_NUMBER || '',
        storeLocation: process.env.FEDSFM_API_CERTIFICATE_STORE_LOCATION || '',
        storeName: process.env.FEDSFM_API_CERTIFICATE_STORE_NAME || ''
      },
    };
  }

  private buildApiSettings(): ApiSettings {
    return {
      baseUrl: BASE_URL,
      testAuthenticateEndpoint: TEST_ENDPOINTS.AUTHENTICATE,
      testTe2CatalogEndpoint: TEST_ENDPOINTS.TE2_CATALOG,
      testTe2FileEndpoint: TEST_ENDPOINTS.TE2_FILE,
      testMvkCatalogEndpoint: TEST_ENDPOINTS.MVK_CATALOG,
      testMvkZipFileEndpoint: TEST_ENDPOINTS.MVK_ZIP_FILE,
      testMvkFileEndpoint: TEST_ENDPOINTS.MVK_FILE,
      prodAuthenticateEndpoint: PROD_ENDPOINTS.AUTHENTICATE,
      prodTe2CatalogEndpoint: PROD_ENDPOINTS.TE2_CATALOG,
      prodTe2FileEndpoint: PROD_ENDPOINTS.TE2_FILE,
      prodTe21CatalogEndpoint: PROD_ENDPOINTS.TE21_CATALOG,
      prodTe21FileEndpoint: PROD_ENDPOINTS.TE21_FILE,
      prodMvkCatalogEndpoint: PROD_ENDPOINTS.MVK_CATALOG,
      prodMvkZipFileEndpoint: PROD_ENDPOINTS.MVK_ZIP_FILE,
      prodMvkFileEndpoint: PROD_ENDPOINTS.MVK_FILE,
      prodUnCatalogEndpoint: PROD_ENDPOINTS.UN_CATALOG,
      prodUnFileEndpoint: PROD_ENDPOINTS.UN_FILE
    };
  }

  getAppSettings(): AppSettings {
    if (!this.appSettings) {
      throw new Error('Application settings are not loaded');
    }
    return this.appSettings;
  }

  getApiSettings(): ApiSettings {
    return this.getAppSettings().apiSettings;
  }

  getCredentials(): Credentials {
    return this.getAppSettings().credentials;
  }

  getCertificate(): Certificate {
    return this.getAppSettings().certificate;
  }
}
