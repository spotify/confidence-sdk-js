# Bufo privacy review demo

Build the CSR packages, then run the local server:

```sh
yarn build:csr
node examples/privacy-review-demo/server.mjs
```

Open <http://127.0.0.1:4173/>. Use the floating privacy review panel to start recording, interact with the shop, and click **Stop & preview**. The recording opens in a local browser tab. **Download review** saves a self-contained HTML copy that opens directly in a browser; no demo server is needed after download. The panel comes from `mountPrivacyReviewControls()`; the demo supplies no buttons or event handlers for it.

The demo uses only local HTML and the `@spotify-confidence/privacy-review` package. It does not initialize the normal session recorder or submit the form.
