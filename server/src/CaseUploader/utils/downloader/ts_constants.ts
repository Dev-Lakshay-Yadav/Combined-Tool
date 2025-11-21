export const BASE_FOLDER = process.env.ROOT_FOLDER;

export const BASE_URL = process.env.PORTAL_URL;
export const INCOMING_CASES_QUERY = `${BASE_URL}/api/localUploader/all-cases/0Wbjj49mZtRZ5YtcShGaIb10JbdNxEtezdZi2eios4w0TDcxPjRC`;
export const INCOMING_REDESIGNS_QUERY = `${BASE_URL}/api/localUploader/redesign-cases/0Wbjj49mZtRZ5YtcShGaIb10JbdNxEtezdZi2eios4w0TDcxPjRC`;
export const UPDATING_CASEFILES_AND_CASEUNITS = `${BASE_URL}/api/localUploader/add-casefiles`;
export const UPDATE_REDESIGN_STATUS_ENDPOINT = `${BASE_URL}/api/localUploader/update-redesign-status`;
export const CONSTANTS_POST_ENDPOINT = `${BASE_URL}/api/localUploader/set-constants`;
export const CONSTANTS_GET_ENDPOINT = `${BASE_URL}/api/localUploader/get-constants/`;
