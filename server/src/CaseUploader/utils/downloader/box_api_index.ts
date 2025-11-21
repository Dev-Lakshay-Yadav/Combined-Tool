import { getClient } from '../../config/box.js';
import { processCases } from './ts_portal_box_cases_downloader.js';

getClient(client => {
    processCases(client);
})