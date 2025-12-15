import { APIFedsfm, ConfigurationService, AuthenticationException } from '../index.js';

async function main() {
  try {
    const configService = new ConfigurationService();
    const appSettings = configService.getAppSettings();

    console.log('=== ЗАПУСК ПРИЛОЖЕНИЯ KFM (TEST) ===');
    
    const fedsfm = new APIFedsfm(appSettings, true);
    
    await fedsfm.authorize();

    const suspectCatalog = await fedsfm.getTe2Catalog();
    const suspectJson = suspectCatalog != null 
      ? JSON.stringify(suspectCatalog, null, 2) 
      : 'Не получен';
    console.log(`Suspect Catalog JSON:\n${suspectJson}`);
    
    if (suspectCatalog != null && suspectCatalog.idXml) {
      await fedsfm.downloadTe2File(suspectCatalog);
    }
    
    const freezeCatalog = await fedsfm.getMvkCatalog();
    const freezeJson = freezeCatalog != null 
      ? JSON.stringify(freezeCatalog, null, 2) 
      : 'Не получен';
    console.log(`Freeze Catalog JSON:\n${freezeJson}`);
    
    if (freezeCatalog != null && freezeCatalog.idXml) {
      await fedsfm.downloadMvkFile(freezeCatalog);
      await fedsfm.downloadMvkZipFile(freezeCatalog);
    }
  } catch (error: unknown) {
    if (error instanceof AuthenticationException) {
      console.error(`Ошибка авторизации: ${error.message}`);
    } else {
      const err = error as Error;
      console.error(`Общая ошибка: ${err.message}`);
    }
  }
}

main();

