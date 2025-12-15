export interface ApiResponse {
  value?: ValueData;
  success: boolean;
  error?: string;
  errors?: unknown[];
  hasErrors: boolean;
}

export interface ValueData {
  currentUser?: CurrentUser;
  accessToken?: string;
  refreshToken?: unknown;
}

export interface CurrentUser {
  id?: string;
  userName?: string;
  kbShortName?: string;
  kbLoginType: number;
  isAuthenticated: boolean;
}

export interface CatalogResponse {
  date: Date;
  isActive: boolean;
  idRecStatus?: unknown;
  idXml?: string;
}

export interface AppSettings {
  apiSettings: ApiSettings;
  credentials: Credentials;
  certificate: Certificate;
}

export interface ApiSettings {
  baseUrl: string;
  testAuthenticateEndpoint: string;
  testTe2CatalogEndpoint: string;
  testTe2FileEndpoint: string;
  testMvkCatalogEndpoint: string;
  testMvkZipFileEndpoint: string;
  testMvkFileEndpoint: string;
  prodAuthenticateEndpoint: string;
  prodTe2CatalogEndpoint: string;
  prodTe2FileEndpoint: string;
  prodTe21CatalogEndpoint: string;
  prodTe21FileEndpoint: string;
  prodMvkCatalogEndpoint: string;
  prodMvkZipFileEndpoint: string;
  prodMvkFileEndpoint: string;
  prodUnCatalogEndpoint: string;
  prodUnFileEndpoint: string;
}

export interface Credentials {
  userName: string;
  password: string;
}

export interface Certificate {
  serialNumber: string;
  storeLocation: string;
  storeName: string;
}

export class AuthenticationException extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'AuthenticationException';
    this.cause = cause;
  }
}

