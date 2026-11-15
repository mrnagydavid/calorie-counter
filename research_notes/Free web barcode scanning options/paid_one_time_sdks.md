# Paid web barcode SDKs: one-time licences, cheapest tiers and free tiers (as of November 2026)

Scope: JavaScript/WASM barcode SDKs that run in Android Chrome and iOS Safari, for a 1-user, offline-first PWA that scans EAN-13/EAN-8/UPC-A/UPC-E. All pages were fetched on 2026-11-15 unless a different date is given. Some reseller and vendor pages blocked the fetch tool (HTTP 403) or did not resolve (cmbdn.cognex.com). For those pages, the data comes from search-engine snippets of the same URL, and this is noted.

## 1. Pricing model, cheapest fitting licence and one-time/perpetual option, per vendor

### Takeaway
I found no web/JS barcode SDK vendor that sells a public one-time or perpetual licence for in-browser camera scanning. All current web-scanning vendors sell annual or monthly subscriptions. The cheapest entry point is STRICH Basic at €99/month (month-to-month, no lifetime licence). Next are barKoder at €1,250/year, Dynamsoft from US $1,499/year (or about US $1,371/year per 10,000 scans through a reseller), and Scanbot from US $2,500/year. The only "perpetual-style" vendors (LEADTOOLS, VintaSoft, Accusoft) sell developer licences for imaging toolkits. Their web deployment licences are quote-only, and they are not camera-scanning SDKs for mobile browsers.

### Cited Findings

**STRICH (strich.io, by Pixelverse GmbH)**
- Basic: "€99/month", up to 10k scans/month (soft limit), unlimited devices and URLs, all 1D and 2D symbologies, human support — [strich.io](https://strich.io/)
- Professional: "€249/month", up to 100k scans/month (soft limit) — [strich.io](https://strich.io/)
- Business: "Starts at €4,000/year", includes one app; each extra app €1,500/year; unlimited scans and devices; offline licence checking is an optional add-on — [strich.io](https://strich.io/)
- Enterprise: "Starts at €7,500/year", quote only, optional "Offline Operation" add-on — [strich.io](https://strich.io/)
- Scan limits are soft. Scans are never blocked. After two consecutive months over quota, you must upgrade within 7 days — [strich.io](https://strich.io/); [STRICH FAQ](https://strich.io/faq/)
- Prices exclude VAT; Paddle is the Merchant of Record. Only EUR prices are listed — [strich.io](https://strich.io/)
- "We do not offer lifetime licenses at the moment." — [STRICH FAQ](https://strich.io/faq/)
- Annual billing is not available for Basic and Professional ("we are working on it") — [STRICH FAQ](https://strich.io/faq/)
- After cancellation, "Your license keys remain valid until the end of the billing period for which you were billed." — [STRICH FAQ](https://strich.io/faq/)
- No PPP discounts. Startup and NGO/charity discounts are reviewed case by case — [STRICH FAQ](https://strich.io/faq/)
- Older third-party data: G2 lists 3 editions from $99 to $5,000, "last updated on October 10, 2024" (old, and in USD, which does not agree with the current EUR prices) — [G2 STRICH pricing](https://g2.com/products/strich-barcode-scanning-sdk/pricing)
- The old URL strich.io/pricing.html returns HTTP 404 now. Pricing is on the home page — fetch result for [strich.io/pricing.html](https://strich.io/pricing.html)

**Dynamsoft Barcode Reader (JavaScript / Web edition)**
- "Dynamsoft Barcode Reader uses an annual subscription model." Pricing: "usage-based plans starting at US $1,499/year to flat annual fee options" — [Dynamsoft pricing](https://www.dynamsoft.com/barcode-reader/pricing/)
- "If you need a multi-year contract or perpetual licensing, please contact our sales team to discuss options." No public perpetual price — [Dynamsoft pricing](https://www.dynamsoft.com/barcode-reader/pricing/)
- The licence includes 12 months of support and maintenance. 30-day refund — [Dynamsoft pricing](https://www.dynamsoft.com/barcode-reader/pricing/); [Dynamsoft store](https://www.dynamsoft.com/store/dynamsoft-barcode-reader/)
- The quote form asks for annual scan volume in bands starting "Up to 10,000" — [Dynamsoft pricing](https://www.dynamsoft.com/barcode-reader/pricing/)
- Licence models (via Dynamsoft License Server): Per Barcode Scan, Per Client Device, Per Concurrent Device, Per Domain, Per Server, Per Concurrent Instance. Per-scan counting: the same barcode in consecutive frames within a 3-second window counts once. Article dated April 17, 2026. It gives no prices — [Dynamsoft licensing explained](https://www.dynamsoft.com/blog/insights/dynamsoft-licensing-explained/)
- Reseller price (search snippet; the page returned HTTP 403 to the fetch tool): "Dynamsoft Barcode Reader V11.x - JavaScript Web SDK - Per Barcode Scan - 10,000-barcode scan bundle - Annual License", Price Each $1,371.02. "All licenses are per Year. To continue to use the software after 1 Year, you must renew the license." — [ComponentSource SKU 1515660](https://www.componentsource.com/product/barcode-reader/buy/1515660)
- Older reseller price: same 10,000-scan bundle for v10.2.x at $1,273.02 (page updated January 16, 2024; search snippet) — [ComponentSource prices](https://www.componentsource.com/product/barcode-reader/prices)
- A 2019 Dynamsoft licence agreement describes a perpetual licence for desktop runtime. This is old and does not show current web terms — [Dynamsoft licence agreement 08-15-2019](https://www.dynamsoft.com/barcode-reader/license-agreement-08-15-2019)

**Scanbot SDK (Web Barcode Scanner SDK)**
- "Our fixed annual price is competitive and tailored to your use case." "Pricing generally starts at $2,500 for simple use cases." Quotes depend on "the number of apps/domains you need" — [Scanbot pricing](https://scanbot.io/pricing/)
- "We never charge based on usage. Ever." The licence includes "unlimited scanning on unlimited devices" — [Scanbot pricing](https://scanbot.io/pricing/)
- No one-time option is shown. "the Scanbot SDK is a commercial product and is not free for production use." — [Scanbot pricing](https://scanbot.io/pricing/)
- The npm listing describes "unlimited scanning for a flat annual license fee" (search snippet; npm returned HTTP 403 to the fetch tool) — [npm scanbot-web-sdk](https://npmjs.com/package/scanbot-web-sdk)
- Scanbot SDK is now owned by Apryse (site banner: "Scanbot SDK has been acquired by Apryse!") — [scanbot.io](https://scanbot.io/scanbot-sdk-vs-strich-barcode-scanner/)

**Scandit (Web SDK / Data Capture SDK for Web)**
- No public prices. "Our standard billing frequency is yearly." Fixed or flexible (per device / per scan) pricing. The subscription "starts with a small upfront commitment" (no amount given) — [Scandit pricing](https://www.scandit.com/pricing/)
- One-time payment is not a standard option (no mention on the pricing page) — [Scandit pricing](https://www.scandit.com/pricing/)

**barKoder (Web/WASM SDK)**
- Enterprise Basic €1,250/year for 50 devices; Enterprise Standard €1,990/year for 100 devices; Enterprise Advanced €2,990/year for 250 devices. Each plan covers "1 App (Mobile or Web)", unlimited scans. No one-time or perpetual option is listed — [barKoder pricing](https://barkoder.com/pricing)
- A search summary of the same page gave €1,999 and €2,999 for the Standard and Advanced plans. The direct fetch shows €1,990 and €2,990. The entry plan (€1,250) is the same in both — [barKoder pricing](https://barkoder.com/pricing)
- For the Web SDK, a "device" is a unique browser client that decodes at least one barcode. Chrome and Firefox on one machine count as two; Chrome and Edge count as one — [barKoder pricing](https://barkoder.com/pricing)
- Older third-party figure: $999/year for 50 devices (conflicts with the current official price) — [GoodFirms barKoder](https://www.goodfirms.co/software/barkoder)

**Cognex Mobile Barcode SDK for Web (cmbWEB, ex-Manatee Works)**
- Discontinued. Official end date September 30, 2025. All subscriptions ended on 9/30/25. No more updates or support (search snippets; cmbdn.cognex.com did not resolve for the fetch tool) — [Cognex Developer Network](https://cmbdn.cognex.com); [cmbWEB page](https://cmbdn.cognex.com/cmbWEB)
- Users who want to continue after 9/30/25 can contact sdksales@cognex.com "to discuss a no-cost license" (for existing users) — [Cognex registration page](https://cmbdn.cognex.com/register)
- Web licences have an explicit expiry date encoded in them, and scanning stops at that date — [Cognex Developer Network](https://cmbdn.cognex.com)
- Competitor statement: Cognex no longer offers new subscription licences — [Scanbot vs Cognex (vendor page)](https://scanbot.io/scanbot-sdk-vs-cognex-mobile-barcode-sdk/)

**Anyline (Web SDK)**
- No public price. "Anyline has not provided pricing information" — [G2 Anyline pricing](https://www.g2.com/products/anyline/pricing)
- Commercial licence needed; trial licence on request; Web SDK licences are domain-bound — [Anyline Web SDK Getting Started](https://documentation.anyline.com/web-sdk-component/latest/getting_started.html)

**Accusoft Barcode Xpress**
- Reseller list prices for Node.js editions only: Standard development toolkit $1,960.00; Professional runtime $112.70 per installation, minimum 20 installations; several tiers "Call for Price" (search snippets) — [ComponentSource Barcode Xpress Node.js prices](https://www.componentsource.com/product/barcode-xpress-node-js/prices)
- Pricing depends on reading speed and number of runtimes. Pay-per-transaction licensing exists for version 13.1 and later — [ComponentSource Barcode Xpress Node.js](https://www.componentsource.com/product/barcode-xpress-node-js)
- I found no price for a browser/JavaScript client edition.

**LEADTOOLS Barcode (HTML5/JavaScript)**
- Developer licence: "LEADTOOLS Barcode v23 - 1 Developer License" $2,203.53; annual maintenance for 1 developer $556.88 (reseller list price; search snippet) — [ComponentSource LEADTOOLS Barcode](https://www.componentsource.com/product/leadtools-barcode/buy/1562567)
- A separate deployment licence is required. Its price "varies based on the deployment model" (quote only) — [ComponentSource LEADTOOLS Barcode prices](https://www.componentsource.com/product/leadtools-barcode/prices)
- HTML5/JavaScript libraries "must be deployed to a web server ... therefore a server license is required for deployment". Their licence files are tied to specific domains — [LEADTOOLS deployment licences](https://www.leadtools.com/help/sdk/licensing/about-leadtools-deployment-licenses.html)

**VintaSoft Barcode .NET SDK**
- Licence types on the upgrade page: Developer licence for Desktop PCs, Developer licence for Servers, Site licence for Desktop PCs, Site licence for Servers, Single Server licence. Example: upgrade 1D→1D+2D Reader for Desktop developer licence 150 €. The page shows only upgrade prices, not new-licence prices — [VintaSoft Editions & Upgrades](https://www.vintasoft.com/register-upgrade.html)
- "only the existing license with active subscription can be a subject for upgrade" — [VintaSoft Editions & Upgrades](https://www.vintasoft.com/register-upgrade.html)
- The EULA says the software "is not for sale, it can only be licensed", and the licensed software includes "JavaScript files" — [VintaSoft EULA](https://www.vintasoft.com/vsbarcode-dotnet-license.html)
- 30-day free trial — [VintaSoft Barcode .NET SDK](https://vintasoft.com/vsbarcode-dotnet-index.html)

**Aspose**
- Aspose products are sold as "perpetual license" with a one-year update subscription (example: Aspose.OCR for JavaScript via C++). Aspose.BarCode is server/desktop-oriented. I found no Aspose in-browser camera barcode scanner — [ComponentSource Aspose.OCR for JavaScript factsheet](https://www.componentsource.com/product/aspose-ocr-for-javascript-via-cpp/factsheet)

**Vision Smarts VSBarcodeReader (for completeness; not web)**
- "6,000 € / year" for one app on iOS and Android. Twelve-month term only. No web/JS/WASM edition is listed — [Vision Smarts pricing FAQ](https://www.visionsmarts.com/sdk/pricing-faq.html)

**"Pixelnest"**
- A search for "Pixelnest barcode scanner SDK" found no such product. The closest name is Pixelverse GmbH, the company behind STRICH (npm scope `@pixelverse/strichjs-sdk`) — [STRICH README on jsDelivr](https://cdn.jsdelivr.net/npm/@pixelverse/strichjs-sdk@1.17.2/README.md); [STRICH comparison page](https://strich.io/comparison-with-oss.html)

### Inferences
- For 1 user with tens of scans per day (roughly 300–1,500 scans/month), the cheapest paid fit is STRICH Basic at €99/month (excl. VAT). It is month-to-month, so the developer can pay for one month to test on real products, then cancel. A full year costs about €1,188 (12 × €99). This is a recurring fee, not a one-time fee.
- Every other web-scanning vendor has an entry price of about €1,250–US $2,500 per year, or is quote-only (Scandit, Anyline). These prices target businesses, not single developers.
- A "one-time" path exists only by negotiation: Dynamsoft says to contact sales for perpetual licensing. No public perpetual price exists, and the US $1,499/year floor suggests that a perpetual quote will be several times that figure (inference, not a quoted price).
- LEADTOOLS, VintaSoft and Accusoft use the classic "developer licence + deployment licence" model. In a web context, this costs more than US $2,000 before deployment fees, and these products focus on reading barcodes from images/documents, not live mobile camera scanning.
- Cognex cmbWEB is not available for new buyers.

### Gaps
- No vendor publishes a hobby, indie or personal-use paid tier for web scanning. I could not find one anywhere.
- Dynamsoft's own site gives no per-SKU web prices. The $1,371.02 figure is from a reseller snippet, and the fetch tool could not open the page (HTTP 403) to confirm it.
- No published price for Scandit, Anyline or Accusoft browser editions. LEADTOOLS deployment price is quote-only.
- I could not confirm if LEADTOOLS or VintaSoft developer licences are perpetual (their sources describe licence types, not the term). VintaSoft new-licence prices were not on the fetched page.
- I did not find Reddit/HN threads with real user prices for these SDKs.

## 2. Free plans, non-commercial licences, permanent trials and free usage tiers

### Takeaway
No vendor offers a free production licence for a personal, non-commercial app. The only free options are time-limited trials (7 to 30 days), Scanbot's "1 minute per session" unlicensed mode (licence terms limit trials to development/staging), and Scandit's free Community Edition for Education (needs an institutional email, non-commercial only).

### Cited Findings
- STRICH: the trial is free but needs a credit card; it does not convert to paid if cancelled before the end — [STRICH FAQ](https://strich.io/faq/)
- STRICH trial length conflict: the home page says "Free 14-day trial" — [strich.io](https://strich.io/); the Getting Started docs mention "the free 30-day trial" (search snippet) — [STRICH Getting Started](https://docs.strich.io/getting-started.html)
- STRICH: no free, indie or non-commercial plan is mentioned; only startup and NGO discounts — [STRICH FAQ](https://strich.io/faq/)
- Dynamsoft: "free 30-day trial", no credit card needed. An expired trial stops the SDK until a paid key is set — [Dynamsoft pricing](https://www.dynamsoft.com/barcode-reader/pricing/); [Dynamsoft licensing explained](https://www.dynamsoft.com/blog/insights/dynamsoft-licensing-explained/)
- Dynamsoft: advanced camera features (auto-zoom, enhanced focus, tap-to-focus) need a (trial) licence — [Dynamsoft camera-enhancer samples](https://github.com/Dynamsoft/camera-enhancer-javascript-samples)
- Scanbot: "The Scanbot SDK will run without a license for one minute per session." Free 7-day trial licence; "a trial license may only be used in a development and staging environment." — [Scanbot Web licence handling](https://docs.scanbot.io/web/barcode-scanner-sdk/detailed-setup-guide/license-handling/)
- Scanbot: "request a free 7-day trial license"; extended trials via sales; "not free for production use" — [Scanbot pricing](https://scanbot.io/pricing/)
- Scandit: "Community Edition for Education" — needs affiliation with an educational institution, "non-commercial use only", gmail accounts not accepted; unlimited scans and devices; community support only — [Scandit Community Edition](https://www.scandit.com/community-edition/)
- Scandit: 30-day free trial for all features — [Scandit trial](https://www.scandit.com/trial)
- Scandit: trial licence keys are wildcard (any domain) — [Scandit support: localhost or private IP](https://support.scandit.com/hc/en-us/articles/4406562708242-How-can-I-create-a-key-for-localhost-or-private-IP)
- barKoder: 30-day trial, 25 devices, unlimited scans, no credit card; one trial key per app ID; extension needs a Developer Portal account. No free plan — [barKoder pricing](https://barkoder.com/pricing)
- Cognex: existing cmbWEB users can ask for a no-cost licence after 9/30/25 (not for new users, and the product is end-of-life) — [Cognex registration page](https://cmbdn.cognex.com/register)
- VintaSoft: 30-day trial — [VintaSoft Barcode .NET SDK](https://vintasoft.com/vsbarcode-dotnet-index.html)

### Inferences
- Scanbot's unlicensed 1-minute-per-session mode is technically enough for one scan per app session. But Scanbot says the SDK "is not free for production use", and trial use is for development and staging only. A personal app on a public host is most likely "production" under these terms. Treat this as a test tool, not a free tier.
- A short paid STRICH month or a free 30-day Dynamsoft/barKoder trial is the cheapest way to test commercial scan quality on the developer's own iPhone and groceries before any purchase.

### Gaps
- I found no vendor with a "free under N scans" production tier, an open-source licence, or a non-expiring trial key for web scanning.

## 3. Offline operation, licence checks (phone-home) and domain locking

### Takeaway
All vendors decode on the device, but most need a network licence check. STRICH contacts its licence server and sends usage data; fully offline use is a paid add-on for Business/Enterprise only (≥ €4,000/year). Dynamsoft per-scan licences allow at most 3 days offline after registration; per-device licences allow 24 h to 365 days. barKoder needs a check-in at least every 30 days. Scandit needs network for activation. Domain/origin binding is standard; Scandit explicitly allows localhost and private IPs.

### Cited Findings
- STRICH: the SDK contacts STRICH servers for licence verification and usage tracking. It sends the key, OS, browser, origin URL ("for scope verification") and SDK version. Usage tracking sends scan counts and barcode types; "The values encoded in the barcodes are not sent." — [STRICH FAQ](https://strich.io/faq/)
- STRICH: offline operation "is available as an optional add-on for STRICH Business and STRICH Enterprise licenses." — [STRICH FAQ](https://strich.io/faq/); [strich.io](https://strich.io/)
- STRICH: keys are restricted to one or more application URLs (the licence scope). Error "location ... not in scope of license" if the app URL is not in the key. Licence check fails if https://license.strich.io cannot be reached (search snippets) — [STRICH Getting Started](https://docs.strich.io/getting-started.html); [STRICH KB: initialization errors](https://kb.strich.io/article/9-sdk-initialization-errors)
- STRICH: the camera needs a secure context — app served from HTTPS, file:/// or localhost (search snippet) — [STRICH Deployment Guide](https://docs.strich.io/deployment-guide.html)
- STRICH: on iOS 13+, Safari can ask for camera permission again and again; "Installed PWAs have no workaround" — [STRICH FAQ](https://strich.io/faq/)
- Dynamsoft: per-scan licence — "the client device can work in an offline scenario after it is registered, but no more than 3 days". "The initial registration of the device requires an internet connection". Per-client-device licence — offline interval of 365 days, 90 days, 30 days or 24 hours — [Dynamsoft FAQ: JS SDK offline mode](https://www.dynamsoft.com/faq/barcode-reader/web/configuration/javascript-sdk-offline-mode-use.html)
- Dynamsoft: the per-device local licence "can work online or offline as long as it is active". It renews when the device reconnects. If offline past the active period, it stops working — [Dynamsoft licensing explained](https://www.dynamsoft.com/blog/insights/dynamsoft-licensing-explained/)
- Dynamsoft: "If you require a fully offline license, just chat with our sales team about dedicated offline licensing options." — [Dynamsoft pricing](https://www.dynamsoft.com/barcode-reader/pricing/)
- Dynamsoft: PWA sample caches the SDK files in a service worker for offline use — [Dynamsoft PWA sample v9.6.42](https://github.com/Dynamsoft/barcode-reader-javascript-samples/blob/v9.6.42/1.hello-world/10.read-video-pwa); [Dynamsoft PWA blog](https://www.dynamsoft.com/codepool/build-simple-pwa-barcode-reader.html)
- Scanbot: "processes all data directly on the device, entirely offline" — [Scanbot pricing](https://scanbot.io/pricing/); the Web SDK "operates entirely offline on the user's device" — [Scanbot Web SDK intro](https://docs.scanbot.io/web/barcode-scanner-sdk/introduction/)
- Scanbot: "Each license key is valid only for a given app bundle identifier." Expired licence: "any call to the Scanbot SDK API will terminate your app or result in an error." The page does not say if validation needs network — [Scanbot Web licence handling](https://docs.scanbot.io/web/barcode-scanner-sdk/detailed-setup-guide/license-handling/)
- Scandit: "All webSDK license keys work on localhost independently of the particular domain name"; private IP ranges are also covered; paid keys are restricted to the domain — [Scandit support: localhost or private IP](https://support.scandit.com/hc/en-us/articles/4406562708242-How-can-I-create-a-key-for-localhost-or-private-IP); [Scandit support: localhost](https://support.scandit.com/hc/en-us/articles/115003108592-Can-I-use-the-SDK-for-the-Web-on-localhost)
- Scandit: the SDK "needs to connect to our endpoints for license activation" (search snippet) — [Scandit support: firewall](https://support.scandit.com/hc/en-us/articles/20342720404764-What-if-Scandit-Web-SDK-can-t-connect-due-to-firewall-setup); the Web SDK can be configured to work offline as a PWA (search snippet) — [Scandit Web add SDK](https://docs.scandit.com/data-capture-sdk/web/add-sdk.html)
- barKoder: devices must check in with the licensing server about every 15 days and at least once in 30 days, or results are marked "(Unlicensed)". Devices that never go online need custom licensing — [barKoder pricing](https://barkoder.com/pricing)
- Anyline: Web SDK licences are bound to a specific domain; the scanner works fully offline — [Anyline Web SDK Getting Started](https://documentation.anyline.com/web-sdk-component/latest/getting_started.html)
- LEADTOOLS: HTML5/JavaScript licence files are tied to specific domains — [LEADTOOLS deployment licences](https://www.leadtools.com/help/sdk/licensing/about-leadtools-deployment-licenses.html)
- Cognex cmbWEB: web licences have an encoded expiry date — [Cognex Developer Network](https://cmbdn.cognex.com)

### Inferences
- For an offline-first PWA used mostly at home or in a shop with mobile data, STRICH Basic, Dynamsoft per-scan and barKoder will usually work, because the phone is online often. But a scan in a shop with no signal can fail with STRICH Basic/Professional, because the licence check needs https://license.strich.io (the fully offline add-on is Business/Enterprise only).
- Static hosting is fine for all vendors with origin/domain-bound keys. The developer must add the production domain (and maybe localhost or a LAN IP for testing) to the key. Scandit is the only vendor with a documented rule that localhost and private IPs always work.

### Gaps
- STRICH docs do not say clearly if localhost or LAN IPs are in scope for a key without explicit listing, or how long a passed licence check stays valid offline.
- Scanbot docs do not say if web licence validation needs network, or how a web "bundle identifier" maps to a domain.
- No source said how often Scandit's web licence must re-activate.

## 4. Licence key exposure in client-side JavaScript

### Takeaway
No vendor page I read discusses key secrecy directly. Instead, vendors limit misuse by binding keys to origins/domains (STRICH, Scandit, Anyline, LEADTOOLS, Scanbot "bundle identifier") and by metering use on their licence servers (STRICH, Dynamsoft, barKoder).

### Cited Findings
- STRICH sends the origin URL "for scope verification", and keys are restricted to application URLs — [STRICH FAQ](https://strich.io/faq/); [STRICH Getting Started](https://docs.strich.io/getting-started.html)
- STRICH's FAQ does not cover key exposure in client-side code — [STRICH FAQ](https://strich.io/faq/)
- Scandit paid keys are restricted to the domain; trial keys are wildcard — [Scandit support: localhost or private IP](https://support.scandit.com/hc/en-us/articles/4406562708242-How-can-I-create-a-key-for-localhost-or-private-IP)
- Dynamsoft counts usage on its licence server (per scan, per device, per domain) — [Dynamsoft licensing explained](https://www.dynamsoft.com/blog/insights/dynamsoft-licensing-explained/)
- barKoder counts unique browser clients for web — [barKoder pricing](https://barkoder.com/pricing)
- Scanbot's licence page does not cover key exposure — [Scanbot Web licence handling](https://docs.scanbot.io/web/barcode-scanner-sdk/detailed-setup-guide/license-handling/)

### Inferences
- With an origin-bound key, a copied key does not work on another site, so a public key in the JS bundle is the expected design. For metered licences (STRICH soft quotas, Dynamsoft per-scan), the risk is someone using the key from the same origin, which is low for a single-user app.

### Gaps
- No vendor statement found that explicitly addresses key exposure; Scandit's article on how Web SDK licensing works returned HTTP 403.

## 5. Scan quality evidence (1D accuracy, misreads, iPhone focus and camera selection)

### Takeaway
All benchmarks I found are vendor-produced and none tests live-camera EAN/UPC scanning on an iPhone. Dynamsoft's April 2026 static-image test favours Dynamsoft; STRICH's 2023 test (Android only, no EAN) favours STRICH; barKoder's blurred-EAN test favours barKoder and gives Dynamsoft 0%. The iPhone close-focus problem (iPhone 14 Pro and later) is a platform issue: Apple's fix (zoom from `minimumFocusDistance`) is native-only, and web SDKs work around it by choosing the ultra-wide camera (Scanbot documents this; Scandit has a Wide/UltraWide toggle).

### Cited Findings
**Benchmarks (all vendor-produced)**
- Dynamsoft (vendor), Apr 7, 2026: 83 static images from Dynamsoft's test sheet, default settings, browser JS SDKs, not live camera. Totals (barcodes / unique / avg ms per image): Dynamsoft 428 / 292 / 278; STRICH 58 / 55 / 646; Scanbot 242 / 182 / 790; Scandit 178 / 139 / 11,210. No per-SDK retail breakdown; no misread counts. EAN-13 in strong light: Dynamsoft, STRICH and Scandit read it, Scanbot failed. The authors say STRICH returns one barcode per call, so totals are "somewhat misleading", and "No SDK decoded every image correctly." Benchmark code not released — [Dynamsoft 4-SDK benchmark](https://dynamsoft.com/blog/insights/benchmark-four-sdk-barcode-scanner-real-world-performance/)
- Dynamsoft (vendor) also publishes 1D accuracy tests vs ZXing/ZBar/Scandit on 3 public datasets (3,484 EAN-13 images) and a zxing-wasm vs Dynamsoft JS test on 7,894 images (I did not fetch the numbers) — [Dynamsoft 1D benchmark](https://dynamsoft.com/codepool/barcode-scanning-accuracy-benchmark-and-comparison.html); [Dynamsoft vs zxing-wasm](https://www.dynamsoft.com/codepool/benchmark-barcode-reading-javascript-zxing-wasm-dynamsoft-barcode-reader.html)
- STRICH (vendor), published May 3, 2023: STRICH vs ZXing-JS vs Quagga2 on a Samsung Galaxy S21 FE (Android), live camera, 4 "missions" with Code 128, Code 39, Aztec and Data Matrix (no EAN/UPC). STRICH 0 misreads in all missions; Quagga had 1 misread. ZXing-JS: "We did not find a way to set the camera resolution." STRICH: "Avoiding misreads is a priority for STRICH." The authors say they are "obviously biased" — [STRICH comparison with OSS](https://strich.io/comparison-with-oss.html)
- barKoder (vendor): on 55 blurred EAN/UPC samples, barKoder 97.06%, Scandit 80%, Dynamsoft 0% (search snippet; conflicts with Dynamsoft's own results) — [barKoder test blog](https://barkoder.com/blog/we-have-tested-barkoder-scandit-dynamsoft-scanbot-and-cognex-barcode-scanners)
- STRICH claims it reads faded, glared, curved and inverted codes, is tested on current iPhones/iPads, has tap-to-focus and handles camera quirks automatically (vendor claims, no data) — [strich.io](https://strich.io/)
- Scanbot claims accurate scans with damaged or distant barcodes and low light, and offers result filtering by type/content with regex (vendor claim) — [Scanbot Web SDK intro](https://docs.scanbot.io/web/barcode-scanner-sdk/introduction/)
- Dynamsoft per-scan licensing treats the same barcode in consecutive frames within 3 seconds as one scan (built-in duplicate filtering for counting) — [Dynamsoft licensing explained](https://www.dynamsoft.com/blog/insights/dynamsoft-licensing-explained/)

**iPhone focus and camera selection**
- Apple Frameworks Engineer (Oct 2022): use the capture device's `minimumFocusDistance` to derive a `videoZoomFactor`. This is AVFoundation (native) only. Users reported the problem on iPhone 14 Pro, 14 Pro Max and 15 Pro, for native apps, web SDKs and `getUserMedia`; no fix confirmed in the thread — [Apple Developer Forums 715568](https://developer.apple.com/forums/thread/715568)
- A user in the same thread reported that since iOS 16.4, `getUserMedia` can choose among several cameras (user claim, not Apple) — [Apple Developer Forums 715568](https://developer.apple.com/forums/thread/715568)
- Apple WWDC21 session on minimum focus distance and the AVCamBarcode sample — [WWDC21 10047](https://developer.apple.com/videos/play/wwdc2021/10047/)
- Scanbot FAQ: focus problems on iPhone 14, 14 Pro Max, 15 and 15 Plus come from a larger minimum focus distance; fix: "Default to the wide-angle camera using: `IBarcodeScannerHandle.switchCamera("Back Ultra Wide Camera");`" — [Scanbot common web integration issues](https://docs.scanbot.io/faq/common_web_integration_issues/)
- WebKit bug report: on recent iPhones the default stream from `{facingMode: 'environment'}` is an ultra-wide one (search snippet, not fetched) — [WebKit bug 253186](https://bugs.webkit.org/show_bug.cgi?id=253186)
- Scandit's Web SDK offers a GUI toggle between Wide and UltraWide cameras on supported iPhones (search snippet of the changelog) — [Scandit Web changelog](https://docs.scandit.com/stable/web/CHANGELOG.md)
- Dynamsoft Camera Enhancer has auto-zoom and tap-to-focus flags — [Dynamsoft Camera Enhancer enhanced features](https://www.dynamsoft.com/camera-enhancer/docs/core/enums/enhanced-features.html). A Dynamsoft blog says "iOS Safari does not expose focus constraints" (search snippet) — [Dynamsoft camera focus on web](https://www.dynamsoft.com/codepool/camera-focus-control-on-web.html)
- Scanbot: torch control works in all iOS browsers from iOS 17.4; exposure control features "are unstable" across devices — [Scanbot common web integration issues](https://docs.scanbot.io/faq/common_web_integration_issues/)
- STRICH: Safari on iOS before 18 can fail with an "Out of Memory" WebAssembly error — [STRICH FAQ](https://strich.io/faq/)

### Inferences
- For EAN/UPC on an iPhone Pro, the biggest quality factor in a browser is probably camera choice and distance, not the decoder. All commercial web SDKs use the same `getUserMedia` API as the free libraries, and Safari does not expose focus control. A paid SDK can help with better defaults (resolution, lens choice, tap-to-focus emulation, multi-frame checks), but it cannot do Apple's native zoom-to-min-focus fix.
- STRICH's single-barcode design and "no misreads" focus match a one-product-at-a-time food log better than multi-barcode batch scanning, which drives most of Dynamsoft's benchmark lead.
- The developer should test on his own device and groceries during a trial; no independent benchmark answers this.

### Gaps
- No independent (non-vendor) benchmark of web barcode SDKs on live iPhone camera EAN/UPC scanning was found.
- No vendor published misread (wrong value) rates for EAN-13/UPC in camera mode.
- I did not confirm the exact Scanbot Web SDK camera-switch API name (the FAQ sample uses `IBarcodeScannerHandle`).
- I found no Reddit/HN user reports comparing these SDKs on iPhone.

## 6. Bundle/WASM size and integration effort for a non-React (Preact) app

### Takeaway
STRICH is the lightest documented option (under 1 MB, one JS file with embedded WASM, zero dependencies, vanilla JS samples). Scanbot and Dynamsoft are WASM-based with plain-JS samples, but their sizes are not stated; Scanbot calls its binaries "heavy". All work outside React.

### Cited Findings
- STRICH: under 1 MB, single JS file with embedded WASM, zero dependencies, samples for vanilla JS, React, Angular, Vue and Svelte; install from npm or CDN — [strich.io](https://strich.io/); "STRICH relies only on baseline browser technologies, and has zero dependencies." — [STRICH FAQ](https://strich.io/faq/)
- Scanbot: "WebAssembly binaries are heavy, but all modern browsers cache them"; Brotli cuts download size by about 60%; after first load, about one second from cache — [Scanbot common web integration issues](https://docs.scanbot.io/faq/common_web_integration_issues/)
- Scanbot: example apps for Angular, React and plain JavaScript; iOS 14.5+ for Safari/Chrome/Firefox/Edge; older browsers not supported — [Scanbot Web SDK intro](https://docs.scanbot.io/web/barcode-scanner-sdk/introduction/)
- Dynamsoft: the licence must be set before `createInstance()` or `loadWasm()`; online or offline licence can be given — [Dynamsoft LicenseControl API](https://www.dynamsoft.com/barcode-reader/docs/web/programming/javascript/api-reference/LicenseControl.html)
- Dynamsoft: PWA sample caches the SDK engine files in a service worker — [Dynamsoft PWA sample v9.6.42](https://github.com/Dynamsoft/barcode-reader-javascript-samples/blob/v9.6.42/1.hello-world/10.read-video-pwa)
- Scandit: Web SDK can be set up for offline PWA use with a service worker; the docs note a known iOS issue with video streams in PWAs (search snippet) — [Scandit Web add SDK](https://docs.scandit.com/data-capture-sdk/web/add-sdk.html)
- barKoder publishes a WASM package on npm — [npm barkoder-wasm](https://npmjs.com/package/barkoder-wasm)

### Inferences
- For a Vite + Preact PWA, STRICH is the simplest drop-in: one file to add to the Workbox precache. With Dynamsoft or Scanbot, the developer must make sure Workbox precaches the separate WASM/engine files for offline use.

### Gaps
- No byte sizes found for Dynamsoft, Scanbot, Scandit or barKoder web bundles (npm pages returned HTTP 403).
