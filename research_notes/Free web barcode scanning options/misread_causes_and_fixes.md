# Why web barcode scanners return wrong EAN/UPC values, and how to stop misreads

Scope: retail EAN-13 / UPC-A / EAN-8 / UPC-E on food packaging, scanned in a PWA (Android Chrome `BarcodeDetector`, iOS Safari `html5-qrcode` 2.3.8). State as of 15 November 2026. Source code was read from the `master`/`main` branches on that date unless noted.

App baseline (from the brief): formats `ean_13, ean_8, upc_a, upc_e, code_128, itf`; full-frame decode at about 9-10 fps; the first frame whose value is all digits with length 8/12/13/14 wins; no check-digit validation, no multi-frame confirmation, no region of interest (ROI) on Android.

---

## Q1. Do the decoders verify the EAN/UPC check digit internally? Can a wrong value still pass?

### Takeaway
ZXing (Java/JS), zxing-cpp, ZBar and Quagga2 all reject EAN-13/EAN-8/UPC-A reads with a bad mod-10 check digit. Chrome's Android backend (Google Play Services Mobile Vision) does not document what it checks. A wrong value can still pass: the mod-10 check misses about 10% of adjacent transpositions and about 1 in 10 multi-digit errors, and ZXing-js (which html5-qrcode bundles) validates UPC-E with the wrong formula, so UPC-E results from the iOS path get no real check-digit protection.

### Cited Findings
- **ZXing-js (EAN-13/EAN-8/UPC-A):** `UPCEANReader.decodeRow` throws when the checksum fails: `if (!UPCEANReader.checkChecksum(resultString)) { throw new ChecksumException(); }`. It also requires a right quiet zone "at least as big as the end pattern" (`let quietEnd = end + (end - endRange[0]);`). — [zxing-js UPCEANReader.ts](https://github.com/zxing-js/library/blob/master/src/core/oned/UPCEANReader.ts)
- **ZXing-js UPC-E bug (source reading):** `UPCEReader` overrides an *instance* method `checkChecksum(s) { return UPCEANReader.checkChecksum(UPCEReader.convertUPCEtoUPCA(s)); }`, but `UPCEANReader.decodeRow` calls the *static* `UPCEANReader.checkChecksum(resultString)`. So the 8-digit UPC-E string is checked with the plain EAN mod-10 over the compressed digits, not over the expanded UPC-A as GS1 requires. In Java ZXing the same call is polymorphic, so the TypeScript port lost the override. — [zxing-js UPCEANReader.ts](https://github.com/zxing-js/library/blob/master/src/core/oned/UPCEANReader.ts), [zxing-js UPCEReader.ts](https://github.com/zxing-js/library/blob/master/src/core/oned/UPCEReader.ts)
- The same static call (`if (!UPCEANReader.checkChecksum(resultString))`, line ~8233) and the unused override (`checkChecksum(s) { return UPCEANReader.checkChecksum(UPCEReader.convertUPCEtoUPCA(s)); }`, line ~8514) are in the ZXing-js copy that html5-qrcode 2.3.8 ships. — [html5-qrcode@2.3.8 third_party/zxing-js.umd.js](https://unpkg.com/html5-qrcode@2.3.8/third_party/zxing-js.umd.js)
- Worked example (computed locally): the UPC-E `04252614` expands to UPC-A `042100005264`, whose check digit `4` is valid. The naive 8-digit mod-10 over `0425261` gives `0`, so ZXing-js would reject this real code. The same algorithm is used in [zxing-js UPCEReader.convertUPCEtoUPCA](https://github.com/zxing-js/library/blob/master/src/core/oned/UPCEReader.ts).
- ZXing-js `convertUPCEtoUPCA` has other defects: it converts characters to char codes (`.map(x => x.charCodeAt(0))`) and then `switch`es on the numbers `0..4`, so those cases never match. `StringBuilder.appendChars` loops on `offset < offset + len`, which never ends. These only matter if the method is called; the static call path above means it is not called during decode. — [zxing-js UPCEReader.ts](https://github.com/zxing-js/library/blob/master/src/core/oned/UPCEReader.ts), [zxing-js StringBuilder.ts](https://github.com/zxing-js/library/blob/master/src/core/util/StringBuilder.ts)
- **EAN-13 vs UPC-A leading zero (ZXing-js):** when an EAN-13 result starts with `0` and UPC-A is among the requested formats, ZXing-js returns `result.getText().substring(1)` with format `UPC_A`. So the app receives 12 digits for those codes. — [zxing-js MultiFormatUPCEANReader.ts](https://github.com/zxing-js/library/blob/master/src/core/oned/MultiFormatUPCEANReader.ts)
- **zxing-cpp:** `MultiUPCEANReader` converts UPC-E to UPC-A for validation (`res.txt = "0" + UPCEANCommon::ConvertUPCEtoUPCA(res.txt);`) and sets `Error error = !GTIN::IsCheckDigitValid(res.txt) ? ChecksumError() : Error();`. It relaxed the right EAN quiet zone: `QUIET_ZONE_RIGHT_EAN = 3; // used to be 6, see #526 and #558`. — [zxing-cpp ODMultiUPCEANReader.cpp](https://github.com/zxing-cpp/zxing-cpp/blob/master/core/src/oned/ODMultiUPCEANReader.cpp)
- zxing-cpp drops results with errors unless asked: `returnErrors` "If true, return the barcodes with errors as well (e.g. checksum errors...) (default: false)". — [zxing-cpp ReaderOptions.h](https://github.com/zxing-cpp/zxing-cpp/blob/master/core/src/ReaderOptions.h)
- **ZBar:** `ean_verify_checksum()` is applied to EAN-13 (`ean_verify_checksum(ean, 12)`) and EAN-8 (`ean_verify_checksum(ean, 7)`). — [ZBar decoder/ean.c](https://github.com/mchehab/zbar/blob/master/zbar/decoder/ean.c)
- **Quagga2:** `ean_reader` runs `if (!this._checksum(result))` before it returns a result. Its per-digit match tolerance is loose: `AVG_CODE_ERROR = 0.48`. — [Quagga2 ean_reader.ts](https://github.com/ericblade/quagga2/blob/master/src/reader/ean_reader.ts)
- Quagga2 collaborator ericblade (2020): check digits alone are unreliable for UPC; misreads can still pass. He proposed: accept if the check digit validates and the error rate is < 50 %, or if the error rate is < 20 %. — [quaggaJS issue #237](https://github.com/serratus/quaggaJS/issues/237)
- **Chrome BarcodeDetector on Android:** Chromium's backend is `org.chromium.shape_detection.BarcodeDetectionImpl`. It imports `com.google.android.gms.vision.barcode.BarcodeDetector` (the legacy Play Services Mobile Vision API), calls `mBarcodeDetector.detect(frame)` and copies `barcode.rawValue`. Chromium adds no validation. — [Chromium BarcodeDetectionImpl.java](https://chromium.googlesource.com/chromium/src/+/main/services/shape_detection/android/java/src/org/chromium/shape_detection/BarcodeDetectionImpl.java)
- ML Kit (the successor of Mobile Vision) returns a leading-0 EAN-13 as UPC-A (format 512) without the leading 0. terryburton: "From a decoding perspective, EAN-13 beginning "0" and UPC-A are one and the same thing." Issue opened 21 March 2024, no maintainer answer. — [googlesamples/mlkit #797](https://github.com/googlesamples/mlkit/issues/797)
- **Strength of the mod-10 check:** weights alternate 3 and 1; it "will detect all single digit errors" and "recognizes 90% of transposition errors (all cases, where the difference between adjacent digits is not 5)". — [Wikipedia: International Article Number](https://en.wikipedia.org/wiki/International_Article_Number)
- **Real misreads that passed the checks:** an open ZXing-js (ngx-scanner) bug from 6 January 2026 reports EAN-13 with "often the first 4–5 digits wrong", sometimes the whole value wrong, and different results on repeated scans of the same code; no fix or maintainer reply. — [zxing-js/ngx-scanner #601](https://github.com/zxing-js/ngx-scanner/issues/601)
- Scanbot (27 Nov 2025) lists "False positives with EAN codes" as a Quagga2 limitation and says html5-qrcode has had "no releases since April 2023" and is "in maintenance mode". — [Scanbot: Quagga2 vs html5-qrcode](https://scanbot.io/blog/quagga2-vs-html5-qrcode-scanner/)
- npm confirms html5-qrcode `latest` is 2.3.8, published 2023-04-15; `@zxing/library` `latest` is 0.23.0 (2026-04-29), so the html5-qrcode bundle is an older ZXing-js copy. — [npm registry: html5-qrcode](https://registry.npmjs.org/html5-qrcode), [npm registry: @zxing/library](https://registry.npmjs.org/@zxing/library)

### Inferences
- For EAN-13/EAN-8/UPC-A, a wrong value must have errors that cancel in the mod-10 sum. With two or more random digit errors, about 1 in 10 such wrong strings pass. The ngx-scanner report ("first 4–5 digits wrong") fits this: multi-digit garbage that happens to pass mod-10.
- For UPC-E on iOS (html5-qrcode/ZXing-js), about 90 % of real UPC-E products are always rejected, and a misdecoded UPC-E passes about 1 time in 10 regardless of truth. So any `UPC_E` result from html5-qrcode is weakly trusted. App-side GS1 validation over the expanded UPC-A fixes this.
- Because the app does no validation, any non-GTIN symbology read (ITF, Code 128) with length 8/12/13/14 reaches Open Food Facts with no check at all.

### Gaps
- No public source says whether Mobile Vision / ML Kit validates EAN/UPC check digits or votes across scan lines. Test this with a printed EAN-13 with a deliberately wrong check digit.
- I found no ZXing-js issue that reports the UPC-E static-call bug. The finding comes from reading the source; it is not confirmed by a test on a device.
- The "ZXing-js `ean` double check" in the brief: I found no such option in ZXing-js. `OneDReader` has no minimum-line-count setting (contrast zxing-cpp `minLineCount`).

---

## Q2. How much do ITF and Code 128 add to false positives when scanning grocery EAN codes? Should a food app drop them?

### Takeaway
Drop both. Retail food at point of sale uses EAN/UPC (and GS1 DataBar for fresh items); ITF-14 and GS1-128 are for cases and pallets, not consumer units. ITF has no mandatory check digit and decoders protect against false positives only by length and quiet-zone rules, so ITF is the most likely source of plausible-looking wrong numbers. Code 128 has a mandatory check symbol and is lower risk, but adds nothing for this app.

### Cited Findings
- GS1: GS1-128 and ITF-14 are "for general distribution only", not for retail point of sale; ITF-14 carries only the GTIN. — [GS1 fact sheet: GS1 1D symbols for general distribution only (PDF)](https://www.gs1.org/docs/barcodes/GS1%2520Barcodes%2520Fact%2520Sheet%2520-%2520GS1%25201D%2520symbols%2520for%2520general%2520distribution%2520only.pdf); EAN/UPC are the POS symbols "designed for high-volume scanning environments" — [GS1 Canada barcode standards](https://gs1ca.org/standards/barcode-standards/) (both seen via search result summaries, not full-text fetched).
- **ZXing ITF length rule:** `DEFAULT_ALLOWED_LENGTHS = [6, 8, 10, 12, 14]` with the comment "Valid ITF lengths. Anything longer than the largest value is also allowed." — [zxing-js ITFReader.ts](https://github.com/zxing-js/library/blob/master/src/core/oned/ITFReader.ts). Java: `if (!lengthOK && length > maxAllowedLength) { lengthOK = true; }` — [ZXing ITFReader.java](https://github.com/zxing/zxing/blob/master/core/src/main/java/com/google/zxing/oned/ITFReader.java)
- ZXing-js ITF expects a quiet zone of `this.narrowLineWidth * 10` pixels before the start and after the end. No checksum is checked. — [zxing-js ITFReader.ts](https://github.com/zxing-js/library/blob/master/src/core/oned/ITFReader.ts)
- **zxing-cpp ITF:** `const int minCharCount = _opts.formats().size() == 1 ? 4 : 6; // if we are only looking for ITF, we accept shorter symbols` and `const int minQuietZone = 6; // spec requires 10`. The check digit only sets the symbology identifier (`'1'` if valid) unless `validateOptionalChecksum` is on. — [zxing-cpp ODITFReader.cpp](https://github.com/zxing-cpp/zxing-cpp/blob/master/core/src/oned/ODITFReader.cpp)
- zxing-cpp: `validateOptionalChecksum` "Validate optional checksums where applicable (e.g. Code39, ITF) (default: false)". — [zxing-cpp ReaderOptions.h](https://github.com/zxing-cpp/zxing-cpp/blob/master/core/src/ReaderOptions.h)
- The zxing-cpp ITF header says short lengths are not scanned "to avoid false positives", "due to a lack of required checksum function" (seen in the 0.5.1 copy). — [docs.rs zxing-cpp 0.5.1 ODITFReader.h](https://docs.rs/crate/zxing-cpp/0.5.1/source/core/src/oned/ODITFReader.h)
- **ZBar:** Interleaved 2 of 5 has `CFG(dcode->i25, ZBAR_CFG_MIN_LEN) = 6`. — [ZBar decoder.c](https://github.com/mchehab/zbar/blob/master/zbar/decoder.c). ZBar trusts Code 128 on a single read (`ZBAR_CODE128, ZBAR_CFG_UNCERTAINTY, 0`) but needs more for the default/EAN (`0, ZBAR_CFG_UNCERTAINTY, 2`). — [ZBar img_scanner.c](https://github.com/mchehab/zbar/blob/master/zbar/img_scanner.c)
- **Quagga2 i2of5 reader** has tolerances `SINGLE_CODE_ERROR = 0.78; AVG_CODE_ERROR = 0.38`, tightened to `0.38`/`0.09` in its stricter mode. — [Quagga2 i2of5_reader.ts](https://github.com/ericblade/quagga2/blob/master/src/reader/i2of5_reader.ts)
- Dynamsoft names "misrecognizing the 1D barcode as another 1D barcode type" as a misread cause, and says specifying the expected formats lowers "the probability of misread results". — [Dynamsoft: accuracy](https://www.dynamsoft.com/barcode-reader/docs/core/performance/accuracy.html)
- ML Kit: restricting formats improves detector speed (it makes no accuracy claim). — [ML Kit barcode scanning (Android)](https://developers.google.com/ml-kit/vision/barcode-scanning/android)
- A ZXing maintainer comment (via search summary) says a format is left off by default because it "will result in too many false positives when scanning other formats". — [ZXing Google Group thread](https://groups.google.com/g/zxing/c/gFjUt-pKMuo) (search summary; exact thread context not verified)

### Inferences
- ITF lengths 8, 12 and 14 pass the app's length filter (8/12/13/14), and ITF has no check that the app would apply. An ITF false positive on a package (stripes, text, or part of an EAN symbol) can therefore produce a plausible GTIN-length string.
- EAN's 5-element centre guard is all narrow elements, which matches ITF's narrow start pattern; the ITF quiet-zone rule is the main guard against starting inside an EAN symbol. zxing-cpp relaxes this to 6 narrow widths (spec 10), so it is more lenient than ZXing-js.
- GS1-128 values start with an Application Identifier (for example `01` + GTIN-14 = 16 digits), so most real GS1-128 reads are already removed by the app's length filter; Code 128 brings only cost (extra decoder work per frame) and no benefit.
- A consumer may scan an ITF-14 on an outer case. That is rare for a calorie app, and the ITF-14 GTIN is normally a different (packaging-level) GTIN than the consumer unit, so Open Food Facts would not find it anyway.

### Gaps
- I found no measured false-positive rate for ITF when scanning EAN-only scenes, and no specific GitHub issue that shows "ITF result returned while scanning an EAN-13". Test this with the app's own logging (record `format` per result).
- Mobile Vision's internal ITF rules (length, quiet zone, checksum) are not documented.

---

## Q3. Multi-frame consensus: how do serious scanners confirm a 1D read, and what N is typical?

### Takeaway
Every serious engine needs a 1D result to be seen more than once before it reports it: zxing-cpp and STRICH need 2 agreeing scan lines in one frame; STRICH also needs 2 occurrences over time for weak-checksum 1D codes; Dynamsoft needs 2 identical results within 5 frames; ZBar's video cache needs repeats for EAN; Quagga users use 3 identical results in a row or error thresholds. N = 2 (in a window of about 5 frames) is the common default; N = 3 is used by apps with weaker decoders.

### Cited Findings
- **zxing-cpp:** `minLineCount` — "The number of scan lines in a linear barcode that have to be equal to accept the result (default: 2)". — [zxing-cpp ReaderOptions.h](https://github.com/zxing-cpp/zxing-cpp/blob/master/core/src/ReaderOptions.h). The reader only counts results with `r.lineCount >= minLineCount`, and sets `minLineCount = 1` only for `isPure` images. — [zxing-cpp ODReader.cpp](https://github.com/zxing-cpp/zxing-cpp/blob/master/core/src/oned/ODReader.cpp)
- **ZXing Java/JS:** `OneDReader.doDecode` scans rows from the middle outward and returns on the first row that decodes; there is no line-agreement option. Without `TRY_HARDER` it tries `maxLines = 25` rows spaced `height >> 5` apart. — [zxing-js OneDReader.ts](https://github.com/zxing-js/library/blob/master/src/core/oned/OneDReader.ts), [ZXing OneDReader.java](https://github.com/zxing/zxing/blob/master/core/src/main/java/com/google/zxing/oned/OneDReader.java)
- html5-qrcode sets `hints.set(ZXing.DecodeHintType.TRY_HARDER, false);`. — [html5-qrcode zxing-html5-qrcode-decoder.ts](https://github.com/mebjas/html5-qrcode/blob/master/src/zxing-html5-qrcode-decoder.ts)
- **STRICH:** `minScanlinesNeeded` (default 2): "Increasing this parameter reduces the possibility of a misread"; `hysteresisMinCount` (default 2): "Set the minimum occurrence count for 1D barcodes with weak checksums in a given time window for it be accepted"; `duplicateInterval` (default 750 ms). — [STRICH EngineConfiguration](https://docs.strich.io/reference/interfaces/EngineConfiguration.html)
- **Dynamsoft:** with `CMultiFrameResultCrossFilter`, a result is "verified and output only if a certain barcode result appears twice or more within the past few frames"; documented defaults for barcodes are a 5-frame window and 2 consistent frames. Also `MinResultConfidence` default 30 (DBR ≥ 8.8). — [Dynamsoft: accuracy](https://www.dynamsoft.com/barcode-reader/docs/core/performance/accuracy.html), [Dynamsoft iOS CrossVerificationCriteria](https://www.dynamsoft.com/capture-vision/docs/mobile/programming/ios/api-reference/utility/cross-verification-criteria.html) (defaults from search summary)
- **ZBar:** default `ZBAR_CFG_UNCERTAINTY` is 2 (all symbologies), 0 for QR, Code 128, Code 93, Code 39, 1 for Codabar. In the video result cache a new symbol gets `entry->cache_count = -iscn->sym_configs[0][h]` and each sighting within `CACHE_PROXIMITY 1000 /* ms */` increments it; a symbol is counted as new when `cache_count` is 0. — [ZBar img_scanner.c](https://github.com/mchehab/zbar/blob/master/zbar/img_scanner.c)
- **Quagga2:** README section "Handling false positives": "Most readers provide an error object that describes the confidence of the reader in it's accuracy" and points to quaggaJS #237. — [Quagga2 README](https://github.com/ericblade/quagga2/blob/master/README.md)
- quaggaJS #237 techniques (2017–2022): average error `< 0.1`; median error `< 0.10`; ericblade's rule `probablyValid: !(median > 0.10 || errors.some((err) => err > 0.1))`, with a looser `median < 0.25` allowed when the UPC checksum validates; reon777 accepted a code only when the last 3 results were identical (`codes.every(v => v === codes[0])`); another user took the mode of 20 reads. — [quaggaJS issue #237](https://github.com/serratus/quaggaJS/issues/237)
- A Zite recipe for `BarcodeDetector` fires its callback only after the same value is confirmed across multiple frames (search summary). — [Zite barcode scanning recipe](https://developers.zite.com/recipes/barcode-scanning.md)

### Inferences
- At the app's ~9-10 fps, "2 identical normalized GTINs within the last 5 frames" adds about 100-500 ms. "3 in a row" adds about 300 ms when the code is held still, and tolerates nothing between.
- Count consensus on the *normalized, check-digit-valid* GTIN, so that a UPC-A and its EAN-13 form vote together and invalid strings never vote.
- `BarcodeDetector.detect()` returns one result per frame from a black box; the app cannot get line counts, so frame voting is the only consensus available on Android.

### Gaps
- I found no published A/B numbers that show misread rate versus N for web scanners.
- Mobile Vision may already vote internally across lines; not documented.

---

## Q4. Region of interest and resolution: does cropping or scaling change misread rate or speed?

### Takeaway
Vendors tie misreads to small module size, and ML Kit asks for at least 2 pixels per module (EAN-13 ≥ 190 px wide) at 720p-1080p, not native resolution. Cropping to a scan box removes background clutter that other symbologies can mis-decode and makes the barcode fill the decoded image. No source gives a measured misread change from cropping alone.

### Cited Findings
- ML Kit: "the smallest meaningful unit of the barcode should be at least 2 pixels wide"; an EAN-13 should have bars and spaces "at least 2, 4, 6, and 8 pixels wide" (95 modules → at least 190 px). "For typical applications, it's recommended to provide a higher resolution image, such as 1280x720 or 1920x1080." "Don't capture input at the camera's native resolution", "no more than 2 megapixels" is usually enough. — [ML Kit barcode scanning (Android)](https://developers.google.com/ml-kit/vision/barcode-scanning/android)
- Dynamsoft: "The smaller the module size of the barcodes, the higher risk of a misread"; raising `ModuleSizeRangeArray` `MinValue` makes the SDK "skip the small-module barcodes". — [Dynamsoft: accuracy](https://www.dynamsoft.com/barcode-reader/docs/core/performance/accuracy.html)
- Dynamsoft also filters by text length/regex (`BarcodeTextLengthRangeArray`, `BarcodeTextRegexPattern`). — [Dynamsoft: accuracy](https://www.dynamsoft.com/barcode-reader/docs/core/performance/accuracy.html)
- zxing-cpp scans downscaled copies by default: `tryDownscale` "(default: true)", with `downscaleThreshold` and `downscaleFactor` "meaningful values are 2, 3 and 4". — [zxing-cpp ReaderOptions.h](https://github.com/zxing-cpp/zxing-cpp/blob/master/core/src/ReaderOptions.h)
- ZXing-js without TRY_HARDER examines 25 rows spaced 1/32 of image height ("covers roughly 78% of image height") around the middle. — [zxing-js OneDReader.ts](https://github.com/zxing-js/library/blob/master/src/core/oned/OneDReader.ts)
- html5-qrcode `qrbox` defines the scan region the library draws and decodes (config fields `qrbox`, `disableFlip`). — [html5-qrcode html5-qrcode.ts](https://github.com/mebjas/html5-qrcode/blob/master/src/html5-qrcode.ts)

### Inferences
- On Android the app decodes the full 1920x1080 frame. A centred crop (for example 80 % width × 40 % height, passed to `detect()` as an `ImageBitmap`/canvas) lowers the chance that text, stripes or a second barcode produce the result, and makes the "nearest barcode" the only one. It also lowers per-frame cost.
- On iOS with `qrbox 250x150`, a 95-module EAN-13 needs ≥ 190 px in the decoded image for 2 px/module, so the user must fill most of the box width; too-small codes increase the misread risk that Dynamsoft describes. A wider box (for example 80 % of the viewfinder width) suits 1D codes better than a QR-style box.
- Width matters more than height for 1D. A short, wide ROI keeps all bars in view at a usable module size.

### Gaps
- No source measured misread rate with versus without ROI cropping for BarcodeDetector or ZXing-js.

---

## Q5. Motion blur and out-of-focus frames: do decoders return wrong digits, and how to reject such frames?

### Takeaway
Yes. Blur is the condition where open-source engines misread most, and vendors state that blur and accuracy are inversely related. The proven defences are multi-line and multi-frame agreement plus check-digit validation; explicit blur scoring is used by commercial SDKs but has no simple documented recipe for web apps.

### Cited Findings
- Dynamsoft: "the blurriness of the barcodes and the accuracy of the barcode results are inversely proportional"; its aggressive deblur modes (`DM_DEEP_ANALYSIS`) are the first to remove for accuracy. — [Dynamsoft: accuracy](https://www.dynamsoft.com/barcode-reader/docs/core/performance/accuracy.html)
- Dynamsoft benchmark (original data about 2021, page updated 13 Nov 2026; vendor-run): misreads on Artelab EAN-13 in-focus (215 images): ZXing-CPP 1, pyZbar 1; out-of-focus (215 images): ZXing-CPP 2, pyZbar 8, Scandit 1; Muenster (1,054): pyZbar 34, ZXing-CPP 1; DEAL Lab (2,000 EAN-13): ZXing-CPP 26, pyZbar 9, Dynamsoft and Scandit 0. The page reports "steep accuracy drops on blurred or out-of-focus images" for open-source engines. Note: the Scandit out-of-focus row is internally inconsistent (1 misread but 100 % precision). — [Dynamsoft 1D accuracy benchmark](https://www.dynamsoft.com/codepool/barcode-scanning-accuracy-benchmark-and-comparison.html)
- ML Kit: "Poor image focus can impact scanning accuracy." — [ML Kit barcode scanning (Android)](https://developers.google.com/ml-kit/vision/barcode-scanning/android)
- The ngx-scanner (ZXing-js) report of "different results when the same barcode is scanned repeatedly" is the typical symptom of frame-to-frame unstable decoding. — [zxing-js/ngx-scanner #601](https://github.com/zxing-js/ngx-scanner/issues/601)
- Quagga2's error-threshold technique (median per-digit match error ≤ 0.10, no single digit > 0.1) is in effect a per-read quality gate that rejects poorly matched (often blurred) reads. — [quaggaJS issue #237](https://github.com/serratus/quaggaJS/issues/237)

### Inferences
- Blur errors differ between frames and between scan lines, while the true value is stable. That is why N-of-M frame voting removes most blur misreads at little cost.
- `focusMode: continuous` means the first frames after the camera opens or moves are often out of focus; the current "first frame wins" rule takes exactly those frames. A short warm-up (ignore results in the first ~300-500 ms) or consensus voting avoids this.
- A cheap blur gate (for example variance of a Laplacian or gradient energy along the ROI's centre row) could skip frames, but this is not needed if voting is in place.

### Gaps
- I found no public data on misreads per blur level for Chrome's `BarcodeDetector` or for ZXing-js.

---

## Q6. GS1 check digit and normalization so Open Food Facts lookups match

### Takeaway
Validate every result with the GS1 mod-10 check (weights 3,1 from the rightmost data digit), expand UPC-E to UPC-A before checking, then normalize to Open Food Facts' form: 8-digit EAN-8 stays 8 digits; 12-digit UPC-A gets a leading 0 (13 digits); a 14-digit GTIN-14 that starts with 0 drops that 0. OFF itself pads 9-12 digit codes to 13 on read and write.

### Cited Findings
- Check digit: "computed modulo 10, where the weights in the checksum calculation alternate between 3 and 1" (rightmost data digit weight 3); "EAN-13 codes beginning with 0 are actually 12-digit UPC codes with a prepended 0 digit". — [Wikipedia: International Article Number](https://en.wikipedia.org/wiki/International_Article_Number)
- GS1 uses one check-digit calculator for GTIN-8, GTIN-12, GTIN-13 and GTIN-14 (also SSCC). — [GS1 US check digit calculator](https://www.gs1us.org/tools/check-digit-calculator)
- Reference implementation in ZXing: `getStandardUPCEANChecksum` / `checkStandardUPCEANChecksum` (`... === check`). — [zxing-js UPCEANReader.ts](https://github.com/zxing-js/library/blob/master/src/core/oned/UPCEANReader.ts)
- UPC-E → UPC-A expansion rules (ZXing): with digits `d1..d6` after the number system `ns`: last digit 0/1/2 → `ns d1 d2 d6 0000 d3 d4 d5`; 3 → `ns d1 d2 d3 00000 d4 d5`; 4 → `ns d1 d2 d3 d4 00000 d5`; 5-9 → `ns d1 d2 d3 d4 d5 0000 d6`; then the check digit. — [zxing-js UPCEReader.convertUPCEtoUPCA](https://github.com/zxing-js/library/blob/master/src/core/oned/UPCEReader.ts) (Java original is equivalent; the TS port has the char-code defect in Q1, so do not call it — write your own).
- zxing-cpp validates UPC-E against the expanded UPC-A (`"0" + ConvertUPCEtoUPCA(...)`) and reports a leading-0 EAN-13 as UPC-A. — [zxing-cpp ODMultiUPCEANReader.cpp](https://github.com/zxing-cpp/zxing-cpp/blob/master/core/src/oned/ODMultiUPCEANReader.cpp)
- Open Food Facts: codes with 7 digits or fewer (after removing leading 0s) are "padded with leading 0s so that they have 8 digits"; 9 to 12 digits are "padded with leading 0s so that they have 13 digits"; the API normalizes the `code` field "for both READ and WRITE requests" (example: request `034000470693` returns product `0034000470693`). — [OFF barcode normalization](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-barcode-normalization/)
- ML Kit / Mobile Vision returns a leading-0 EAN-13 as UPC-A without the 0; there is no way to tell the two apart from the bars. — [googlesamples/mlkit #797](https://github.com/googlesamples/mlkit/issues/797)

### Inferences
- Suggested normalization (per result, before voting and lookup):
  1. Keep only digits; reject other strings.
  2. If format is `upc_e` (or 8 digits from a UPC-E reader): expand to 12-digit UPC-A, validate mod-10 on the UPC-A, then prefix `0` → 13 digits. Do not treat a UPC-E 8-digit value as EAN-8; OFF would look up the wrong 8-digit code.
  3. EAN-8: validate mod-10 on 8 digits; keep 8 digits.
  4. UPC-A (12): validate; prefix `0` → 13.
  5. EAN-13: validate; keep.
  6. 14 digits: validate; if it starts with `0`, drop it → 13; otherwise it is a packaging-level GTIN-14 (unlikely to be in OFF).
- OFF's own padding means a 12-digit request already works, but normalizing in the app keeps local history/recents keys consistent (the app's Dexie data should use the same normalized GTIN).
- The `format` field is required to separate UPC-E from EAN-8 (both 8 digits); both BarcodeDetector (`format`) and html5-qrcode (`result.format`) provide it.

### Gaps
- OFF's normalization page does not say how 14-digit codes or 13-digit codes with leading zeros are handled. The rule in step 6 is the GS1 convention, not an OFF-documented rule.
- The current GS1 General Specifications text (check-digit section and UPC-E rules) was not fetched; the GS1 global check-digit page returned HTTP 403.

---

## Q7. Reports of "scanner reads the wrong EAN number" and how they were fixed

### Takeaway
Wrong-value reports exist for ZXing-js, Quagga and ML Kit; maintainers rarely fix them in the decoder. The fixes that work are in the app: restrict formats, require repeated identical reads or low error, validate the check digit, and handle the EAN-13/UPC-A leading zero.

### Cited Findings
- ZXing-js (ngx-scanner) #601, 6 Jan 2026, open, no response: EAN-13 with first 4-5 digits wrong, different results on repeated scans. — [zxing-js/ngx-scanner #601](https://github.com/zxing-js/ngx-scanner/issues/601)
- quaggaJS #237 (2017-2022): community fixes are error thresholds (avg/median < 0.10), 3 identical results in a row, mode of 20 reads, plus checksum; ericblade: check digits alone are unreliable. Quagga2 README now links this thread as its guidance. — [quaggaJS issue #237](https://github.com/serratus/quaggaJS/issues/237), [Quagga2 README](https://github.com/ericblade/quagga2/blob/master/README.md)
- ML Kit #797 (2024): leading-0 EAN-13 returned as UPC-A; resolution is to accept that they are the same symbol and normalize. — [googlesamples/mlkit #797](https://github.com/googlesamples/mlkit/issues/797)
- Scanbot (Nov 2025): Quagga2 "will occasionally misread EAN barcodes, returning an incorrect code instead of the one scanned"; html5-qrcode unmaintained since April 2023. — [Scanbot: Quagga2 vs html5-qrcode](https://scanbot.io/blog/quagga2-vs-html5-qrcode-scanner/)
- A ZXing Google Group reply (via search summary) says a false positive that passes the checksum is possible but unlikely, and typically happens when a code is not readable and the user keeps scanning for a long time. — [ZXing Google Group: Error reading ean8 and ean13](https://groups.google.com/g/zxing/c/sktNFbxeAn4) (search summary; thread not fetched in full)

### Inferences
- The developer's symptom ("reads the values wrong") fits the current pipeline: first-frame acceptance during autofocus, ITF/Code 128 enabled, no check digit on the app side, and (on iOS) the ZXing-js UPC-E checksum defect.

### Gaps
- I found no html5-qrcode GitHub issue specifically about wrong EAN digits, and no Chromium bug about wrong values from `BarcodeDetector` on Android.

---

## Q8. Ranked mitigations for this app (expected impact, highest first)

### Takeaway
The first three changes are small code changes and remove most misreads: validate GS1 check digits, remove ITF and Code 128, and require 2-3 matching normalized reads. ROI cropping, warm-up after focus, and normalization for OFF come next.

### Cited Findings
1. **Validate the GS1 mod-10 check digit in app code for every result (UPC-E via expansion).** Catches all single-digit errors and 90 % of transpositions — [Wikipedia: EAN](https://en.wikipedia.org/wiki/International_Article_Number); fixes the iOS UPC-E gap — [zxing-js UPCEANReader.ts](https://github.com/zxing-js/library/blob/master/src/core/oned/UPCEANReader.ts); Android backend behaviour is undocumented — [Chromium BarcodeDetectionImpl.java](https://chromium.googlesource.com/chromium/src/+/main/services/shape_detection/android/java/src/org/chromium/shape_detection/BarcodeDetectionImpl.java).
2. **Use only `ean_13`, `ean_8`, `upc_a`, `upc_e`; remove `itf` and `code_128`.** ITF has no mandatory check and accepts 6, 8, 10, 12, 14 or more digits — [zxing-js ITFReader.ts](https://github.com/zxing-js/library/blob/master/src/core/oned/ITFReader.ts), [zxing-cpp ODITFReader.cpp](https://github.com/zxing-cpp/zxing-cpp/blob/master/core/src/oned/ODITFReader.cpp); ITF-14/GS1-128 are not POS symbols — [GS1 fact sheet](https://www.gs1.org/docs/barcodes/GS1%2520Barcodes%2520Fact%2520Sheet%2520-%2520GS1%25201D%2520symbols%2520for%2520general%2520distribution%2520only.pdf); format restriction lowers misreads — [Dynamsoft](https://www.dynamsoft.com/barcode-reader/docs/core/performance/accuracy.html) and raises speed — [ML Kit](https://developers.google.com/ml-kit/vision/barcode-scanning/android).
3. **Multi-frame consensus on the normalized GTIN:** accept when the same valid GTIN appears ≥ 2 times within the last ~5 frames (Dynamsoft default 2-of-5; STRICH `hysteresisMinCount` 2) or 3 in a row (quaggaJS #237). — [Dynamsoft](https://www.dynamsoft.com/barcode-reader/docs/core/performance/accuracy.html), [STRICH](https://docs.strich.io/reference/interfaces/EngineConfiguration.html), [quaggaJS #237](https://github.com/serratus/quaggaJS/issues/237)
4. **ROI crop on Android** (centre, wide and short) and a **wider 1D scan box on iOS**, sized so the EAN-13 is ≥ 190 px wide in the decoded image; 1280x720 is usually enough. — [ML Kit](https://developers.google.com/ml-kit/vision/barcode-scanning/android), [Dynamsoft](https://www.dynamsoft.com/barcode-reader/docs/core/performance/accuracy.html)
5. **Ignore results during autofocus warm-up / blurry frames** (voting covers most of this). — [Dynamsoft benchmark](https://www.dynamsoft.com/codepool/barcode-scanning-accuracy-benchmark-and-comparison.html), [ML Kit](https://developers.google.com/ml-kit/vision/barcode-scanning/android)
6. **Normalize before lookup and storage** (UPC-A → `0`+12, UPC-E → expand → `0`+12, GTIN-14 with leading 0 → 13). — [OFF normalization](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-barcode-normalization/)
7. **Longer term on iOS:** replace html5-qrcode/ZXing-js (unmaintained since 2023, no line agreement, UPC-E defect) with a decoder that has `minLineCount`-style agreement, for example zxing-cpp compiled to WebAssembly. — [Scanbot](https://scanbot.io/blog/quagga2-vs-html5-qrcode-scanner/), [zxing-cpp ReaderOptions.h](https://github.com/zxing-cpp/zxing-cpp/blob/master/core/src/ReaderOptions.h)

### Inferences
- Items 1-3 together mean a wrong value must (a) be a valid GTIN by chance and (b) repeat identically across frames. Random decode errors rarely do both, so the expected residual misread rate is very low.
- Item 1 alone also gives the UI a clean signal: an invalid check digit can be silently ignored (keep scanning) rather than shown as "product not found".
- Keep a debug log of `{format, rawValue, normalized, valid, frameIndex}` to confirm which root cause dominates on the developer's real devices.

### Gaps
- No source measured the combined effect of these changes in a PWA; ranking is based on mechanism and vendor defaults, not on a controlled test.
