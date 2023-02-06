/** @typedef {`https://x.gd/${string}`} XgdUrl */
/** @typedef {`\`${Url}\`: <${XgdUrl}>`} XgdSuccessMessage */
/** @typedef {`error occured [${XgdFailureStatus | number}]: ${string}`} XgdFailureMessage */
/** @typedef {200} XgdSuccessStatus */
/** @typedef {400 | 401 | 403 | 409 | 429 | 500 | 503} XgdFailureStatus */
/** @typedef {XgdSuccessStatus | XgdFailureStatus} XgdStatus */

/**
 * @typedef XgdRequest
 * @property {string} key
 * @property {Url} url
 * @property {string=} shortid
 * @property {boolean=} [analytics=true]
 * @property {boolean=} [filterbots=false]
 */

/**
 * @typedef XgdSuccessResponse
 * @property {XgdSuccessStatus} status
 * @property {XgdUrl} shorturl
 * @property {boolean} analytics
 * @property {boolean} filterbots
 * @property {`http${'s' | ''}://${string}`} originalurl
 */

/**
 * @typedef XgdFailureResponse
 * @property {XgdFailureStatus} status
 * @property {string} message
 */

/** @typedef {XgdSuccessResponse | XgdFailureResponse} XgdResponse */
/** @typedef {import('axios').AxiosResponse<XgdResponse, XgdRequest>} ShortenUrlResponse */
