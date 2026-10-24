import { registerApiService } from './apiService';
import { registerStorageService, StorageService } from './storageService';
import { TransferService } from './transferService';
const transfers = new TransferService();
registerStorageService(new StorageService(transfers));
registerApiService(transfers);
