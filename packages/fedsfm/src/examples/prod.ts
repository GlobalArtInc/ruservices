import { APIFedsfm, ConfigurationService, AuthenticationException } from '../index.js';

async function main() {
  try {
    const configService = new ConfigurationService();
    const appSettings = configService.getAppSettings();

    console.log('=== ЗАПУСК ПРИЛОЖЕНИЯ KFM (PROD) ===');
    
    const fedsfm = new APIFedsfm(appSettings, false);
    
    await fedsfm.authorize();

    const suspectCatalog = await fedsfm.getTe21Catalog();
    const suspectJson = suspectCatalog != null 
      ? JSON.stringify(suspectCatalog, null, 2) 
      : 'Не получен';
    console.log(`Suspect Catalog JSON:\n${suspectJson}`);
    
    if (suspectCatalog != null && suspectCatalog.idXml) {
      await fedsfm.downloadTe21File(suspectCatalog);
    }
    
    const freezeCatalog = await fedsfm.getMvkCatalog();
    const freezeJson = freezeCatalog != null 
      ? JSON.stringify(freezeCatalog, null, 2) 
      : 'Не получен';
    console.log(`Freeze Catalog JSON:\n${freezeJson}`);
    
    if (freezeCatalog != null && freezeCatalog.idXml) {
      await fedsfm.downloadMvkZipFile(freezeCatalog);
    }

    const unCatalog = await fedsfm.getUnCatalog();
    const unJson = unCatalog != null 
      ? JSON.stringify(unCatalog, null, 2) 
      : 'Не получен';
    console.log(`UN Catalog JSON:\n${unJson}`);
    
    if (unCatalog != null && unCatalog.idXml) {
      await fedsfm.downloadUnFile(unCatalog);
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

