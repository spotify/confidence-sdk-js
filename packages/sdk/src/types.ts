export type SimpleFetch = (request: Request) => Promise<Response>;
export type WaitUntil = (promise: Promise<void>) => void;
