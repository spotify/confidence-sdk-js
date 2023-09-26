import {createConfidenceServerProvider} from "@spotify-confidence/openfeature-server-provider";

export const serverProvider = createConfidenceServerProvider({
    clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
    region: 'eu',
    fetchImplementation: fetch.bind(this),
    apply: {
        timeout: 1000,
    },
});