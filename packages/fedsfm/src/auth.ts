import https from 'https';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
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
    const certPath = process.env.FEDSFM_CERT_PATH;
    const keyPath = process.env.FEDSFM_KEY_PATH;
    const pfxPath = process.env.FEDSFM_PFX_PATH;
    const pfxPassword = process.env.FEDSFM_PFX_PASSWORD;

    if (certPath && keyPath) {
      try {
        const cert = readFileSync(certPath);
        const key = readFileSync(keyPath);
        console.log(`Certificate loaded from files: ${certPath}, ${keyPath}`);
        return { cert, key };
      } catch (error) {
        const err = error as Error;
        throw new Error(`Failed to load certificate from files: ${err.message}`);
      }
    }

    if (pfxPath) {
      try {
        const password = pfxPassword || '';
        const tempDir = process.env.TMPDIR || process.env.TMP || '/tmp';
        const certPath = `${tempDir}/fedsfm_cert_${Date.now()}.pem`;
        const keyPath = `${tempDir}/fedsfm_key_${Date.now()}.pem`;
        
        try {
          const passArg = password ? `-passin pass:${password}` : '-nodes';
          execSync(`openssl pkcs12 -in "${pfxPath}" -out "${certPath}" -clcerts -nokeys ${passArg}`, { stdio: 'pipe' });
          execSync(`openssl pkcs12 -in "${pfxPath}" -out "${keyPath}" -nocerts -nodes ${passArg}`, { stdio: 'pipe' });
          
          const cert = readFileSync(certPath);
          const key = readFileSync(keyPath);
          
          const { unlinkSync } = await import('fs');
          try {
            unlinkSync(certPath);
          } catch {
          }
          try {
            unlinkSync(keyPath);
          } catch {
          }
          
          console.log(`Certificate loaded from PFX file: ${pfxPath}`);
          return { cert, key };
        } catch (opensslError) {
          const { unlinkSync } = await import('fs');
          try {
            unlinkSync(certPath);
          } catch {
          }
          try {
            unlinkSync(keyPath);
          } catch {
          }
          throw new Error(`Failed to extract certificate from PFX: ${(opensslError as Error).message}. Make sure OpenSSL is installed.`);
        }
      } catch (error) {
        const err = error as Error;
        throw new Error(`Failed to load PFX certificate: ${err.message}`);
      }
    }

    try {
      const certData = await this.findCertificateInStore(serialNumber);
      if (certData) {
        console.log(`Certificate found in system store with serial number: ${serialNumber}`);
        return certData;
      }
    } catch (storeError) {
      console.warn(`Failed to search certificate in system store: ${(storeError as Error).message}`);
    }

    throw new Error(
      `Certificate not found. Please provide one of the following:\n` +
      `- FEDSFM_CERT_PATH and FEDSFM_KEY_PATH environment variables (for PEM files)\n` +
      `- FEDSFM_PFX_PATH environment variable (for PFX/P12 file, optionally FEDSFM_PFX_PASSWORD)\n` +
      `- Or ensure certificate with serial number "${serialNumber}" is available in system certificate store`
    );
  }

  private async findCertificateInStore(serialNumber: string): Promise<{ cert: Buffer; key: Buffer } | null> {
    const platform = process.platform;

    if (platform === 'win32') {
      return this.findCertificateWindows(serialNumber);
    } else if (platform === 'darwin') {
      return this.findCertificateMacOS(serialNumber);
    } else {
      return this.findCertificateLinux(serialNumber);
    }
  }

  private async findCertificateWindows(serialNumber: string): Promise<{ cert: Buffer; key: Buffer } | null> {
    try {
      const powershellScript = `
        $cert = Get-ChildItem -Path Cert:\\CurrentUser\\My | Where-Object { $_.SerialNumber -eq "${serialNumber}" } | Select-Object -First 1
        if ($cert) {
          $certPath = [System.IO.Path]::GetTempFileName()
          $keyPath = [System.IO.Path]::GetTempFileName()
          Export-Certificate -Cert $cert -FilePath $certPath | Out-Null
          $cert | Export-PfxCertificate -FilePath $keyPath -Password (ConvertTo-SecureString -String "temp" -AsPlainText -Force) | Out-Null
          Write-Output "$certPath|$keyPath"
        }
      `;
      
      const result = execSync(`powershell -Command "${powershellScript}"`, { encoding: 'utf8' }).trim();
      if (result && result.includes('|')) {
        const [certPath] = result.split('|');
        const cert = readFileSync(certPath);
        return {
          cert,
          key: cert
        };
      }
    } catch (error) {
      console.warn(`Windows certificate search failed: ${(error as Error).message}`);
    }
    return null;
  }

  private async findCertificateMacOS(serialNumber: string): Promise<{ cert: Buffer; key: Buffer } | null> {
    try {
      const serialNumberHex = serialNumber.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
      const command = `security find-certificate -c "${serialNumberHex}" -p`;
      const certPem = execSync(command, { encoding: 'utf8' });
      
      if (certPem && certPem.includes('BEGIN CERTIFICATE')) {
        const cert = Buffer.from(certPem);
        return {
          cert,
          key: cert
        };
      }
    } catch (error) {
      console.warn(`macOS certificate search failed: ${(error as Error).message}`);
    }
    return null;
  }

  private async findCertificateLinux(serialNumber: string): Promise<{ cert: Buffer; key: Buffer } | null> {
    try {
      const serialNumberHex = serialNumber.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
      const command = `openssl x509 -in /etc/ssl/certs/*.pem -noout -serial 2>/dev/null | grep -i "${serialNumberHex}" | head -1`;
      const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
      
      if (result) {
        const certPath = result.split(' ')[0];
        const cert = readFileSync(certPath);
        return {
          cert,
          key: cert
        };
      }
    } catch (error) {
      console.warn(`Linux certificate search failed: ${(error as Error).message}`);
    }
    return null;
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
