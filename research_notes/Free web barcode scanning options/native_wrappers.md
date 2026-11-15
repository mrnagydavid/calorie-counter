# Beyond the browser: native barcode scanners for the calorie counter PWA (state: November 2026)

Scope: free routes that let the existing Vite + Preact PWA use the phone's native scanner (Google ML Kit / Google Code Scanner on Android, Apple Vision / VisionKit on iOS), the effort and distribution cost of each route, and the evidence on scan quality. Research date: 2026-11-15. Sources with older dates are flagged.

## 1. Capacitor barcode plugins: engines, ready-made UI, licences, maintenance

### Takeaway
Two free, maintained Capacitor plugins exist. `@capacitor-mlkit/barcode-scanning` (Capawesome, Apache-2.0) uses ML Kit on both platforms and its `scan()` call opens the Google Code Scanner full-screen UI on Android (no camera permission). `@capacitor/barcode-scanner` (Ionic/OutSystems, MIT) uses Apple Vision/VisionKit on iOS and lets you select ZXing or ML Kit on Android. For an iOS scanner that uses the Apple engine, the Ionic plugin is the free choice; Capawesome's Apple-Vision variant is a paid "Insiders" plugin.

### Cited Findings
**`@capacitor-mlkit/barcode-scanning` (Capawesome)**
- Android engine is Google ML Kit (default dependency `com.google.mlkit:barcode-scanning` 17.3.0, which is the bundled model). The `scan(...)` UI also uses `play-services-code-scanner` 16.1.0. — [Capawesome README](https://github.com/capawesome-team/capacitor-mlkit/tree/main/packages/barcode-scanning)
- iOS engine is also ML Kit (not Apple Vision). The README says a separate Capawesome Insiders "Barcode Scanner" plugin "replaces ML Kit with AVFoundation and Vision on iOS". — [Capawesome README](https://github.com/capawesome-team/capacitor-mlkit/tree/main/packages/barcode-scanning)
- The Insiders plugin adds Swift Package Manager support, a themeable full-screen UI and an embedded camera view; it is a paid sponsorship product (price not given on the page). — [Capawesome README](https://github.com/capawesome-team/capacitor-mlkit/tree/main/packages/barcode-scanning)
- `scan(...)` opens a built-in scanner screen with no WebView changes, on Android and iOS only. On Android it needs the Google Barcode Scanner module from Google Play Services, but no camera permission. The plugin has methods to check for and install the module. — [Capawesome README](https://github.com/capawesome-team/capacitor-mlkit/tree/main/packages/barcode-scanning)
- `startScan(...)` puts the camera behind a transparent WebView; the app must hide all visible DOM elements. — [Capawesome README](https://github.com/capawesome-team/capacitor-mlkit/tree/main/packages/barcode-scanning)
- Formats include EAN-13 and UPC-A (13 formats in the `BarcodeFormat` enum). — [Capawesome README](https://github.com/capawesome-team/capacitor-mlkit/tree/main/packages/barcode-scanning)
- Only Capacitor 8.x is actively supported; plugin versions 5.x–7.x are deprecated. iOS deployment target must be 15.5 or higher. iOS needs CocoaPods; Swift Package Manager is not supported for the ML Kit SDK. — [Capawesome README](https://github.com/capawesome-team/capacitor-mlkit/tree/main/packages/barcode-scanning)
- Known limitation on Android: the OS can destroy the app while the scanner is open. Then the `scan()` promise never resolves and the result comes through the App plugin's `appRestoredResult` event; if the process was killed, the result is lost. — [Capawesome README](https://github.com/capawesome-team/capacitor-mlkit/tree/main/packages/barcode-scanning)
- Web fallback: the plugin uses the Barcode Detection API, with an optional `barcode-detector` polyfill based on ZXing-C++ WASM. — [Capawesome README](https://github.com/capawesome-team/capacitor-mlkit/tree/main/packages/barcode-scanning)
- Licence Apache 2.0; maintained by Capawesome; priority support needs a paid subscription; documentation is more detailed than the Ionic plugin's. Reported problems: PDF417 driver licences, tiny barcodes, multiple/partial results when codes are close together. — [Scanbot blog, 23 Jan 2026 (vendor of a competing SDK)](https://scanbot.io/blog/capacitor-barcode-scanner-vs-capacitor-mlkit/)

**`@capacitor/barcode-scanner` (official Ionic plugin)**
- Described as a "Capacitor plugin using Outsystems Barcode libs". Android: select `android.scanningLibrary` = `"zxing"` or `"mlkit"`. iOS: Apple Vision. Platforms: Android (min SDK 26), iOS, web. Options include `hint` (format), `scanInstructions`, `scanButton`, `scanText`, `cameraDirection`, `scanOrientation`. — [Capacitor docs](https://capacitorjs.com/docs/apis/barcode-scanner)
- Licence MIT; 31 open issues at time of fetch; the README does not name the default Android engine. — [GitHub ionic-team/capacitor-barcode-scanner](https://github.com/ionic-team/capacitor-barcode-scanner)
- Scanbot says the iOS engine is "Apple VisionKit", the plugin shows a default scanning UI with limited customisation (instruction text, one button), and web uses html5-qrcode. On iOS, UPC-A is returned as EAN-13 and UPC/EAN extensions are not supported. Reported problems: scanner may not resolve when closed with the close button (camera keeps streaming), Android device-specific QR failures (Samsung Galaxy A53), iOS autofocus problems (iPhone 15), UI breakage when rotating mid-scan. Documentation is "sparse, with discrepancies from the implementation". — [Scanbot blog, 23 Jan 2026](https://scanbot.io/blog/capacitor-barcode-scanner-vs-capacitor-mlkit/)
- Capacitor docs default to v8; a v9 ("next") docs set also exists. — [Capacitor docs, getting started](https://capacitorjs.com/docs/getting-started)

### Inferences
- For this app (single EAN-13/UPC-A, one code at a time), both plugins have the needed formats. The quickest high-quality setup is probably: Android → Capawesome `scan()` (Google Code Scanner UI, no permission prompt); iOS → Ionic plugin (Apple Vision) or Capawesome `scan()` (ML Kit). One codebase can use one plugin on each platform, but two plugins add maintenance; test both on the real phone first.
- The Ionic plugin's "UPC-A returned as EAN-13" behaviour on iOS is not a problem for Open Food Facts lookup if the app already normalises 12-digit UPC-A to 13 digits with a leading zero (check the existing lookup code).
- The Android `appRestoredResult` limitation matters on low-memory phones: the app must listen for that event, or a scan can get lost.

### Gaps
- I did not research the community package `capacitor-barcode-scanner` or the archived `@capacitor-community/barcode-scanner`. No data on their engines or maintenance.
- Price of Capawesome Insiders not found.
- Whether Capawesome `scan()` exposes Google Code Scanner auto-zoom (`enableAutoZoom`) not confirmed.
- No exact latest version numbers or release dates found for either plugin (GitHub release sections were empty in the fetch).

## 2. Wrapping the existing Vite + Preact PWA with Capacitor, and distribution to one user

### Takeaway
Adding Capacitor to the existing Vite build is a small, mechanical change (install, `cap init` with `webDir: dist`, add platforms, `cap sync`), and the same code stays the web PWA. Watch for three things: the service worker does not work in the iOS Capacitor WebView (and is not needed there), IndexedDB in the WebView is a new, separate store that iOS can evict, and iOS distribution is the real cost. Android sideloading is free. iOS is free only with 7-day re-signing (Xcode, or SideStore with automatic refresh); a 1-year install needs the Apple Developer Program at $99/year.

### Cited Findings
**Wrapping effort**
- Steps for an existing web app: have `package.json`, a build output folder with `index.html` (e.g. `dist`); install `@capacitor/core` and `@capacitor/cli` (dev); `npx cap init` (records `webDir`); install the Android/iOS platform packages; `npx cap add android` and `npx cap add ios`; `npx cap sync` to copy the built web app into the native projects. `index.html` must have a `<head>` tag or "Capacitor plugins will not work". — [Capacitor docs, getting started](https://capacitorjs.com/docs/getting-started)
- The Capawesome ML Kit plugin requires CocoaPods on iOS and iOS 15.5+. — [Capawesome README](https://github.com/capawesome-team/capacitor-mlkit/tree/main/packages/barcode-scanning)

**IndexedDB persistence**
- Capacitor docs: localStorage "must be considered transient" because "the OS will reclaim local storage from Web Views if a device is running low on space"; the same risk applies to IndexedDB "at least on iOS". On Android the persisted storage API can mark IndexedDB data as persistent. For large data the docs recommend SQLite (e.g. capacitor-sqlite); the Preferences API is for small key/value data. — [Capacitor docs, storage](https://capacitorjs.com/docs/guides/storage)

**Service worker**
- Forum and Q&A reports (not official docs): service workers in an iOS WKWebView need iOS 14+ and App-Bound Domains (`WKAppBoundDomains`); in Capacitor, `serviceWorker.register()` still fails because the app is served from the `capacitor://` scheme, not HTTP/HTTPS. A Capacitor feature request to automate App-Bound Domains exists, so it is not built in. — [Stack Overflow mirror: running serviceworker in capacitor app on iOS](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/71245695/running-serviceworker-in-capacitor-app-on-ios); [Apple Developer Forums thread 781744](https://developer.apple.com/forums/thread/781744); [Capacitor feature request (Lightrun mirror)](https://lightrun.com/answers/ionic-team-capacitor-feat-implement-app-bound-domains-to-enable-service-workers-in-wkwebview-on-ios14); [Median docs](https://docs.median.co/docs/service-workers). Flag: these are older community sources; I did not find a current official statement.

**Android distribution (single user)**
- Android developer verification: goes live on 30 September 2026 for users in Indonesia, Singapore and Thailand (initially for installs from seven app stores including Google Play, Galaxy Store, Xiaomi GetApps); "will be expanded globally for all apps on certified Android devices in 2027". — [Google, Understanding Android developer verification](https://support.google.com/android-developer-console/answer/16561738?hl=en)
- ADB stays open: developers and power users "can still use Android Debug Bridge (ADB) to build, test, and install modified or unverified apps on their own devices". — [Google support](https://support.google.com/android-developer-console/answer/16561738?hl=en)
- A free limited-distribution account (students, hobbyists, small closed groups) has no fee and allows an unlimited number of apps on up to 20 devices without a government ID. An "advanced flow" lets advanced users install apps from unverified developers after a one-time setup. — [Google support](https://support.google.com/android-developer-console/answer/16561738?hl=en)
- Press reports say the advanced flow can be enabled for seven days or indefinitely, with a warning; one report mentions a 24-hour wait for unverified apps. — [Engadget](https://engadget.com/apps/android-will-hide-app-sideloading-behind-a-new-one-time-security-process-184651171.html); [TechRepublic](https://techrepublic.com/article/news-google-android-sideloading-24-hour-wait) (not checked against Google's developer docs).

**iOS distribution (single user)**
- Free Apple Account ("Personal Team" in Xcode): "You can register up to 10 App IDs, which expire after 7 days." "You can register up to 3 devices, which expire after 7 days." "You can install up to 3 apps per device. Provisioning profiles that enable apps to be installed on a device will expire 7 days from issuance. You'll need to rebuild and reinstall your app to your device after expiration." — [Apple, compare memberships](https://developer.apple.com/support/compare-memberships/)
- SideStore sideloads "using only your Apple ID", on iOS/iPadOS 14+; it refreshes apps in the background "to keep their normal 7-day development period from expiring"; uses a local VPN app (LocalDevVPN) that connects only to the device; "You only need a computer once during installation." With a free account "SideStore can only install 3 apps (including itself) at a time" and "only 10 different apps may be installed in a week". "To remove this restriction (and also get a 365 day expiry), you can pay for a $99/year Apple Developer account." — [SideStore FAQ](https://docs.sidestore.io/docs/faq); [SideStore intro](https://docs.sidestore.io/docs/intro)
- Conflicting third-party claim: Sideloadly says the 10 App IDs reset every 4 days (Apple says 7). — [Sideloadly FAQ](https://sideloadly.io/faq) (seen only in a search summary; Apple's page is the primary source).

### Inferences
- Code change for the scanner is small: on `Capacitor.isNativePlatform()`, call the plugin's `scan()` and pass the string to the existing Open Food Facts lookup; on the web, keep the current in-browser scanner. Routing (`preact-router`), Dexie and CSS Modules need no change.
- The Capacitor app is a different origin from the deployed static PWA, so its IndexedDB starts empty. Existing data must move with an export/import (e.g. JSON file) once. The two copies (web PWA and native app) do not sync.
- In the native build, do not register the `vite-plugin-pwa` service worker (assets are already local in the app bundle, so offline works without it). A build flag or `Capacitor.isNativePlatform()` check can skip registration.
- Because iOS can evict WebView IndexedDB under low storage, a native build should call `navigator.storage.persist()` where it works (Android) and keep a regular export as a backup. A move to SQLite is the "safe" option but is a large change for this app.
- Effective cost: Android = 0 (debug APK via `adb install` or file manager; from 2027, use ADB or the free hobbyist account). iOS = 0 with weekly re-signing (Xcode rebuild every 7 days, or SideStore auto-refresh, which uses 2 of the 3 free app slots), or $99/year for a 1-year profile. A Mac with Xcode is required for any iOS build.

### Gaps
- No current (2026) official Capacitor statement on service worker behaviour in iOS WebViews was found.
- AltStore constraints (AltServer on a computer, Wi-Fi refresh) were not verified separately; EU alternative app marketplaces were not researched.
- Whether Capacitor's `server.url` (load the live deployed site in the native shell, so data stays on the PWA origin and plugins still work) is safe/allowed for this use was not researched.
- No source on how the Android verification rules treat a file-manager APK install outside the three launch countries before 2027.

## 3. Android-only options: TWA, Google Code Scanner, scanner apps with URL callback (Binary Eye)

### Takeaway
Google Code Scanner is a native-only API; a web page cannot call it, so it needs Capacitor or a native shell. A Trusted Web Activity (Bubblewrap) cannot call native APIs from JavaScript, but a custom native activity can pass data to the page through URLs or the TWA PostMessage API (Chrome 115+). The zero-code route is Binary Eye (free, MIT, ad-free, F-Droid/Play): the PWA opens a `binaryeye://scan?ret=…{RESULT}` deep link and Binary Eye opens the return URL with the code. No 2026 evidence was found that this round trip lands in an installed PWA; it should work in theory via WebAPK link capture, but test it.

### Cited Findings
**Google Code Scanner**
- Runs in Google Play services; the app gets only the result; no camera permission is needed; processing is on-device. Invoked natively with `GmsBarcodeScanning.getClient(context)` and `startScan()`. The module is unbundled and downloads at install (meta-data `barcode_ui`), on request (ModuleInstallClient), or on first use. Auto-zoom from 16.1.0, off by default (`enableAutoZoom()`). Minimum API level 23. Intended for apps that do not need a custom UI. — [Google ML Kit, code scanner](https://developers.google.com/ml-kit/vision/barcode-scanning/code-scanner)
- The documentation describes only the native Android API; it documents no intent or web entry point. — [Google ML Kit, code scanner](https://developers.google.com/ml-kit/vision/barcode-scanning/code-scanner)

**Trusted Web Activity (Bubblewrap)**
- A TWA opens the web app from an Android app through a Custom Tabs-based protocol; content is rendered by the browser (Chrome 72+). "The host app doesn't have direct access to web content in a Trusted Web Activity." The app can "coordinate with the web content by passing data to and from the page in URLs" (query parameters, intent URIs). App and site must be from the same developer, verified with Digital Asset Links. Bubblewrap is the Node CLI to generate TWA projects. — [Chrome docs, TWA overview](https://developer.chrome.com/docs/android/trusted-web-activity/overview)
- PostMessage for TWA: two-way messages between the native app and the page; needs Chrome 115.0.5790.13+ and androidx.browser 1.6.0-alpha02+; the host app must send the first message, which carries the port; the page listens for `message` and uses `event.ports[0]`. — [Chrome docs, PostMessage for TWA](https://developer.chrome.com/docs/android/post-message-twa)

**Installed PWA link capture on Android (WebAPK)**
- Chrome installs a PWA as a WebAPK that registers intent filters for all URLs within the app's scope, so in-scope links from other apps can open the installed PWA; the PWA must be installed. — [web.dev, WebAPKs on Android](https://web.dev/articles/webapks)
- Older community reports (2018–2020): links clicked inside the browser still prefer the browser; Android may show a chooser between PWA and browser. — [WICG discourse, PWAs as URI handlers](https://discourse.wicg.io/t/proposal-pwas-as-uri-handlers/4394) (flag: old).

**Binary Eye**
- "This one is free, without any ads, and open source"; MIT licence; on F-Droid and Google Play. "Binary Eye uses the ZXing-C++ ("Zebra Crossing") barcode scanning library." Reads EAN-8, EAN-13, UPC-A, UPC-E, UPC/EAN extension and many more. — [Binary Eye README (raw)](https://raw.githubusercontent.com/markusfisch/BinaryEye/master/README.md); [Binary Eye GitHub](https://github.com/markusfisch/BinaryEye)
- Native apps can use the `com.google.zxing.client.android.SCAN` intent and read the `SCAN_RESULT` extra. — [Binary Eye GitHub](https://github.com/markusfisch/BinaryEye)
- Deep links: `binaryeye://scan` or `http(s)://markusfisch.de/BinaryEye`. "If you want to get the scanned contents, you can add a `ret` query argument with a (URL encoded) URI template." Placeholders: `{RESULT}`, `{RESULT_BYTES}` (hex), `{FORMAT}`. README example: `http://markusfisch.de/BinaryEye?ret=http%3A%2F%2Fexample.com%2F%3Fresult%3D{RESULT}`. — [Binary Eye GitHub](https://github.com/markusfisch/BinaryEye)
- Continuous mode (`continuous=true`) POSTs JSON to a `callback` URL per scan; "The requests do not share the browser's cookies or execute JavaScript", so it needs a server endpoint — not usable for a backend-less PWA. — [Binary Eye README (raw)](https://raw.githubusercontent.com/markusfisch/BinaryEye/master/README.md)

### Inferences
- Concrete Android recipe (no native code, untested): in the PWA, a "Scan with Binary Eye" link to `https://markusfisch.de/BinaryEye?ret=https%3A%2F%2F<your-host>%2Fscan%3Fbarcode%3D{RESULT}%26format%3D{FORMAT}` (or `binaryeye://scan?ret=…`). Binary Eye scans and opens `https://<your-host>/scan?barcode=4006381333931&format=EAN_13`. If the PWA is installed as a WebAPK and `/scan` is in the manifest scope, Android should route that URL into the installed PWA (WebAPK intent filters), which shares Chrome's storage for the origin, so Dexie data is intact. The `/scan` route reads `barcode`, checks `format`, and runs the normal lookup.
- Risk: each scan leaves the PWA, opens Binary Eye, and returns by a full page load (cold start), possibly with a chooser dialog. The flow is slower than an in-app scanner.
- Binary Eye uses ZXing-C++, the same decoder family as the WASM ponyfill tried before. Any quality gain comes from the native camera pipeline (autofocus, resolution, frame rate), not from a different decoder.
- A TWA with Google Code Scanner is possible (a native Kotlin activity calls `GmsBarcodeScanning`, then relaunches the TWA URL with `?barcode=`, or uses PostMessage), but Bubblewrap does not generate that code. It is custom Android work with less payoff than Capacitor, which already has the plugin.

### Gaps
- No 2026 report found that confirms a Binary Eye `ret` round trip into an installed PWA, or how Chrome 2026 handles a custom-scheme (`binaryeye://`) navigation from a standalone PWA.
- The original ZXing "Barcode Scanner" app and its `zxing://scan/?ret=` URL: status in 2026 not verified.
- No source states clearly whether TWA storage is shared with the Chrome browser tab of the same origin (the TWA overview page does not say).
- No other free ML Kit-based Android app with a documented URL callback was found.

## 4. iOS-only options: Shortcuts "Scan QR/Barcode", VisionKit, Camera app / Live Text, URL callback round trip

### Takeaway
The iOS Shortcuts app can scan a barcode with Apple's built-in reader and open a URL with the code, and the `shortcuts://x-callback-url/run-shortcut` scheme returns the shortcut's text output as `result` on the `x-success` URL. This gives a free, no-code round trip. The blocker: iOS has no link capture for home-screen web apps (URLs open in Safari) and home-screen web apps do not share storage with Safari, so the code lands in a Safari tab whose IndexedDB is not the app's data. It works cleanly only if the app is used in Safari (as a bookmark, not "Open as Web App"). VisionKit `DataScannerViewController` is native-only (iOS 16+), reachable only from a native wrapper.

### Cited Findings
**Shortcuts**
- The "Scan QR/Barcode" action "scans a QR code or bar code using the camera, and returns the text/URL that is found". — [Matthew Cassinelli, Scan QR code](https://matthewcassinelli.com/shortcuts/scan-qr-code) (from search summary)
- A live food-app example (Nourish) uses this recipe: Shortcuts → "+" → add "Scan QR/Barcode" → add "URL" action (not "Open URLs") with `https://YOUR-APP.pages.dev/pages/scan.html?barcode=` and insert the "Scan QR/Barcode" variable at the end → add "Open URLs" → name the shortcut → Done. It says the scanner uses Apple's built-in barcode reader. It does not say whether the URL opens in Safari or the home-screen web app. — [Nourish scan page](https://nourishnyc.pages.dev/pages/scan.html)
- x-callback-url syntax example: `shortcuts://x-callback-url/run-shortcut?name=Calculate%20Tip&input=text&text=24.99&x-success=...&x-cancel=...`. On success "a parameter named result is appended to the URL and contains the textual output of the shortcut." `x-error` gets `errorMessage`; on cancel "no output from the shortcut is provided." — [Apple Shortcuts User Guide, x-callback-url](https://support.apple.com/guide/shortcuts/use-x-callback-url-apdcd7f20a6f/ios)

**Home-screen web app limits (iOS)**
- firt.dev iOS PWA table (last updated 13 Oct 2026): "Storage shared with Browser" ❌; "Link Capturing" ❌ — "Only a push message can open an installed PWA". "Since iOS and iPadOS 26, every website your users add to the Home Screen opens as a web app by default"; users can turn this off to get a browser bookmark. Shape Detection is "❌⏳ 17 (experimental)". — [firt.dev, iOS PWA compatibility](https://firt.dev/notes/pwa-ios/)
- WebKit bug 181849 "'Add to homescreen' apps don't share storage with Safari" (opened 2018, still open in 2022). — [WebKit Bugzilla 181849](https://bugs.webkit.org/show_bug.cgi?id=181849) (flag: old, but consistent with the Oct 2026 firt.dev table)

**Third-party iOS scanner apps with URL callback**
- pic2shop (free app): launch `pic2shop://scan?callback=<escaped URL>`; the literal `EAN` placeholder in the callback is replaced with the digits; reads EAN-13/UPC-A (sources disagree on full format list). — [Vision Smarts, pic2shop developers](https://www.visionsmarts.com/apps/pic2shop/developers.html) (from search summary; flag: documentation and app may be old; current iOS compatibility not verified)
- "Bar Code" app: `bar-code://scan?callback=[callback url]`, supports EAN-8, EAN-13, UPC-A, UPC-E (per App Store listing in search summary). — [App Store, Bar-code](https://apps.apple.com/hn/app/bar-code/id422314523?l=en-GB) (not verified)

**VisionKit DataScannerViewController**
- "An object that scans the camera live video for text, data in text, and machine-readable codes." iOS/iPadOS 16.0+. Check `isSupported` (device supports data scanning) and `isAvailable` (camera access granted, no restrictions) before use; needs `NSCameraUsageDescription`. Properties: `isGuidanceEnabled`, `isHighlightingEnabled`, `isPinchToZoomEnabled`, `zoomFactor`, `qualityLevel`, `recognizesMultipleItems`, `isHighFrameRateTrackingEnabled`. — [Apple docs, DataScannerViewController](https://developer.apple.com/documentation/visionkit/datascannerviewcontroller)
- The Ionic Capacitor plugin uses Apple Vision on iOS (Scanbot names it "Apple VisionKit"). — [Capacitor docs](https://capacitorjs.com/docs/apis/barcode-scanner); [Scanbot blog](https://scanbot.io/blog/capacitor-barcode-scanner-vs-capacitor-mlkit/)

### Inferences
- Concrete iOS recipe A (one-way, start from the Shortcut): shortcut "Scan food" = (1) Scan QR/Barcode → (2) URL `https://<your-host>/scan?barcode=[Scanned code]` → (3) Open URLs. Start it from the home screen icon, Control Center, Back Tap or the Action button. Result: Safari opens `/scan?barcode=…`.
- Concrete iOS recipe B (round trip, start from the PWA): a link in the PWA to `shortcuts://x-callback-url/run-shortcut?name=Scan%20food&x-success=https%3A%2F%2F<your-host>%2Fscan`. Shortcut = (1) Scan QR/Barcode → (2) Stop and Output (scanned code). iOS opens `https://<your-host>/scan?result=4006381333931` — in Safari.
- Both recipes land in Safari, not in the home-screen web app, and Safari has a different IndexedDB. So they work only if the developer uses the app as a Safari bookmark (turn off "Open as Web App" on iOS 26+). Then all data lives in Safari's storage for the origin.
- A clipboard workaround for the home-screen app (shortcut copies the code; user switches back; PWA has a "Paste barcode" button) avoids the storage split but adds manual steps; not verified.
- I found no API or URL scheme that lets a web page receive a code that the stock Camera app or Live Text detects.
- Apple's reader in Shortcuts very probably uses the same Vision engine as DataScannerViewController, but no source confirms this.

### Gaps
- No source confirms that a `shortcuts://` link opens from a standalone home-screen web app in iOS 26, or how the x-success URL behaves (new Safari tab or existing tab).
- No measurement of the Shortcuts scanner quality on EAN-13 found.
- Safari storage eviction rules for a site used daily from a bookmark (vs. a home-screen app) in iOS 26 not researched.
- Device requirement for DataScannerViewController (A12 Bionic or later, from memory) not confirmed in the fetched doc.

## 5. Quality evidence: ML Kit / Apple Vision vs ZXing-family decoders on 1D codes

### Takeaway
No independent, live-camera benchmark of ML Kit or Apple Vision vs ZXing on EAN-13 misreads was found. The only numeric data is vendor-published and uses still images with many codes per image; there ZXing-C++ finds more codes than Vision or ML Kit, but Vision and ML Kit are about 40x faster per image. So the decoder is not obviously the cause of the misreads; the native gain is mostly in the camera pipeline (autofocus, resolution, auto-zoom, high frame rate with checks).

### Cited Findings
- Dynamsoft iOS benchmark (vendor; updated 27 Oct 2026): 83 still images (Dynamsoft test sheet, all symbologies, many images with several codes), no live camera. Detected codes: Apple Vision 150 (~96 ms/image), ML Kit 8.0.0 120 (~98 ms/image), ZXing-CPP 2.3.0 346 (~3,804 ms/image), Dynamsoft 354. Vision and ML Kit reportedly return only the largest/clearest code on multi-code images and struggle with closely spaced bars (Code 128, ITF) at low resolution. No misread/false-positive counts and no EAN-specific figures. — [Dynamsoft iOS benchmark](https://www.dynamsoft.com/codepool/ios-barcode-scanner-benchmark-app-swiftui.html)
- Dynamsoft Android comparison (vendor): ML Kit about 46 ms vs 116 ms per image but fewer codes found, with the largest gaps on multi-barcode scenes. — [Dynamsoft, ZXing vs ML Kit vs Dynamsoft](https://www.dynamsoft.com/codepool/zxing-mlkit-dynamsoft-barcode-scanner.html) (from search summary; not fetched)
- ML Kit input guidance: each module at least 2 px wide; EAN-13 is 95 modules, so the barcode should be at least 190 px wide; poor focus reduces accuracy; use 1280x720 or 1920x1080 for typical apps; avoid native camera resolution, request about 2 MP or less. Auto-zoom (`setZoomSuggestionOptions`) in bundled 17.2.0 / unbundled 18.3.0+. Bundled model about 2.4 MB; Play Services model about 200 KB. — [Google ML Kit, Android barcode scanning](https://developers.google.com/ml-kit/vision/barcode-scanning/android)
- Scanbot (vendor) reports iOS autofocus problems (iPhone 15) with the Ionic plugin, and tiny-barcode problems with the Capawesome ML Kit plugin. — [Scanbot blog, Jan 2026](https://scanbot.io/blog/capacitor-barcode-scanner-vs-capacitor-mlkit/)

### Inferences
- The still-image benchmarks penalise Vision/ML Kit for returning one code per image; for one EAN-13 held in front of the camera this matters little. They do not measure what the developer sees (wrong values, poor focus).
- "Wrong values" with an EAN-13 check digit usually point to bad frames (blur, low resolution, partial code) being accepted. Native scanners get continuous autofocus, proper resolution and (Code Scanner) auto-zoom from the OS camera stack; the browser's `getUserMedia` stream gives the page little focus control, especially on iOS. This is the strongest argument for the native route.
- Whatever engine is used, the app can reduce misreads by requiring the same value in 2–3 consecutive frames (possible with `startScan` listeners, not with the one-shot `scan()` UI) and by checking the EAN check digit before lookup.

### Gaps
- No independent (non-vendor) live-camera study of EAN-13 misread rates for ML Kit, Apple Vision, Google Code Scanner or ZXing-C++ was found.
- No data on low light or motion blur specifically for these engines.

## 6. Expo / React Native rewrite (the heavy option)

### Takeaway
A rewrite in React Native/Expo would give full native camera and scanner control, but it replaces the Preact UI, CSS Modules and Dexie/IndexedDB layer, and it has the same iOS distribution limits as Capacitor. For a personal app with a working PWA, it costs much more than Capacitor for the same scanner engines.

### Cited Findings
- iOS distribution constraints (7-day free profiles, 3 apps per device, or $99/year membership) apply to any native app, so they apply to Expo too. — [Apple, compare memberships](https://developer.apple.com/support/compare-memberships/); [SideStore FAQ](https://docs.sidestore.io/docs/faq)

### Inferences
- Capacitor keeps the whole codebase and adds only a scanner call; a React Native/Expo rewrite gives no extra scan quality over the same ML Kit / Apple Vision engines that the Capacitor plugins already use.

### Gaps
- I did not research which engine Expo's camera module uses for barcodes in 2026, or its current effort/cost.
