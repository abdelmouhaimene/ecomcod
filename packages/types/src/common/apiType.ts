/** Uniform error body produced by the API's global exception filter. */
export interface ApiErrorResponse {
    statusCode: number;
    message: string;
    error: string;
    timestamp: string;
    path: string;
}

/** Simple acknowledgement returned by endpoints that have nothing else to say. */
export interface MessageResponse {
    message: string;
}
