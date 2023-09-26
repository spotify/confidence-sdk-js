import { createConfidenceWebProvider } from "@spotify-confidence/openfeature-web-provider";

export const webProvider = createConfidenceWebProvider({
    clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
    region: 'eu',
    fetchImplementation: window.fetch.bind(window),
    apply: {
        timeout: 1000,
    },
});
