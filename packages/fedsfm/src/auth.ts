import https from 'https';
import { AuthenticationException, ApiResponse } from './types.js';

export class AuthenticationService {
  private readonly apiUrl: string;

  constructor(apiUrl: string) {
    if (!apiUrl) {
      throw new Error('API URL cannot be empty');
    }
    this.apiUrl = apiUrl;
  }

  async getAuthorizedClient(
    userName: string,
    password: string,
    certificateSerialNumber: string
  ): Promise<{ client: typeof https; accessToken: string }> {
    if (!userName || userName.trim() === '') {
      throw new Error('User name cannot be empty');
    }
    
    if (!password || password.trim() === '') {
      throw new Error('Password cannot be empty');
    }
    
    if (!certificateSerialNumber || certificateSerialNumber.trim() === '') {
      throw new Error('Certificate serial number cannot be empty');
    }

    try {
      console.log(`Loading certificate with serial number: ${certificateSerialNumber}`);
      
      const certificate = await this.loadCertificate(certificateSerialNumber);
      
      const accessToken = await this.authenticate(userName, password, certificate);
      
      console.log('Successfully obtained authorized client');
      
      return {
        client: https,
        accessToken
      };
    } catch (error) {
      const err = error as Error;
      console.error(`Error creating authorized client: ${err.message}`);
      throw new AuthenticationException('Failed to create authorized connection', err);
    }
  }

  private async loadCertificate(serialNumber: string): Promise<{ cert: Buffer; key: Buffer }> {
    throw new Error('The loadCertificate method must be implemented. To work with certificates from the Windows store, please use a specialized library or provide file paths for the certificate.');
  }

  private async authenticate(
    userName: string,
    password: string,
    certificate: { cert: Buffer; key: Buffer }
  ): Promise<string> {
    console.log('Starting authentication process');
    
    const loginData = {
      userName,
      password
    };

    const jsonContent = JSON.stringify(loginData);
    
    console.log(`Sending authentication request to ${this.apiUrl}`);
    console.log(`JSON: ${jsonContent}`);

    const response = await this.makeRequest(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonContent, 'utf8').toString()
      },
      body: jsonContent,
      cert: certificate.cert,
      key: certificate.key
    });

    console.log(`HTTP Status: ${response.statusCode}`);
    console.log(`Response Body: ${response.body}`);

    if (response.statusCode !== 200) {
      throw new AuthenticationException(
        `Authentication error. HTTP Status: ${response.statusCode}, Response: ${response.body}`
      );
    }

    const apiResponse: ApiResponse = JSON.parse(response.body);
    
    if (!apiResponse) {
      throw new AuthenticationException('Failed to deserialize authentication response');
    }

    if (!apiResponse.success) {
      const errorMessage = apiResponse.error || 'Unknown authentication error';
      let fullErrorMessage = errorMessage;
      
      if (apiResponse.hasErrors && apiResponse.errors) {
        fullErrorMessage += `. Additional errors: ${apiResponse.errors.join(', ')}`;
      }
      
      throw new AuthenticationException(`Authentication failed: ${fullErrorMessage}`);
    }

    if (!apiResponse.value?.accessToken) {
      throw new AuthenticationException('Access Token not found in authentication response');
    }

    console.log('Authentication successful');
    if (apiResponse.value.currentUser) {
      console.log(`User ID: ${apiResponse.value.currentUser.id || 'N/A'}`);
      console.log(`User Name: ${apiResponse.value.currentUser.userName || 'N/A'}`);
      console.log(`KB Short Name: ${apiResponse.value.currentUser.kbShortName || 'N/A'}`);
      console.log(`Is Authenticated: ${apiResponse.value.currentUser.isAuthenticated}`);
    }

    return apiResponse.value.accessToken;
  }

  private makeRequest(
    url: string,
    options: {
      method: string;
      headers: Record<string, string>;
      body: string;
      cert: Buffer;
      key: Buffer;
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
        cert: options.cert,
        key: options.key,
        rejectUnauthorized: true
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 500,
            body: data
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(options.body);
      req.end();
    });
  }
}
