# Free / open-source in-browser barcode decoders for retail 1D codes (EAN-13, EAN-8, UPC-A, UPC-E) — state at 15 November 2026

Scope note: npm versions, publish dates, weekly downloads and GitHub data were read on 2026-11-15 with `npm view`, the npm downloads API and `gh`. Sizes marked "measured" come from the npm tarball, compressed locally with `gzip -9` / `brotli -q 11`.

## 1. Which libraries exist, and which are maintained in 2026?

### Takeaway
The only free engine with active, frequent development and good 1D accuracy is ZXing-C++ compiled to WASM (`zxing-wasm`, and the `barcode-detector` ponyfill on top of it). It is also the engine inside most 2025–2026 wrapper components. Quagga2 (1D only) is active again (releases from Nov 2025 to Oct 2026). ZXing-js had new releases in 2026 after a 20-month pause. `html5-qrcode` (the app's current iOS fallback) is in "maintenance mode", has had no npm release since April 2023, and contains an old vendored copy of ZXing-js. ZBar-WASM (`@undecaf/zbar-wasm`) works but has had no release since May 2024.

### Cited Findings

**ZXing-C++ family (WASM)**
- `zxing-wasm` 3.1.7 was published 2026-11-15; MIT; depends only on `type-fest` and `@types/emscripten`; ~5.54 M downloads/week — [npm](https://www.npmjs.com/package/zxing-wasm); [npm downloads API](https://api.npmjs.org/downloads/point/last-week/zxing-wasm)
- `zxing-wasm` repo: last push 2026-11-15, 297 stars, 2 open issues, not archived — [GitHub Sec-ant/zxing-wasm](https://github.com/Sec-ant/zxing-wasm)
- `zxing-wasm` README: "wasm binary size" is ~1.46 MiB for `full` (read + write), ~1.04 MiB for `reader`, ~636 KiB for `writer` — [zxing-wasm README](https://github.com/Sec-ant/zxing-wasm#usage)
- Measured in the 3.1.7 tarball: `dist/reader/zxing_reader.wasm` = 946,598 bytes raw, 409,551 bytes gzip, 322,639 bytes brotli; `dist/full/zxing_full.wasm` = 1,545,839 bytes raw — [unpkg zxing-wasm@3.1.7/dist/reader](https://unpkg.com/browse/zxing-wasm@3.1.7/dist/reader/)
- By default `zxing-wasm` fetches the `.wasm` file from the jsDelivr CDN (default `locateFile` points to `fastly.jsdelivr.net/npm/zxing-wasm@<version>/dist/...`). To self-host (needed for an offline-first PWA), you override `locateFile`; the package exports `ZXING_WASM_SHA256` to check the file — [zxing-wasm README](https://github.com/Sec-ant/zxing-wasm#readme)
- `barcode-detector` 3.2.4 was published 2026-11-15; MIT; depends on `zxing-wasm` 3.1.7 (pinned); ~4.51 M downloads/week — [npm](https://www.npmjs.com/package/barcode-detector); [npm downloads API](https://api.npmjs.org/downloads/point/last-week/barcode-detector)
- `barcode-detector` JS glue: 42.8 kB min / 14.6 kB gzip (WASM not included) — [Bundlephobia](https://bundlephobia.com/package/barcode-detector@3.2.4)
- `barcode-detector` repo: last push 2026-11-15, 242 stars, 1 open issue — [GitHub Sec-ant/barcode-detector](https://github.com/Sec-ant/barcode-detector)
- Upstream `zxing-cpp`: Apache-2.0, last push 2026-11-13, 2,101 stars, 45 open issues. Supports EAN-13, EAN-8, UPC-A, UPC-E, ISBN, EAN-2/5 add-ons, DataBar, Code 39/93/128, ITF, QR, DataMatrix, Aztec, PDF417, etc. — [GitHub zxing-cpp/zxing-cpp](https://github.com/zxing-cpp/zxing-cpp)
- The zxing-cpp project has named commercial sponsors (Allied Vision, KURZ Digital, Moonshine AI, Somco Software, Jake Nelson) and offers paid commercial support — [zxing-cpp README](https://github.com/zxing-cpp/zxing-cpp#sponsors)

**ZXing-js (TypeScript port of Java ZXing)**
- `@zxing/library` 0.23.0 was published 2026-04-29; Apache-2.0; ~3.23 M downloads/week; 456 kB min / 120 kB gzip — [npm](https://www.npmjs.com/package/@zxing/library); [Bundlephobia](https://bundlephobia.com/package/@zxing/library@0.23.0)
- v0.22.0 (2026-04-27, "feature/modernize26") added MicroQR; v0.23.0 (2026-04-29) changed `MultiFormatReader` to log non-`ReaderException` errors. The release before these was v0.21.3 on 2024-08-21 — [zxing-js/library releases](https://github.com/zxing-js/library/releases)
- `zxing-js/library` repo: last push 2026-10-17, 2,947 stars, 191 open issues — [GitHub zxing-js/library](https://github.com/zxing-js/library)
- `@zxing/browser` 0.2.1 was published 2026-07-06; MIT; ~2.16 M downloads/week; 27 kB min / 7 kB gzip (plus `@zxing/library`) — [npm](https://www.npmjs.com/package/@zxing/browser); [Bundlephobia](https://bundlephobia.com/package/@zxing/browser@0.2.1)
- Scanbot (a paid-SDK vendor) wrote in Aug 2025 that zxing-js "is no longer maintained" — [Scanbot blog](https://scanbot.io/blog/popular-open-source-javascript-barcode-scanners/); contradicted by the 2026 releases above — [zxing-js/library releases](https://github.com/zxing-js/library/releases)

**html5-qrcode (current iOS fallback in the app)**
- Latest npm version is still 2.3.8, published 2023-04-15; Apache-2.0; ~2.10 M downloads/week; 370 kB min / 107 kB gzip — [npm](https://www.npmjs.com/package/html5-qrcode); [Bundlephobia](https://bundlephobia.com/package/html5-qrcode@2.3.8)
- README: "Important - Looking for new owners for this project." and "The project is in maintenance mode until further notice. The author shall not be able to make any bug fixes or improvements for the time-being. Pull requests also won't be merged" — [html5-qrcode README](https://github.com/mebjas/html5-qrcode#readme)
- Last commits: 2025-12-01, 2024-01-06 and 2023-09-16 are README-only edits; 453 open issues — [html5-qrcode commits](https://github.com/mebjas/html5-qrcode/commits/master)
- The decoder is a vendored copy of ZXing-js (`third_party/zxing-js.umd.js`) — [html5-qrcode third_party](https://github.com/mebjas/html5-qrcode/tree/master/third_party)

**Quagga2 (1D only)**
- `@ericblade/quagga2` 1.13.0 was published 2026-10-21; MIT; ~62.9 k downloads/week; 154 kB min / 42.7 kB gzip — [npm](https://www.npmjs.com/package/@ericblade/quagga2); [Bundlephobia](https://bundlephobia.com/package/@ericblade/quagga2@1.13.0)
- Releases 1.10.1 (2025-11-16), 1.10.2, 1.11.0 (2025-12-01), 1.12.0 (2025-12-16), 1.12.1 (2025-12-20), 1.13.0 (2026-10-21) — [quagga2 releases](https://github.com/ericblade/quagga2/releases)
- Repo: last push 2026-11-04, 914 stars, 68 open issues — [GitHub ericblade/quagga2](https://github.com/ericblade/quagga2)
- README support table lists Safari iOS as supported (`true`) — [quagga2 README](https://github.com/ericblade/quagga2#readme)
- Scanbot (Nov 2025) describes Quagga2 as 1D-only and "updated regularly", and html5-qrcode as inactive since its April 2023 release — [Scanbot blog](https://scanbot.io/blog/quagga2-vs-html5-qrcode-scanner/)

**ZBar compiled to WASM**
- `@undecaf/zbar-wasm` 0.11.0 was published 2024-05-22; LGPL-2.1+; ~108 k downloads/week; repo last push 2024-07-19; 0 open issues — [npm](https://www.npmjs.com/package/@undecaf/zbar-wasm); [GitHub undecaf/zbar-wasm](https://github.com/undecaf/zbar-wasm)
- README: "Deployment size approx. 330 kByte"; supports EAN/GTIN-5/8/13, ISBN, UPC-A/E, Code 39/93/128, Codabar, DataBar, ITF, QR; "Barcodes may be oriented horizontally or vertically" — [zbar-wasm README](https://github.com/undecaf/zbar-wasm#features)
- Measured: `dist/zbar.wasm` (0.11.0) = 238,653 bytes raw, 173,911 bytes gzip, 138,687 bytes brotli — [unpkg @undecaf/zbar-wasm@0.11.0/dist](https://unpkg.com/browse/@undecaf/zbar-wasm@0.11.0/dist/)
- Older `zbar.wasm` (samsam2310) 2.1.1 was last published 2022-05-25; ~3.6 k downloads/week — [npm](https://www.npmjs.com/package/zbar.wasm)
- `@undecaf/barcode-detector-polyfill` 0.9.23 (2025-07-17) is a BarcodeDetector polyfill on `@undecaf/zbar-wasm` ^0.9.16; ~8.3 k downloads/week — [npm](https://www.npmjs.com/package/@undecaf/barcode-detector-polyfill)
- `web-wasm-barcode-reader` 1.6.1 (2026-04-04) is a newer ZBar-WASM browser scanner; ~427 downloads/week — [npm](https://www.npmjs.com/package/web-wasm-barcode-reader); its author's write-up — [DEV Community](https://dev.to/ilhannegis/barcode-scanning-on-ios-the-missing-web-api-and-a-webassembly-solution-2in2)

**UI wrapper components and the engine inside them**
- `@yudiel/react-qr-scanner` 2.6.0 (2026-05-13), MIT, ~345 k downloads/week, depends on `barcode-detector` ^3.1.3 and `webrtc-adapter` → engine is ZXing-C++ WASM (or native BarcodeDetector) — [npm](https://www.npmjs.com/package/@yudiel/react-qr-scanner)
- `vue-qrcode-reader` 5.7.3 (2025-07-16), ~89 k downloads/week, depends on `barcode-detector` 2.2.2 (pinned, older) — [npm](https://www.npmjs.com/package/vue-qrcode-reader)
- `react-zxing` 3.0.0 (2026-06-01) depends on `barcode-detector` ^3.1.3 (not on ZXing-js, despite the name) — [npm](https://www.npmjs.com/package/react-zxing)
- `react-barcode-scanner` 4.1.0 (2026-08-13) depends on `@undecaf/zbar-wasm` ^0.11.0 — [npm](https://www.npmjs.com/package/react-barcode-scanner)
- `react-qr-barcode-scanner` 2.1.28 (2026-08-05) depends on `@zxing/library` ^0.21.3 — [npm](https://www.npmjs.com/package/react-qr-barcode-scanner)

**Other engines**
- rxing (Rust port of ZXing): Apache-2.0, last push 2026-11-12, 338 stars — [GitHub rxing-core/rxing](https://github.com/rxing-core/rxing); `rxing-wasm` 0.5.9 published 2026-11-08, 42 stars — [npm](https://www.npmjs.com/package/rxing-wasm); [GitHub rxing-core/rxing-wasm](https://github.com/rxing-core/rxing-wasm)
- `wascan` (Rust/wasm-bindgen browser scanner): by default only UPC-A and QR Code are compiled into the WASM (search-result summary; page not opened) — [docs.rs wascan](https://docs.rs/crate/wascan/0.1.8)
- OpenCV.js: `cv.barcode_BarcodeDetector` exists since OpenCV 4.5.3; a Dynamsoft tutorial (updated 2026-07-14) uses prebuilt OpenCV.js 4.8.0, lists EAN-13, EAN-8 and UPC-A (UPC-E not listed), and calls the WASM "large (~8 MB)"; no accuracy figures — [Dynamsoft OpenCV.js tutorial](https://dynamsoft.com/codepool/web-barcode-detector-opencvjs.html)

**Paid SDKs (reference only — not free)**
- STRICH: Basic €99/month (≤10k scans/month, soft limit), Professional €249/month (≤100k), Business from €4,000/year (1 app, +€1,500/year per extra app), Enterprise from €7,500/year; "No per-device fees"; 14-day free trial; no free tier — [strich.io](https://strich.io/)
- Scanbot Web SDK: fixed annual fee with unlimited scans/devices; "generally starts at $2,500"; Scanbot was acquired by Apryse (search-result summary; pages not opened) — [Scanbot contact page](https://scanbot.io/contact); [Scanbot pricing FAQ](https://docs.scanbot.io/faq/pricing-and-licensing-model/). `scanbot-web-sdk` 10.0.0 was published 2026-10-02 — [npm](https://www.npmjs.com/package/scanbot-web-sdk)
- Dynamsoft Barcode Reader JS v11: reseller lists a 10,000-scan annual bundle at US$1,371.02 (v11.4, Feb 2026); per-device prices "Call for Price" (search-result summary; page not opened) — [ComponentSource](https://www.componentsource.com/product/barcode-reader/prices)
- Scandit: `@scandit/web-datacapture-barcode` 8.7.1 published 2026-11-12; requires a licence key; no public price found — [npm](https://www.npmjs.com/package/@scandit/web-datacapture-barcode)

### Inferences
- In practice, the free choice in 2026 is between three engines: ZXing-C++ (WASM), ZBar (WASM) and the pure-JS engines (ZXing-js, Quagga2). rxing and OpenCV.js have no 1D accuracy data and few users; OpenCV.js is ~8 MB.
- Most popular 2025–2026 scanner components (`@yudiel/react-qr-scanner`, `react-zxing`, `vue-qrcode-reader`) moved to `barcode-detector`, so ZXing-C++ is the de-facto free web engine.
- For an offline-first PWA, `zxing-wasm` / `barcode-detector` must be configured to load the `.wasm` from the app's own origin (precached by Workbox); the default loads it from jsDelivr at runtime.
- `html5-qrcode` will not receive decoder fixes. Its ZXing-js copy is older than the 2026 ZXing-js releases.

### Gaps
- No library publishes a tested list of iOS Safari versions. I found no recent per-library iOS 18/26 compatibility report.
- I did not test `rxing-wasm` or `wascan` for EAN accuracy; no benchmark includes them.
- Scandit web pricing is not public.

## 2. Per library: engine, check-digit validation, known false positives, and options that reduce misreads

### Takeaway
All candidates reject EAN/UPC codes with a wrong check digit. They differ in how much agreement they need before they accept a result. ZXing-C++ (zxing-wasm / barcode-detector) by default needs 2 scan lines with the same result (`minLineCount: 2`), and you can raise this in `zxing-wasm`. ZBar drops EAN results seen on fewer than 4 lines in single-image mode. ZXing-js (and so html5-qrcode) accepts the first single row that passes the checksum, and html5-qrcode also sets `TRY_HARDER` to false. Quagga2 accepts a single decode; its own docs say it gives false positives and tell you to filter on its per-digit error values. The `barcode-detector` ponyfill API exposes only `formats`, so you cannot raise `minLineCount` through it.

### Cited Findings

**ZXing-C++ (zxing-wasm, barcode-detector, @yudiel/react-qr-scanner, react-zxing)**
- `ReaderOptions` defaults: `tryHarder` true, `tryRotate` true, `tryInvert` true, `tryDownscale` true, `isPure` false, `minLineCount` 2 ("The number of scan lines in a linear barcode that have to be equal to accept the result"), `maxNumberOfSymbols` 255, `validateOptionalChecksum` false ("e.g. Code39, ITF"), `returnErrors` false ("return the barcodes with errors as well (e.g. checksum errors)"), `eanAddOnSymbol` "Ignore", `binarizer` "LocalAverage" — [zxing-cpp ReaderOptions.h](https://github.com/zxing-cpp/zxing-cpp/blob/master/core/src/ReaderOptions.h); [zxing-wasm ReaderOptions docs](https://sec-ant.github.io/zxing-wasm/docs/interfaces/full.ReaderOptions.html)
- Line-agreement logic: when a row gives a valid code and `minLineCount > 1`, the reader adds check rows above and below; at the end it removes "all symbols with insufficient line count". With `isPure`, `minLineCount` becomes 1 — [zxing-cpp ODReader.cpp](https://github.com/zxing-cpp/zxing-cpp/blob/master/core/src/oned/ODReader.cpp)
- EAN/UPC reader: the result gets `ChecksumError` if `!GTIN::IsCheckDigitValid(...)`; required quiet zones are 6 modules left, 3 modules right for EAN ("used to be 6, see #526 and #558"), 6 modules right for UPC — [zxing-cpp ODMultiUPCEANReader.cpp](https://github.com/zxing-cpp/zxing-cpp/blob/master/core/src/oned/ODMultiUPCEANReader.cpp)
- `barcode-detector` 3.2.4 `detect()` calls zxing-wasm with only `{ textMode: "Plain", formats: [...] }`; all other options stay at zxing-wasm defaults (`tryHarder: true`, `minLineCount: 2`, `maxNumberOfSymbols: 255`) — [unpkg barcode-detector@3.2.4 zxing-exported.js](https://unpkg.com/browse/barcode-detector@3.2.4/dist/es/zxing-exported.js)
- `zxing-wasm` `readBarcodes()` accepts `Blob`, `File`, `ArrayBuffer`, `Uint8Array` or `ImageData` plus `ReaderOptions`, and returns `Promise<ReadResult[]>` — [zxing-wasm README](https://github.com/Sec-ant/zxing-wasm#readbarcodes)
- UPC-A behaviour change (2025): the ponyfill returns UPC-A as a 13-digit `ean_13` value with a leading 0 (e.g. `0697929110035`). The maintainer says zxing-cpp changed this on purpose (the old UPC-A heuristic "violates the ISO specification"); strip the 0 in client code if needed — [barcode-detector #184](https://github.com/Sec-ant/barcode-detector/issues/184)
- Known false positives: after upgrading WASM 2.1.0 → 2.3.0, the camera demo read DataBar "codes" on textured surfaces, a different value each time; the maintainer said commit 8c094df "is substantially reducing the issue, while it is not a 100% fix"; the reporter still saw them in Jan 2026; closed 2026-07-06 — [zxing-cpp #1024](https://github.com/zxing-cpp/zxing-cpp/issues/1024)
- A valid Codabar pattern can be found inside a QR code (false positive) — [zxing-cpp #391](https://github.com/zxing-cpp/zxing-cpp/issues/391)
- No open zxing-wasm or zxing-cpp issue matched "EAN" + "wrong" — [zxing-cpp issues](https://github.com/zxing-cpp/zxing-cpp/issues); [zxing-wasm issues](https://github.com/Sec-ant/zxing-wasm/issues)

**ZXing-js (@zxing/library, @zxing/browser, html5-qrcode)**
- `OneDReader.doDecode`: `rowStep = max(1, height >> (tryHarder ? 8 : 5))`; `maxLines = tryHarder ? height : 25`; it returns on the first row that decodes — there is no multi-row agreement — [zxing-js OneDReader.ts](https://github.com/zxing-js/library/blob/master/src/core/oned/OneDReader.ts)
- `UPCEANReader` checks a quiet zone "at least as big as the end pattern" and throws `ChecksumException` on a bad check digit — [zxing-js UPCEANReader.ts](https://github.com/zxing-js/library/blob/master/src/core/oned/UPCEANReader.ts)
- html5-qrcode sets `hints.set(ZXing.DecodeHintType.TRY_HARDER, false)` with the comment "TODO(minhazav): Make this configurable by developers." — [html5-qrcode zxing-html5-qrcode-decoder.ts](https://github.com/mebjas/html5-qrcode/blob/master/src/zxing-html5-qrcode-decoder.ts)
- html5-qrcode #407 (2022, open): "scans EAN-13 barcode incorrect ... I get the same wrong output every time"; a second user: "the first scan is ok but the second one is not ... the wrong output is not always the same" — [html5-qrcode #407](https://github.com/mebjas/html5-qrcode/issues/407)
- html5-qrcode #744 (2023, open): "Sometimes, at random, onScanSuccess give me a wrong code" (Android Chrome PWA); "onScanSuccess is fired 2 or 3 times sequentially, last time have the correct code, but first and second a wrong code"; fixed by "using timer to filter different codes detected in a tight interval"; another user: "the SAME barcode gives me back 10 different decodeText" — [html5-qrcode #744](https://github.com/mebjas/html5-qrcode/issues/744)
- html5-qrcode #532 (2022, open): "Camera is in focus ... scanner can't. Or after sometimes it reads something incorrect" (Windows Chrome, Android Chrome, iPhone Safari) — [html5-qrcode #532](https://github.com/mebjas/html5-qrcode/issues/532)
- Other open html5-qrcode EAN/UPC issues: #264 "Barcode Ean13 didn't read well", #361 "Can't Read EAN-13 barcodes with Leading Zero", #605 "zxing-js not good at detecting UPC barcodes", #707 iPhone UPC photo not detected — [html5-qrcode issue search "EAN"](https://github.com/mebjas/html5-qrcode/issues?q=EAN)
- html5-qrcode #582 (2022): a user's hands-on test of UPC scanning ranked html5-qrcode third behind Scandit and QuaggaJS "at both quality and speed"; the maintainer then shipped 2.3.1 which "Fixed UPC-A and UPC-E scanning issues in zxing-js dependency. It doesn't improve performance" — [html5-qrcode #582](https://github.com/mebjas/html5-qrcode/issues/582)
- ZXing-js #88 (open since 2018): UPC-A is returned as 13 digits with an extra leading 0 — [zxing-js #88](https://github.com/zxing-js/library/issues/88)

**Quagga2**
- EAN reader rejects a result if `!this._checksum(result)`, checks trailing whitespace, and uses `AVG_CODE_ERROR = 0.48` as the pattern-match threshold — [quagga2 ean_reader.ts](https://github.com/ericblade/quagga2/blob/master/src/reader/ean_reader.ts)
- README: "Quagga is not perfect by any means and may produce false positives from time to time"; "Handling false positives: Most readers provide an error object that describes the confidence of the reader in it's accuracy"; it suggests `barcode-validator` for check-digit checks; reader order matters because "incorrect matches might occur if the wrong reader attempts to decode first" (EAN-13 vs UPC-A) — [quagga2 README](https://github.com/ericblade/quagga2#readme)
- Maintainer's filter recipe: accept if the median of `decodedCodes[].error` ≤ 0.10 and no single error > 0.1; or if median < 0.25 and the code is a valid UPC/ISBN — [quagga2 #351 comment](https://github.com/ericblade/quagga2/issues/351#issuecomment-822649962)
- Quagga2 #360: "when I read a barcode sometimes it reads the data incorrectly, especially when the code is of a reduced size" — [quagga2 #360](https://github.com/ericblade/quagga2/issues/360)
- 1.13.0 (2026-10-21) added missing checksum validation to the Code 32 reader — [quagga2 releases](https://github.com/ericblade/quagga2/releases)
- Quagga2 owns the camera stream (`Quagga.init` with `inputStream` type `LiveStream`) and has `frequency`, `locator.halfSample` and `locator.patchSize` tuning options — [quagga2 README](https://github.com/ericblade/quagga2#readme)

**ZBar (@undecaf/zbar-wasm, react-barcode-scanner, @undecaf/barcode-detector-polyfill)**
- ZBar config keys include `ZBAR_CFG_ADD_CHECK`, `ZBAR_CFG_MIN_LEN`, `ZBAR_CFG_MAX_LEN`, `ZBAR_CFG_UNCERTAINTY` ("required video consistency frames"), `ZBAR_CFG_X_DENSITY` / `Y_DENSITY` — [ZBar zbar.h](https://github.com/mchehab/zbar/blob/master/include/zbar.h)
- Defaults: `UNCERTAINTY` = 2 for all symbologies, then 0 for QR, Code 128, Code 93, Code 39 and 1 for Codabar (so EAN/UPC stay at 2) — [ZBar img_scanner.c](https://github.com/mchehab/zbar/blob/master/zbar/img_scanner.c)
- "FIXME tmp hack to filter bad EAN results": when the inter-frame cache is off and density is 1, EAN/UPC/DataBar/Codabar results with `quality < 4` are dropped — [ZBar img_scanner.c](https://github.com/mchehab/zbar/blob/master/zbar/img_scanner.c)
- `@undecaf/zbar-wasm` exposes `ZBarScanner.setConfig(sym, conf, value)`, the `ZBarConfigType` enum (incl. `ZBAR_CFG_UNCERTAINTY = 64`), `ZBarSymbol.quality`, and `scanImageData(image, scanner?)` — [unpkg @undecaf/zbar-wasm@0.11.0 index.d.ts](https://unpkg.com/browse/@undecaf/zbar-wasm@0.11.0/dist/index.d.ts)

**Camera focus evidence (the developer's second complaint)**
- On phones with 3+ rear cameras, `facingMode: "environment"` can select a wide-angle lens that cannot focus close; the Quagga2 maintainer suggests enumerating devices and passing a `deviceId` — [quagga2 #396](https://github.com/ericblade/quagga2/issues/396)
- Same thread: since iOS 16.4 the first rear camera for `facingMode: "environment"` on 3-camera iPhones is the virtual camera that autofocuses; `focusMode: "continuous"` "does nothing"; Safari only lists "Front camera" and "Back camera"; some Android device/browser pairs allow manual `focusMode: "manual"` + `focusDistance` via `applyConstraints` — [quagga2 #396](https://github.com/ericblade/quagga2/issues/396)
- STRICH notes ZXing-JS camera resolution "could not be set" in its test, and Quagga needed a manual 1280×720 request to match STRICH — [STRICH comparison](https://strich.io/comparison-with-oss.html)

### Inferences
- An EAN/UPC check digit is one mod-10 digit. A decode with two or more wrong digits can still pass it by chance (about 1 in 10 for random errors). So "validates checksum" does not prevent misreads. Agreement between scan lines (ZXing-C++ `minLineCount`, ZBar `quality`) and agreement between video frames are the real protection.
- The misread pattern in html5-qrcode issues (#407, #744: different wrong values, correct value after 2–3 callbacks) fits ZXing-js's single-row acceptance. This is the likely cause of the app's "wrong values" on iOS.
- Switching the iOS path from html5-qrcode to `zxing-wasm` directly lets the app set `formats: ["EAN13","EAN8","UPCA","UPCE"]` (removes DataBar/Codabar false-positive sources), `minLineCount: 3` or higher, and `maxNumberOfSymbols: 1`. Through `barcode-detector` only `formats` can be set.
- On every engine, an app-level rule "accept only after the same value appears in N consecutive frames (N = 2–3)" is cheap and also covers the native Android path.
- The earlier `barcode-detector` trial "felt worse than native" may partly come from the UPC-A → 13-digit `ean_13` change (looks like a wrong value) and from camera/focus setup, not only from the decoder. This is not verified.

### Gaps
- No source gives a measured misread rate for ZXing-js or html5-qrcode on live video.
- I did not find documentation that says whether `minLineCount` > 2 reduces read rate on small/far EAN codes, or by how much.
- I did not confirm whether `@undecaf/zbar-wasm` enables the ZBar inter-frame cache (`zbar_image_scanner_enable_cache`); the d.ts does not show it.

## 3. Published benchmarks comparing decoders on 1D codes

### Takeaway
No independent, current benchmark tests the browser libraries on live retail 1D scanning. The best data is vendor-run (Dynamsoft) on still images. It shows that ZXing-C++ has very few EAN misreads (1 of 793 returns on the 1,054-image Muenster set) but a lower read rate than commercial SDKs, while ZBar reads about as many codes but misreads much more on hard images (34 misreads on Muenster). In the browser, zxing-wasm 3.1.2 read 78.5% of EAN-13 instances in a 7,894-image set, with 1.83% wrong reads across all formats.

### Cited Findings
- **Dynamsoft 1D accuracy benchmark** (page "Updated Nov 13, 2026"; vendor). Metric: reading rate = correct / all; precision = correct / all returned. Datasets: Artelab Set 1 (215 images, autofocus), Artelab Set 2 (215, no autofocus), Muenster BarcodeDB (1,054), DEAL Lab (2,000) — [Dynamsoft 1D benchmark](https://dynamsoft.com/codepool/barcode-scanning-accuracy-benchmark-and-comparison.html)
  - Artelab Set 1: Dynamsoft 215 correct / 0 misreads; Scandit 197 / 0; ZXing-CPP 177 / 1 (82.33%); pyZbar 193 / 1 (89.77%)
  - Artelab Set 2 (out of focus): Dynamsoft 176 / 0 (81.86%); Scandit 169 / 1 (79.07%); ZXing-CPP 22 / 2 (10.23%, precision 91.67%); pyZbar 30 / 8 (13.95%, precision 78.95%)
  - Muenster: Dynamsoft 1,022 / 0 (96.96%); Scandit 984 / 0 (93.26%); ZXing-CPP 792 / 1 (75.14%, precision 99.87%); pyZbar 744 / 34 (70.59%, precision 95.63%)
  - DEAL Lab: Dynamsoft 1,839 / 0 (91.95%); Scandit 1,221 / 0 (61.05%); ZXing-CPP 1,264 / 26 (63.20%, precision 97.98%); pyZbar 1,452 / 9 (72.60%, precision 99.38%)
  - Caveats stated on the page: only the Dynamsoft column (DBR 11.6.5000) is re-run; ZXing-CPP and pyZbar versions are not pinned (pyZbar 0.1.9 is from 2022); the Scandit column is a 2021 measurement. The Scandit Set-2 precision of 100% does not match its 1 misread (169/170 = 99.41%) — [Dynamsoft 1D benchmark](https://dynamsoft.com/codepool/barcode-scanning-accuracy-benchmark-and-comparison.html)
- **Dynamsoft zxing-wasm vs DBR in a browser** (vendor): BarBeR dataset, 7,894 images, 8,411 scored instances; zxing-wasm 3.1.2 vs DBR 11.6.5000; headless Edge 156 on Windows 11 desktop (i5-13400F); one pass; zxing-wasm reader options not stated — [Dynamsoft JS benchmark](https://www.dynamsoft.com/codepool/benchmark-barcode-reading-javascript-zxing-wasm-dynamsoft-barcode-reader.html)
  - zxing-wasm: 5,958 correct, recall 70.84%, precision 94.96%, 154 wrong reads (1.83%), 2,299 no-reads; mean/median/P95 decode 116.22 / 70.20 / 389.70 ms
  - DBR: 7,638 correct, recall 90.81%, precision 95.97%, 90 wrong reads (1.07%); 121.05 / 95.50 / 298.40 ms
  - EAN-13: zxing-wasm 3,814 / 4,857 vs DBR 4,727 / 4,857. UPC-A: 257 / 319 vs 313 / 319. Per-format wrong reads are not given.
- **STRICH comparison** (vendor; published 2023-05-03, "Updated October 27, 2026"): Samsung Galaxy S21 FE; 4 "missions" with 11 shipping-label codes (Code 128, Code 39, Aztec, DataMatrix — no EAN/UPC); each repeated ≥3 times; library versions not stated. Quagga 3/3 in mission 1 with 1 misread (`F%$B56t+46210000816C`), 0/3 on degraded print; ZXing-JS 2/3, 1/3, 1/2, 3/3 with 0 misreads in missions 1–2; STRICH all codes, 0 misreads. html5-qrcode was excluded because it uses ZXing-JS — [STRICH comparison](https://strich.io/comparison-with-oss.html)
- **Dynamsoft Python ZXing vs ZBar** (vendor; search snippet only, not fully read): ZXing-Cpp fastest at 40.2 ms average but 23.8% success on multi-barcode images; pyzbar 76.8% success overall — [Dynamsoft Python comparison](https://www.dynamsoft.com/codepool/python-zxing-zbar-barcode.html)
- **BarBeR** (Vezzali et al., ICPR 2024) is an academic benchmark mainly for barcode *localization*; its decoding-rate test uses `pyzbar` only — [BarBeR GitHub](https://github.com/Henvezz95/BarBeR); [BarBeR dataset](https://ditto.ing.unimore.it/barber); [paper](https://link.springer.com/chapter/10.1007/978-3-031-78447-7_13)
- **Informal user test** (2022): UPC scanning — Scandit best, QuaggaJS close, html5-qrcode "relatively far" behind on quality and speed — [html5-qrcode #582](https://github.com/mebjas/html5-qrcode/issues/582)

### Inferences
- On EAN images, ZXing-C++ is the most precise free engine in the data found (≥ 97.98% precision on all four sets except the out-of-focus set). ZBar reads a little more on some sets but misreads more, especially on blurred images.
- The out-of-focus set gives the most misreads for both free engines. This links the developer's two complaints: poor focus produces blurred frames, and blurred frames produce misreads.
- These are single still images. Live scanning sees many frames, so multi-frame agreement lowers the effective misread rate further. No benchmark measures this.
- Computed from the JS benchmark: zxing-wasm EAN-13 read rate 78.5% vs DBR 97.3%; UPC-A 80.6% vs 98.1%.

### Gaps
- No benchmark found that includes ZXing-js, html5-qrcode, Quagga2 or native BarcodeDetector on EAN/UPC images with misread counts.
- The BarBeR paper PDF returned HTTP 403; I could not read the authors' own decoding numbers.
- Dynamsoft's "four SDK" (Dynamsoft vs Scandit vs Scanbot vs STRICH, 83 images) benchmark was not read — [Dynamsoft four-SDK benchmark](https://dynamsoft.com/blog/insights/benchmark-four-sdk-barcode-scanner-real-world-performance/)

## 4. Which engine is behind Chrome-on-Android `BarcodeDetector`, and is there evidence of misreads?

### Takeaway
Chrome on Android implements `BarcodeDetector` with the Google Play Services Mobile Vision barcode API (`com.google.android.gms.vision.barcode.BarcodeDetector`). The web page can set only `formats`. I found no public report of systematic EAN misreads from it.

### Cited Findings
- Chromium `BarcodeDetectionImpl.java` imports `com.google.android.gms.vision.barcode.BarcodeDetector` and says "Implementation of mojo BarcodeDetection, using Google Play Services vision package"; it maps formats incl. `EAN_13`, `EAN_8`, `UPC_A`, `UPC_E`; "The vision library will be downloaded the first time the API is used" — [Chromium BarcodeDetectionImpl.java](https://chromium.googlesource.com/chromium/src/+/HEAD/services/shape_detection/android/java/src/org/chromium/shape_detection/BarcodeDetectionImpl.java)
- Desktop Chromium: macOS uses Apple Vision (`barcode_detection_impl_mac_vision.*`); ChromeOS uses a "barhopper" backend — [Chromium shape_detection](https://chromium.googlesource.com/chromium/src/+/HEAD/services/shape_detection/); [Chromium Lacros commit](https://chromium.googlesource.com/chromium/src/+/f9b60058e80f142a19c39ef37ed314e5ff27334e)
- MDN compat data: `chrome_android` 83 (no flag); desktop Chrome "Supported on ChromeOS and macOS only"; Firefox not supported — [MDN BCD BarcodeDetector.json](https://chromium.googlesource.com/external/github.com/mdn/browser-compat-data/+/HEAD/api/BarcodeDetector.json)
- The Mobile Vision barcode API came with Play Services 7.8 (2015) — [Android Developers Blog](https://android-developers.googleblog.com/2015/08/barcode-detection-in-google-play.html); ML Kit is Google's current barcode API — [ML Kit Android docs](https://developers.google.cn/ml-kit/vision/barcode-scanning/android)
- A third-party scanner recipe built on `BarcodeDetector` still validates the EAN/UPC check digit and fires only after the same value appears in several consecutive frames (default 2) (search-result summary; page not opened) — [Zite barcode recipe](https://developers.zite.com/recipes/barcode-scanning.md)
- WebKit bug commenters say native scanning on Android (Pixel) reads barcodes that iOS fails on — [WebKit bug 281848](https://bugs.webkit.org/show_bug.cgi?id=281848)

### Inferences
- The Android native path has no tuning knobs (no `minLineCount`, no `tryHarder`). If misreads happen there, the only fix is app-level (multi-frame agreement, format restriction).
- The developer's "wrong values" are more likely from the iOS html5-qrcode path than from native Android, given the html5-qrcode issue history. This should be checked by logging which path produced each wrong value.

### Gaps
- I did not find whether the GMS Vision API now uses the same model as ML Kit internally.
- No published misread rate for Chrome Android `BarcodeDetector` found.

## 5. Does Safari on iOS (18 / 26) ship `BarcodeDetector` by default?

### Takeaway
No. As of November 2026, `BarcodeDetector` in Safari is behind the "Shape Detection API" feature flag. On iOS it has been reported broken even with the flag on, from iOS 18 through the first iOS 26 beta. The WebKit bug is still NEW and unassigned. A WASM decoder remains necessary on iOS.

### Cited Findings
- MDN compat data: Safari `version_added: "17"` with flag preference "Shape Detection API" = true; `safari_ios` mirrors Safari — [MDN BCD BarcodeDetector.json](https://chromium.googlesource.com/external/github.com/mdn/browser-compat-data/+/HEAD/api/BarcodeDetector.json)
- WebKit bug 281848 "Shape Detection API doesn't work on iOS": status NEW, P2, unassigned, InRadar. Reports: works with the flag up to Safari 17.6.x; fails on iOS 18, 18.3, 18.4, 18.5; on iOS 26 developer beta 1 (2025-06-12) "no test barcodes were read" and the API "is still behind a feature flag in iOS 26"; last comment 2026-07-21 asks for alternatives. No WebKit engineer comment — [WebKit bug 281848](https://bugs.webkit.org/show_bug.cgi?id=281848)
- Older feature request for `BarcodeDetector` in WebKit — [WebKit bug 198174](https://bugs.webkit.org/show_bug.cgi?id=198174)
- Developer write-up: Safari "and by extension every browser on iOS ... simply doesn't implement it"; recommends WASM decoders — [DEV Community](https://dev.to/ilhannegis/barcode-scanning-on-ios-the-missing-web-api-and-a-webassembly-solution-2in2)
- Search of Safari 26.x release notes found no mention of Shape Detection or `BarcodeDetector` — [Safari 26 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes); [WebKit Features for Safari 26.1](https://webkit.org/blog/17541/webkit-features-for-safari-26-1/)

### Inferences
- An app cannot rely on native detection on iOS in 2026, and users will not turn on Safari feature flags. The iOS path needs a WASM or JS decoder.
- Because all browsers on iOS use WebKit, Chrome on iOS has the same gap.

### Gaps
- I did not read every Safari 26.0–26.5 release note in full; the absence of the feature is based on search results plus the open WebKit bug.
- No test result for iOS 26 release builds (only beta 1) was found.
