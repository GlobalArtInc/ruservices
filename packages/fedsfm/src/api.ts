import https from 'https';
import { promises as fs } from 'fs';
import { AppSettings, CatalogResponse } from './types.js';
import { AuthenticationService } from './auth.js';

export class APIFedsfm {
  private readonly appSettings: AppSettings;
  private readonly authService: AuthenticationService;
  private readonly isTest: boolean;
  private accessToken: string | null = null;

  constructor(appSettings: AppSettings, isTest: boolean = true) {
    this.isTest = isTest;
    this.appSettings = appSettings;

    const authenticateUrl = isTest
      ? `${appSettings.apiSettings.baseUrl}${appSettings.apiSettings.testAuthenticateEndpoint}`
      : `${appSettings.apiSettings.baseUrl}${appSettings.apiSettings.prodAuthenticateEndpoint}`;
    
    this.authService = new AuthenticationService(authenticateUrl);
  }

  async authorize(): Promise<void> {
    console.log('=== AUTHORIZATION ===');
    console.log(`API Base URL: ${this.appSettings.apiSettings.baseUrl}`);
    console.log(`User Name: ${this.appSettings.credentials.userName}`);
    console.log(`Certificate Serial: ${this.appSettings.certificate.serialNumber}`);

    const result = await this.authService.getAuthorizedClient(
      this.appSettings.credentials.userName,
      this.appSettings.credentials.password,
      this.appSettings.certificate.serialNumber
    );

    this.accessToken = result.accessToken;
    console.log('✅ Authorization was successful');
  }

  async getTe2Catalog(): Promise<CatalogResponse | null> {
    console.log('=== REQUEST: Fetch current list of entities and individuals suspected of extremist or terrorist activities (test mode) ===');

    if (this.isTest) {
      return await this.getCatalog(
        `${this.appSettings.apiSettings.baseUrl}${this.appSettings.apiSettings.testTe2CatalogEndpoint}`
      );
    } else {
      return await this.getCatalog(
        `${this.appSettings.apiSettings.baseUrl}${this.appSettings.apiSettings.prodTe2CatalogEndpoint}`
      );
    }
  }

  async getTe21Catalog(): Promise<CatalogResponse | null> {
    console.log('=== REQUEST: Fetch current list of entities and individuals suspected of extremist or terrorist activities. ===');

    return await this.getCatalog(
      `${this.appSettings.apiSettings.baseUrl}${this.appSettings.apiSettings.prodTe21CatalogEndpoint}`
    );
  }

  async getMvkCatalog(): Promise<CatalogResponse | null> {
    console.log('=== REQUEST: Fetch current list of persons subject to Commission\'s decision to freeze/block their financial resources or other assets. ===');
    
    if (this.isTest) {
      return await this.getCatalog(
        `${this.appSettings.apiSettings.baseUrl}${this.appSettings.apiSettings.testMvkCatalogEndpoint}`
      );
    } else {
      return await this.getCatalog(
        `${this.appSettings.apiSettings.baseUrl}${this.appSettings.apiSettings.prodMvkCatalogEndpoint}`
      );
    }
  }

  async getUnCatalog(): Promise<CatalogResponse | null> {
    console.log('=== REQUEST: Fetch current consolidated list (eng) of entities and individuals subject to terrorist or WMD proliferation-related Security Council decisions. ===');
    
    return await this.getCatalog(
      `${this.appSettings.apiSettings.baseUrl}${this.appSettings.apiSettings.prodUnCatalogEndpoint}`
    );
  }

  private async getCatalog(url: string): Promise<CatalogResponse | null> {
    if (!this.accessToken) {
      console.error('❌ Access Token is not initialized. Please authorize first.');
      return null;
    }

    try {
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: ''
      });

      console.log(`=== HTTP REQUEST ===\nPOST ${url}`);
      console.log(`=== HTTP RESPONSE ===\nStatus: ${response.statusCode}\nBody: ${response.body}`);

      const catalogResponse: CatalogResponse = JSON.parse(response.body);
      
      if (catalogResponse && catalogResponse.idXml) {
        if (typeof catalogResponse.date === 'string') {
          catalogResponse.date = new Date(catalogResponse.date);
        }
        return catalogResponse;
      } else {
        console.error('❌ File ID not found in the catalog response');
        return null;
      }
    } catch (error) {
      const err = error as Error;
      console.error(`Error while processing catalogs: ${err.message}`);
      return null;
    }
  }

  async downloadTe2File(catalogResponse: CatalogResponse): Promise<void> {
    if (this.isTest) {
      await this.downloadFileById(
        catalogResponse,
        `${this.appSettings.apiSettings.baseUrl}${this.appSettings.apiSettings.testTe2FileEndpoint}`,
        'zip',
        'suspect'
      );
    } else {
      await this.downloadFileById(
        catalogResponse,
        `${this.appSettings.apiSettings.baseUrl}${this.appSettings.apiSettings.prodTe2FileEndpoint}`,
        'zip',
        'suspect'
      );
    }
  }

  async downloadTe21File(catalogResponse: CatalogResponse): Promise<void> {
    await this.downloadFileById(
      catalogResponse,
      `${this.appSettings.apiSettings.baseUrl}${this.appSettings.apiSettings.prodTe21FileEndpoint}`,
      'zip',
      'suspect'
    );
  }

  async downloadUnFile(catalogResponse: CatalogResponse): Promise<void> {
    await this.downloadFileById(
      catalogResponse,
      `${this.appSettings.apiSettings.baseUrl}${this.appSettings.apiSettings.prodUnFileEndpoint}`,
      'xml',
      'un'
    );
  }

  async downloadMvkZipFile(catalogResponse: CatalogResponse): Promise<void> {
    if (this.isTest) {
      await this.downloadFileById(
        catalogResponse,
        `${this.appSettings.apiSettings.baseUrl}${this.appSettings.apiSettings.testMvkZipFileEndpoint}`,
        'zip',
        'freeze'
      );
    } else {
      await this.downloadFileById(
        catalogResponse,
        `${this.appSettings.apiSettings.baseUrl}${this.appSettings.apiSettings.prodMvkZipFileEndpoint}`,
        'zip',
        'freeze'
      );
    }
  }

  async downloadMvkFile(catalogResponse: CatalogResponse): Promise<void> {
    if (this.isTest) {
      await this.downloadFileById(
        catalogResponse,
        `${this.appSettings.apiSettings.baseUrl}${this.appSettings.apiSettings.testMvkFileEndpoint}`,
        'xml',
        'freeze'
      );
    } else {
      await this.downloadFileById(
        catalogResponse,
        `${this.appSettings.apiSettings.baseUrl}${this.appSettings.apiSettings.prodMvkFileEndpoint}`,
        'xml',
        'freeze'
      );
    }
  }

  private async downloadFileById(
    catalogResponse: CatalogResponse,
    url: string,
    ext: string,
    prefix: string
  ): Promise<void> {
    if (!this.accessToken) {
      console.error('❌ Access Token is not initialized.');
      return;
    }

    if (!catalogResponse || !catalogResponse.idXml) {
      console.error('❌ CatalogResponse or idXml not specified.');
      return;
    }

    try {
      const formData = `id=${encodeURIComponent(catalogResponse.idXml)}`;
      
      console.log('=== FILE DOWNLOAD REQUEST ===');
      console.log(`POST ${url}`);
      console.log(`Body: ${formData}`);
      
      const headers = {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formData, 'utf8').toString()
      };

      const response = await this.makeRequest(url, {
        method: 'POST',
        headers,
        body: formData
      });

      console.log(`=== HTTP RESPONSE ===\nStatus: ${response.statusCode}`);

      if (response.statusCode === 200) {
        const fileData = Buffer.from(response.body, 'binary');
        console.log(`File size: ${fileData.length} bytes`);
        
        const dateString = catalogResponse.date instanceof Date
          ? catalogResponse.date.toISOString().substring(0, 10).replace(/-/g, '')
          : new Date(catalogResponse.date).toISOString().substring(0, 10).replace(/-/g, '');
        
        const fileName = `${prefix}_${dateString}.${ext}`;
        
        await fs.writeFile(fileName, fileData);
        
        console.log(`✅ File saved successfully: ${fileName}`);
        console.log(`Full path: ${process.cwd()}/${fileName}`);
      } else {
        console.error(`❌ File download error: ${response.statusCode}`);
        console.error(`Error: ${response.body}`);
      }
    } catch (error) {
      const err = error as Error;
      console.error(`Error downloading file: ${err.message}`);
    }
  }

  private makeRequest(
    url: string,
    options: {
      method: string;
      headers: Record<string, string>;
      body: string;
    }
  ): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      
      const requestOptions: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method,
        headers: options.headers,
        rejectUnauthorized: true
      };

      const req = https.request(requestOptions, (res) => {
        const chunks: Buffer[] = [];
        
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolve({
            statusCode: res.statusCode || 500,
            body: res.headers['content-type']?.includes('application/json') 
              ? body.toString('utf8')
              : body.toString('binary')
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }
}
