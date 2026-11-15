# Camera focus and image sharpness for close-range 1D barcode scanning in a PWA (Android Chrome + iOS Safari), status November 2026

Context: the app opens the camera with `getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })`, then applies `{ advanced: [{ focusMode: 'continuous' }] }` if supported. On iOS it uses html5-qrcode with only `{ facingMode: 'environment' }`. Close-up grocery barcodes stay blurry.

Note on evidence quality: the strongest evidence below is WebKit and Chromium source code and commit history (primary). Vendor changelogs (STRICH, Scanbot, Dynamsoft) are second. Small GitHub PRs/issues and forum posts are anecdotal field reports.

---

## 1. iPhone Pro minimum focus distance: what web scanners do (virtual multi-camera devices, lens auto-switching)

### Takeaway
On iPhone 13 Pro and later Pro models, the plain "Back Camera" (wide lens) cannot focus closer than about 15-20 cm. Since iOS 16.3/16.4, Safari exposes all back lenses plus Apple's *virtual* multi-camera devices ("Back Dual Wide Camera", "Back Triple Camera") in `enumerateDevices()`. When you open a virtual device by `deviceId`, iOS switches lenses automatically (ultra-wide macro at close range). WebKit maps web `zoom: 1` on these virtual devices to device zoom 2x, so the field of view looks normal. The commercial web SDK STRICH selects "Back Dual Wide Camera" by default since Feb 2024 for exactly this reason. Labels are localized, so label matching is fragile.

### Cited Findings
- **The hardware problem.** iPhone 13 Pro, 13 Pro Max, 14 Pro and 14 Pro Max back cameras cannot focus on objects closer than about 15 cm; other tested iPhones (non-Pro) focus at about 4 cm. The reporter lists QR/barcode reading in web apps as an affected use case (WebKit bug 247737, filed 2022-11-10, closed as duplicate of 248054 "Use AVCaptureDeviceDiscoverySession for camera discovery") — [WebKit bug 247737](https://bugs.webkit.org/show_bug.cgi?id=247737)
- An Apple forums post gives the iPhone 14 Pro wide camera minimum focus distance as 200 mm, against about 150 mm on earlier models — [Apple Developer Forums 721603](https://developer.apple.com/forums/thread/721603)
- Apple did not publish a per-model table; a developer was told to read `AVCaptureDevice.minimumFocusDistance` at runtime — [Apple Developer Forums 769268](https://developer.apple.com/forums/thread/769268)
- Users report the same blur in 3rd-party scanning apps on the 14 Pro and a need to hold the phone about 20 cm away — [MacRumors forum](https://forums.macrumors.com/threads/iphone-14-pro-cant-focus-close-up-qr-codes-3rd-party-apps.2367008/)
- **iOS exposes all back cameras to the web since iOS 16.3.** Before, iOS 16.2 and earlier returned only one front and one back `videoinput`. The author says the ultra-wide lens helps with close-up barcode scanning (post dated 2023-02-13) — [Dominik Schilling](https://dominikschilling.de/notes/ios-access-all-back-cameras-mediadevices-api/)
- **WebKit added AVCapture virtual cameras** (commit 258585@main, 2023-01-06, bug 250142 "[Cocoa, MediaStream] support AVCapture virtual cameras"). In the bug discussion: virtual cameras switch lenses on zoom, light level and focus position; iPhone 12 Pro does not auto-switch (its ultra-wide has no autofocus) but 13 Pro and 14 Pro do; a commenter says `builtInDualWideCamera` switches between Wide and UltraWide "only if the zoomFactor is set to 2x"; Simon Taylor confirmed auto-switching on iPhone 14 Pro — [WebKit bug 250142](https://bugs.webkit.org/show_bug.cgi?id=250142)
- **iOS 16.4 beta regression:** `facingMode: 'environment'` started to return an ultra-wide-looking stream, because virtual cameras started at `videoZoomFactor` 1 (= ultra-wide field of view). A commenter (connell, 2023-03-02) said back-camera names are **localised**, so label matching has no reliable workaround, and asked for a non-localised "lensType" field. In the camera app, the switch to macro happens at roughly 10 cm — [WebKit bug 253186](https://bugs.webkit.org/show_bug.cgi?id=253186)
- **The fix (WebKit 261877@main, 2023-03-20):** "For ultra wide back cameras, add a zoom factor of 2 so that a zoom of 1 corresponds to a standard FOV. We compute this factor once and we then divide by this factor for capabilities and multiply by this factor for settings." — [WebKit commit 1ed9893d37](https://github.com/WebKit/WebKit/commit/1ed9893d37)
- **Current WebKit source (main, Nov 2026):** `cameraZoomScaleFactor()` returns 2.0 for `AVCaptureDeviceTypeBuiltInTripleCamera` and `AVCaptureDeviceTypeBuiltInDualWideCamera`, 1.0 otherwise; `computeMinZoom()` returns `1.0 / m_zoomScaleFactor` (so web min zoom = 0.5 on these devices); the requested web zoom is multiplied by the scale factor before `setVideoZoomFactor` — [WebKit AVVideoCaptureSource.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/mediastream/cocoa/AVVideoCaptureSource.mm)
- Safari 17.0 release: bug fix "camera selection to use the system preferred camera on iOS" — [WebKit Features in Safari 17.0](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/)
- **STRICH (commercial web SDK) changelog, 1.4.3 (2024-02-12):** "The default camera on iPhones with multiple back-facing cameras (e.g. iPhone 15 Pro) is now the *Back Dual Wide Camera*. Previously, the *Back Camera* was selected, which resulted in bad scanning performance due to the camera being out of focus." — [STRICH changelog](https://docs.strich.io/CHANGELOG.md)
- STRICH 1.12.0 (2025-12-04): "An incorrect default camera was being selected on iPhones with three cameras when using a French locale." (confirms label localisation breaks label matching); 1.12.2 (2025-12-15): camera selection can be customised with a camera selector callback; 1.9.1 (2025-08-11): `rememberCameraDeviceId` falls back to the device label when the ID changes — [STRICH changelog](https://docs.strich.io/CHANGELOG.md)
- **Scanbot native iOS SDK** (evidence of the same fix in native code): changelog says the default back camera was changed to the triple or dual camera, and on iPhone 14 Pro to the ultra-wide lens "due to close-focusing issues with these devices" — [Scanbot iOS changelog](https://docs.scanbot.io/ios/barcode-scanner-sdk/changelog/)
- Native apps in 2025-2026 apply the same pattern: prefer triple, then dual-wide, then dual, then wide camera, plus tap-to-focus (Expo/iOS app PR) — [fud-ai PR #421](https://github.com/apoorvdarshan/fud-ai/pull/421); an issue says the plain wide lens on iPhone 13 Pro+ cannot focus closer than ~15 cm and cites Apple guidance to use `builtInTripleCamera`/`builtInDualWideCamera` — [openbot issue #1878](https://github.com/nightly-labs/openbot/issues/1878)
- A face-liveness SDK doc lists the iOS label preference order "Back Triple Camera" first, then "Back Dual Wide Camera" — [Doubango docs](https://www.doubango.org/SDKs/face-liveness/docs/Stream_injection_detection.html)
- **Side effect of virtual devices:** on iPhone 15 / 15 Pro with iOS 18.3.2, a getUserMedia user (finger-on-lens heart-rate app, `deviceId` + `advanced: [{ zoom: 1.0 }]`) reports that iOS switches between wide, ultra-wide and telephoto during capture and asks how to stop it; no Apple answer (March 2025) — [Apple Developer Forums 776460](https://developer.apple.com/forums/thread/776460)
- An iPadOS 18.4.1 user could not reliably pick the back camera by label in a web app — [Apple Community 256099847](https://discussions.apple.com/thread/256099847)
- html5-qrcode issue #820: iPhone 13 Pro Max / iOS 16.6.1, focus fails on all cameras; another commenter got a much higher detection rate with a different decoder on the same phone; a commenter says without MediaConstraints the image is blurrier and lower resolution, and even at 1920x1080 a QR code is too blurry when close — [html5-qrcode #820](https://github.com/mebjas/html5-qrcode/issues/820)

### Inferences
- For iOS, the most effective free fix is: after a first `getUserMedia` call (to unlock labels), call `enumerateDevices()`, pick the `videoinput` whose label is "Back Triple Camera", else "Back Dual Wide Camera", else "Back Camera", and reopen with `deviceId: { exact: id }`. With WebKit's 2x scale factor, the default web zoom 1 gives a normal field of view and iOS can drop to the ultra-wide lens for macro focus.
- Because labels are localized, a locale-robust heuristic is needed. Options: (a) match English *and* known localized names; (b) use enumeration order on iOS (connell's workaround in bug 253186); (c) open each back camera and read `getCapabilities()`: virtual devices report `zoom.min` of 0.5 (from `computeMinZoom()`), while plain lenses report min zoom 1. Option (c) is derived from the WebKit source above, not tested on a device.
- `getCapabilities().focusDistance.min` on iOS reports the lens `minimumFocusDistance` in metres (see section 2). An app can use it to detect a lens with a large minimum focus distance and then show "hold the phone further away" guidance or apply zoom. This is derived from source; not tested on a device.
- html5-qrcode with `{ facingMode: 'environment' }` does not select a virtual device by label; STRICH's changelog suggests that this path ended up on "Back Camera" (blurry) before they changed the default. This matches the developer's symptom.
- Lens auto-switching (jumps in the preview) is acceptable for barcode scanning; it is a problem only for AR or finger-on-lens use cases.

### Gaps
- No primary source states which device `facingMode: 'environment'` (without `deviceId`) selects on iOS 17, 18 and 26 on Pro models. Safari 17.0 says "system preferred camera"; which physical/virtual device that maps to was not found.
- No WebKit doc or release note lists the exact label strings, or their localized forms.
- No measured data on whether "Back Triple Camera" or "Back Dual Wide Camera" scans 1D barcodes better in Safari.
- No minimum-focus-distance figures for iPhone 15/16/17 Pro from Apple.

---

## 2. iOS Safari support for zoom, focusMode, focusDistance, pointsOfInterest, torch; implementing "hold further and zoom 2x"

### Takeaway
iOS Safari supports `zoom` (since Safari 17.0; up to 10x since 2024), `torch` (code landed Oct 2023, works from about iOS 17.4), and `whiteBalanceMode`. `focusDistance` is exposed only as a read-only capability. `focusMode`, `pointsOfInterest` (tap-to-focus) and `exposureMode` are **not** implemented. The camera always runs Apple's continuous autofocus. So "hold further and zoom 2x" on iOS is: `track.applyConstraints({ advanced: [{ zoom: 2 }] })` when `getCapabilities().zoom` exists, or a CSS/canvas crop as a fallback. Some 2026 third-party articles still say iOS has no zoom; WebKit source contradicts them.

### Cited Findings
- **Zoom capability added** (WebKit 261679@main, 2023-03-15, bug 253646): "Expose zoom as a supported constraint ... we currently restrict zoom to 4 at most to limit potential privacy issue" — [WebKit commit 1afb53f1cc](https://github.com/WebKit/WebKit/commit/1afb53f1cc)
- Safari 17.0 release lists "exposing zoom in MediaTrackCapabilities" — [WebKit Features in Safari 17.0](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/)
- **Zoom limit raised** (WebKit 276917@main, 2024-04-02, bug 271968): "[Cocoa] Allow camera zoom above 2x ... Allow up to 10x on all cameras that support that level of zoom." Current code: `std::min([format videoMaxZoomFactor] / m_zoomScaleFactor, 10.0)` — [WebKit commit 1fc3314c16](https://github.com/WebKit/WebKit/commit/1fc3314c16); [AVVideoCaptureSource.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/mediastream/cocoa/AVVideoCaptureSource.mm)
- WebKit fixed a 2025 bug: "Torch is switching off for a small delay when zooming in or out" (2025-07-01), so zoom and torch are used together in shipping code — [WebKit commit a6eec2349d](https://github.com/WebKit/WebKit/commit/a6eec2349d)
- **focusDistance:** "Expose ... mediatrackcapabilities-focusdistance" (2023-03-14) — [WebKit commit 9e0b325427](https://github.com/WebKit/WebKit/commit/9e0b325427). Current source: under `HAVE(AVCAPTUREDEVICE_MINFOCUSLENGTH)`, `capabilities.setFocusDistance({ minimumFocusDistance / 1000, std::numeric_limits<double>::max() })`. The file has no focus setters and no reference to `focusMode`, `AVCaptureFocusModeContinuousAutoFocus`, `autoFocusRangeRestriction` or `pointsOfInterest`; no exposure code — [AVVideoCaptureSource.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/mediastream/cocoa/AVVideoCaptureSource.mm)
- **Torch:** "[MediaStream] Add support for torch" landed 2023-10-04 — [WebKit commit 9c0b105d80](https://github.com/WebKit/WebKit/commit/9c0b105d80). WebKit bug 243075 ("torch track constraint ignored on iOS"): Eric Carlson said in 2022 that WebKit did not support Image Capture; in Aug 2024 the reporter found torch working on iOS 17.5.1 and Carlson replied "I forgot to update this when I added support for torch!" — [WebKit bug 243075](https://bugs.webkit.org/show_bug.cgi?id=243075)
- `navigator.mediaDevices.getSupportedConstraints()` "mistakenly reports torch as false" — fixed 2024-03-11 — [WebKit commit 8153861f27](https://github.com/WebKit/WebKit/commit/8153861f27)
- Other torch fixes: "[iOS] Reconfiguring the device is often switching off the torch" (2024-07-11) — [WebKit commit f441f31ce4](https://github.com/WebKit/WebKit/commit/f441f31ce4); Safari 18.4: "Fixed getUserMedia video track getSettings() returning a stale value for torch and whiteBalanceMode constraints" — [WebKit Features in Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)
- STRICH 1.4.6 (2024-04-04): "Flashlight capability is now available on iOS, as newer versions of Safari apparently support it." 1.5.4 (2024-10-09): "Fixed an issue in Safari on iOS 18 that prevents the flashlight from being turned off after it has been turned on." 1.11.0 (2025-10-27): zoom overlay "shown if the browser and the selected camera support it", double-tap to zoom — [STRICH changelog](https://docs.strich.io/CHANGELOG.md)
- vue-qrcode-reader README (v5.7.2) says torch is not supported on iOS, as of iOS 17.1 (older state, before the 17.4-era change) — [vue-qrcode-reader README](https://unpkg.com/vue-qrcode-reader@5.7.2/README.md)
- `whiteBalanceMode` added 2023-09-18 — [WebKit commit 351ec2749d](https://github.com/WebKit/WebKit/commit/351ec2749d)
- **Older, now outdated:** on iOS 16.3, `getCapabilities()` returned no zoom or torch — [Apple Developer Forums 724230](https://developer.apple.com/forums/thread/724230)
- **Conflicting secondary source:** Dynamsoft (page "Updated Jul 14, 2026") says native camera zoom is limited to Android Chrome / Chromium and iOS Safari does not support it; it recommends a simulated CSS/WebGL zoom — [Dynamsoft zoom article](https://www.dynamsoft.com/codepool/camera-zoom-control-on-web.html). Contradicted by the WebKit commits and Safari 17.0 notes above. Dynamsoft also says `focusMode`/`focusDistance` are not exposed on iOS Safari — [Dynamsoft focus article](https://www.dynamsoft.com/codepool/camera-focus-control-on-web.html) (consistent with WebKit source for `focusMode`; partly wrong for `focusDistance`, which WebKit exposes read-only).
- Bug 250142 discussion: with `builtInDualWideCamera`, set device zoom 2x to get full focus range with the standard field of view — [WebKit bug 250142](https://bugs.webkit.org/show_bug.cgi?id=250142). Apple-side guidance to apply a zoom derived from `minimumFocusDistance` so the user holds the phone further away is quoted in — [openbot issue #1878](https://github.com/nightly-labs/openbot/issues/1878)
- html5-qrcode added a zoom feature to `Html5QrcodeScanner` in v2.3.2 (maintainer reply on small-code issue) — [html5-qrcode #251](https://github.com/mebjas/html5-qrcode/issues/251)

### Inferences
- "Hold further and zoom 2x" on the web, iOS:
  1. If a virtual device ("Back Triple/Dual Wide Camera") is open, leave zoom at 1 (the device does macro switching by itself). Optionally zoom 1.5-2 to make a small barcode larger when the user holds the phone further away.
  2. If only "Back Camera" (wide) is available, call `track.applyConstraints({ advanced: [{ zoom: 2 }] })` when `track.getCapabilities().zoom?.max >= 2`. Tell the user to hold the phone about 20-25 cm away.
  3. If `zoom` is missing (old iOS or other browser), crop the centre of the video into a canvas before decoding (digital zoom). This gives no extra optical detail, but it makes the preview match the scan box and keeps the user at focus distance.
- Feature-detect with `track.getCapabilities()` (not `getSupportedConstraints()`), because WebKit reported `torch: false` there by mistake until early 2024.
- On iOS, do not try `focusMode`, `focusDistance` (write) or `pointsOfInterest`; WebKit ignores them. A "tap to refocus" on iOS can only be simulated (for example, briefly apply a different zoom and back); no source confirms that this triggers a refocus.
- The likely shipping version for torch is iOS/Safari 17.4 (commit Oct 2023, STRICH note April 2024, user report on 17.5.1). This is inferred; no release note states it.

### Gaps
- No Safari release note explicitly names the Safari version that shipped torch, or the 10x zoom limit.
- No source confirms whether iOS Safari uses `AVCaptureAutoFocusRangeRestriction.near`; the WebKit file does not reference it.
- iOS 26 specific camera changes (other than `ImageCapture.grabFrame`, section 6) were not found.

---

## 3. Android Chrome: working constraints, which camera `facingMode: environment` picks, picking the best back camera, known focus bugs

### Takeaway
Chrome on Android implements the full Image Capture constraint set through Camera2: `focusMode` (continuous / single-shot / manual), `focusDistance`, `pointsOfInterest` (one point, used for AF/AE/AWB regions = tap-to-focus), `exposureMode`, `exposureCompensation`, `zoom` (digital crop), `torch`. Chrome does not filter cameras: every Camera2 ID becomes a `videoinput`, and `facingMode: 'environment'` can land on an ultra-wide or a fixed-focus lens on some phones. Robust scanners enumerate back cameras and prefer the one with `focusMode` 'continuous' in `getCapabilities()`, usually the lowest-index back camera ("camera2 0, facing back").

### Cited Findings
- **Chromium source, `VideoCaptureCamera2.java` (main):**
  - Continuous: `if (mFocusMode == AndroidMeteringMode.CONTINUOUS)` → `CONTROL_AF_MODE_CONTINUOUS_PICTURE` (not CONTINUOUS_VIDEO).
  - Manual: `CONTROL_AF_MODE_OFF` and `LENS_FOCUS_DISTANCE = 1 / mCurrentFocusDistance`.
  - Single-shot is listed when the camera has `CONTROL_AF_MODE_AUTO` or `CONTROL_AF_MODE_MACRO`; "dealt with independently since it needs to be triggered by a capture".
  - Minimum focus distance from `LENS_INFO_MINIMUM_FOCUS_DISTANCE`.
  - `pointsOfInterest`: supported if `CONTROL_MAX_REGIONS_AF > 0`; a region of 1/8 of the visible rect around the point is set as `CONTROL_AF_REGIONS`, `CONTROL_AE_REGIONS` and `CONTROL_AWB_REGIONS`; "Only 1 point of interest supported".
  - Zoom: `SCALER_CROP_REGION` crop clamped to `SCALER_AVAILABLE_MAX_DIGITAL_ZOOM` (not `CONTROL_ZOOM_RATIO`).
  - Torch: `FLASH_MODE_TORCH`.
  - Enumeration: every ID from `CameraManager.getCameraIdList()` is used; labels are built from the index and "facing back/front/external"; no logical/physical multi-camera handling or ultra-wide detection.
  — [Chromium VideoCaptureCamera2.java](https://github.com/chromium/chromium/blob/main/media/capture/video/android/java/src/org/chromium/media/VideoCaptureCamera2.java)
- Chrome's Image Capture (zoom, torch, white balance via `getCapabilities()`/`applyConstraints()`; `takePhoto()`) has been in Chrome 59 on Android and desktop — [Chrome for Developers: Image Capture](https://developer.chrome.com/blog/imagecapture)
- Dynamsoft (updated Jul 2026): `focusMode` (continuous, manual) and `focusDistance` work in Chrome on Android; not on desktop Chrome or iOS Safari; focus distance is in metres and the range is device-specific, read it from `getCapabilities()` — [Dynamsoft focus article](https://www.dynamsoft.com/codepool/camera-focus-control-on-web.html). Example: `track.applyConstraints({ advanced: [{ focusMode: "manual", focusDistance: d }] })`.
- Old Chromium issue 343894 "Enable focus within getUserMedia()" (2014): Android capture first had no autofocus; a 2014 commit set continuous focus "where supported" — [Chromium issue 343894](https://groups.google.com/a/chromium.org/g/chromium-bugs/c/B0zQ7Vcc5X8)
- **Wrong lens with `facingMode` (field reports):**
  - "Kept asks only for facingMode: 'environment', so the browser picks the lens. On some phones that is the ultra-wide one, which can't focus close enough for a small label." — [kept issue #486](https://github.com/keptinventory/kept/issues/486)
  - Fix: open the plain main back lens by `deviceId`, skip labels that mention wide/ultra/macro/tele/depth, fall back to `facingMode` — [LabAlert PR #20](https://github.com/Kung54150/LabAlert/pull/20)
  - Fix: on Android switch once to the lowest-numbered plain back camera (labels like "camera2 0, facing back"); clear the saved ID if that camera errors — [bindarr PR #100](https://github.com/thenotoriousJeremy/bindarr/pull/100)
  - Fix: request `focusMode: 'continuous'` and swap a rear lens without autofocus ("some phones hand the browser a fixed-focus lens first") for one with it; add tap-to-focus — [Cellarion PR #1483](https://github.com/jagduvi1/Cellarion/pull/1483)
  - "the default camera for getUserMedia is probably not the 'primary', and may lack focus feature" — [HackMD note](https://hackmd.io/HLhilBeuQhSoKEoJj-XPLA)
- **Known focus failures:** Samsung devices on Android 10+: autofocus and zoom do not work even with `focusMode: "continuous"` (forum report, no fix given) — [Samsung Developer Forum](https://forum.developer.samsung.com/t/camera-auto-focus-and-zoom-camera-not-working-in-the-web-application/27908)
- STRICH 1.3.1 (2023-10-14) added an option to toggle "the autofocus that occurs when tapping on the overlay" (tap-to-focus in a web SDK) — [STRICH changelog](https://docs.strich.io/CHANGELOG.md)

### Inferences
- Because Chrome zoom is a `SCALER_CROP_REGION` crop, `zoom` on Android is digital only; it does not trigger a lens switch on logical multi-cameras. It still helps the user keep focus distance, and the crop is taken from the full sensor stream.
- Recommended Android selection: after permission, list `videoinput`s; for each back camera (label contains "back", or `getCapabilities().facingMode` includes 'environment'), open it briefly and read `getCapabilities()`. Prefer: has `focusMode` including 'continuous'; then lowest Camera2 index ("camera2 0"). Avoid labels with "wide"/"ultra"/"tele"/"depth"/"macro" only if labels carry such words (many devices do not). Cache the chosen `deviceId`, with a fallback to label because IDs can change (STRICH does the same).
- Tap-to-focus on Android: map tap position to normalized [0..1] video coordinates and call `track.applyConstraints({ advanced: [{ pointsOfInterest: [{ x, y }], focusMode: 'single-shot' }] })`, then return to 'continuous'. This follows from the Chromium code above; Chromium also uses the same point for exposure, which helps with glossy packages.
- If continuous focus "hunts" at close range, a fixed manual focus near `focusDistance.min` (or a short distance such as 0.1-0.15 m) is a valid option on devices that report `focusMode: ['manual']`. Scanbot's native SDK documents a "short focus distance" mode for small codes for the same reason — [Scanbot scanning modes](https://docs.scanbot.io/ios/barcode-scanner-sdk/custom-ui/scanning-modes/) (native iOS doc, not web).

### Gaps
- No official Chrome documentation of how `facingMode: 'environment'` selects among several back cameras was found; evidence is field reports plus the Chromium enumeration code.
- No current Chromium bug-tracker entry about continuous AF failing on specific devices was found (the search returned only the 2014 issue and forum posts).
- Whether Chrome exposes physical sub-cameras of a logical multi-camera on Pixel/Samsung (vs only the logical ID) was not confirmed.

---

## 4. Resolution trade-offs (720p vs 1080p vs 4K) and SDK defaults

### Takeaway
Vendors default to 720p on phones: STRICH 720p ("usually enough"), Dynamsoft Camera Enhancer 1280x720 on phones/tablets and 1920x1080 on desktop. They move to 1080p only for dense or long codes or longer scan distance. Higher resolution costs CPU per frame. It does not fix out-of-focus images: blur from the lens being closer than its minimum focus distance stays at any resolution.

### Cited Findings
- STRICH `FrameSourceConfiguration.resolution`: `"hd" | "full-hd" | "auto"`, default `hd`: "The default resolution is 720p, which is usually enough for good quality barcodes." Higher resolutions help very fine or degraded codes but have "higher computational requirements" — [STRICH FrameSourceConfiguration](https://docs.strich.io/reference/interfaces/FrameSourceConfiguration.html)
- STRICH KB: barcodes must be sharp; slight blur still works but lowers reliability; blur usually comes from poor autofocus or obstructions; for dense codes (long Code 128/ITF, long QR) increase to Full-HD, which also extends scanning distance — [STRICH KB: unreadable barcodes](https://kb.strich.io/article/15-unreadable-barcodes)
- Dynamsoft Camera Enhancer v4.0 API reference: default 1920x1080, "1280x720 on mobile phones and pad devices"; if the requested resolution is not supported, the closest one is used — [Dynamsoft camera control v4.0.0](https://www.dynamsoft.com/camera-enhancer/docs-archive/web/programming/javascript/api-reference/camera-control-v4.0.0.html)
- Dynamsoft Barcode Reader 9.2.11 (July 2022) changed the **desktop** default from 1280x720 to 1920x1080 — [ComponentSource release note](https://www.componentsource.com/product/barcode-reader/releases/2723081)
- Dynamsoft batch scanner docs: "3840x2160: Read-Rate first. 1920x1080: Speed first." — [Dynamsoft batch scanner camera settings](https://www.dynamsoft.com/batch-barcode-scanner/docs/parameters/camera-and-ui-settings.md)
- html5-qrcode #820: without constraints the stream was blurrier and lower resolution; at 1920x1080 close codes were still too blurry (focus, not pixels, was the limit) — [html5-qrcode #820](https://github.com/mebjas/html5-qrcode/issues/820)
- WebKit commit "Prefer videoBinned camera presets in case resizing is needed" (2024-06-14) shows iOS picks binned (lower-noise, lower-res) sensor modes when resizing — [WebKit commit 3664d7d244](https://github.com/WebKit/WebKit/commit/3664d7d244)

### Inferences
- For EAN-13/UPC-A grocery codes (low density), 720p is enough if the code fills about half the frame width. 1080p helps when the user must hold the phone further away (iPhone Pro wide lens, or with digital zoom), because each bar gets more pixels.
- 4K is not useful for live scanning in the browser: larger frames cost more to copy and decode per frame, and the frame rate can drop, which increases motion-blur sensitivity. The developer's current `ideal: 1920x1080` is a reasonable value; decode a centre crop (scan box) rather than the full frame to keep cost low.
- Resolution cannot fix focus. Fix the lens choice and distance first (sections 1-3).

### Gaps
- Scanbot Web SDK default resolution and camera-selection logic were not found in public docs.
- No benchmark comparing 720p/1080p/4K decode rate for 1D codes in browsers was found.

---

## 5. Fallback: `<input type="file" accept="image/*" capture="environment">`

### Takeaway
A file input with `capture="environment"` opens the OS camera UI. On iPhone that is Apple's camera stack, which does its own lens switching (macro on Pro models) and autofocus. It is a viable "Take photo" fallback when live scanning fails. Cost: it is not live (shoot, confirm, decode), it needs a still-image decoder, and on desktop it is only a file picker.

### Cited Findings
- `capture` applies to `<input type="file">` with `accept`; `environment` = "The outward-facing camera and/or microphone should be used"; on mobile the browser shows a UI to pick an existing file or create a new one; on desktop you will likely get a typical file picker; marked "Limited availability", not Baseline — [MDN: HTML capture attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture)
- The iPhone 13/14 Pro Camera app switches to ultra-wide for close objects (helpful for barcodes), seen in the viewfinder at about 10 cm — [WebKit bug 253186](https://bugs.webkit.org/show_bug.cgi?id=253186)
- Safari 17.0 fixed "camera RAW files picked via file input getting returned as PNG on change" (shows file-input camera photos pass through format conversion) — [WebKit Features in Safari 17.0](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/)

### Inferences
- Pros: native autofocus, macro lens switching, image stabilisation and full-resolution still; no camera-permission prompt in the PWA; works the same in a home-screen PWA; very small code. A still has no motion blur from a moving preview.
- Cons: 3-4 taps per scan (open, shoot, "Use Photo"); no live feedback on whether the code is readable; the user may shoot too far or at an angle; large images (12-48 MP) must be downscaled before decoding; the decoder must work on still images (Android: `BarcodeDetector.detect(imageBitmap)`; iOS: a JS/WASM decoder such as ZXing on a canvas).
- Good pattern: keep live scanning as the main path and add a "Take a photo instead" button after N seconds without a result, or on iOS Pro models when the live path fails.

### Gaps
- No source was found that documents whether iOS Safari opens the camera directly or shows a chooser for `capture="environment"` in iOS 26, and whether the native camera keeps macro auto-switching in this mode.
- No measured success-rate comparison between live scanning and photo capture.

---

## 6. ImageCapture API (takePhoto / grabFrame) support

### Takeaway
Chrome (Android and desktop) has had `ImageCapture` since 59/60. Safari added `ImageCapture` with `takePhoto`, `getPhotoCapabilities` and `getPhotoSettings` in 18.4, and `grabFrame` in Safari 26. Firefox supports it only behind a flag. On iOS, `takePhoto()` can return a full-resolution still from the live stream; this is a possible middle path between live scanning and the file-input fallback.

### Cited Findings
- MDN browser-compat-data: `ImageCapture` Chrome 59, Chrome Android 59, Safari 18.4, Safari iOS 18.4, Firefox 35 (pref `dom.imagecapture.enabled`); `takePhoto` Chrome 60, Safari/iOS 18.4; `grabFrame` Chrome 59, Safari/iOS **26**, Firefox not supported; `getPhotoCapabilities` Chrome 59, Safari 18.4; `getPhotoSettings` Chrome 61, Safari 18.4 — [MDN BCD ImageCapture.json](https://github.com/mdn/browser-compat-data/blob/main/api/ImageCapture.json)
- Safari 18.4 release notes list the Image Capture API — [WebKit Features in Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)
- WebKit "[MediaStream] Add support for ImageCapture.takePhoto" (2023-11-13) — [WebKit commit 6b87ac816d](https://github.com/WebKit/WebKit/commit/6b87ac816d); 2026-04-28: "ImageCapture: queue takePhoto() and applyConstraints() to avoid concurrent capture session reconfiguration" (still active bug fixing in 2026) — [WebKit commit 253f33f069](https://github.com/WebKit/WebKit/commit/253f33f069)
- WebKit maps `fillLightMode` to AVCapture flash mode for photos on iOS (`toAVCaptureFlashMode()`, `photoConfiguration()`) — [AVVideoCaptureSource.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/mediastream/cocoa/AVVideoCaptureSource.mm)
- Chrome docs: `takePhoto()` uses non-live settings (`imageWidth`, `imageHeight`, red-eye reduction, `fillLightMode`); available in Chrome 59 on Android and desktop; `getPhotoSettings()` from Chrome 61 — [Chrome for Developers: Image Capture](https://developer.chrome.com/blog/imagecapture)

### Inferences
- `grabFrame()` gives no sharper image than drawing the `<video>` to a canvas; its value is convenience (an `ImageBitmap`). `takePhoto()` can give a higher-resolution still than the video stream, which may help when the user holds the phone further away. On iOS, `takePhoto()` reconfigures the capture session, so it can pause the preview; use it as an occasional "high-res attempt", not every frame. Not tested.
- Feature-detect with `'ImageCapture' in window` and `typeof ImageCapture.prototype.grabFrame === 'function'`.

### Gaps
- No source measured `takePhoto()` latency or resolution on iPhone, or whether it triggers a focus pass first.

---

## 7. Open-source / public code and vendor evidence for best back-camera selection and macro handling

### Takeaway
No popular open-source web scanner library was found that ships the "pick Back Triple/Dual Wide Camera on iOS" logic as a documented feature; the clearest public evidence is the STRICH changelog (commercial) and WebKit bug threads. Small open-source PWAs show the Android pattern (enumerate, prefer the lowest-index back camera with continuous AF, cache the ID). html5-qrcode issues document the iPhone Pro blur without a library fix.

### Cited Findings
- STRICH: default "Back Dual Wide Camera" on multi-camera iPhones (1.4.3, 2024-02-12); `constraints` override for camera selection (1.4.2); camera selector callback (1.12.2); remember camera with label fallback (1.3.0, 1.9.1); tap-to-focus toggle (1.3.1); zoom overlay and `setZoom()` (1.11.0, 1.12.0); flashlight on iOS (1.4.6) — [STRICH changelog](https://docs.strich.io/CHANGELOG.md)
- Android selection code patterns: [LabAlert PR #20](https://github.com/Kung54150/LabAlert/pull/20) (main rear lens by `deviceId`, skip wide/ultra/macro/tele/depth labels, continuous focus); [bindarr PR #100](https://github.com/thenotoriousJeremy/bindarr/pull/100) (lowest-numbered "camera2 N, facing back", clear saved ID on error); [Cellarion PR #1483](https://github.com/jagduvi1/Cellarion/pull/1483) (autofocus + tap-to-focus, swap fixed-focus lens); [kindee PR #3](https://github.com/SirisakUnknowss/kindee/pull/3) (request `focusMode: 'continuous'`, apply via `applyConstraints` when the capability exists)
- iOS native pattern (for reference): prefer triple → dual-wide → dual → wide, plus tap-to-focus — [fud-ai PR #421](https://github.com/apoorvdarshan/fud-ai/pull/421)
- html5-qrcode iPhone close-focus issues: [#820](https://github.com/mebjas/html5-qrcode/issues/820), [#251](https://github.com/mebjas/html5-qrcode/issues/251) (zoom added in 2.3.2)
- vue-qrcode-reader exposes a camera list on the camera-on event and has a select-camera demo; README notes torch unsupported on iOS as of 17.1 — [vue-qrcode-reader README](https://unpkg.com/vue-qrcode-reader@5.7.2/README.md)
- Dynamsoft tutorials with code for manual focus and zoom (Android Chrome) — [Dynamsoft focus](https://www.dynamsoft.com/codepool/camera-focus-control-on-web.html); [Dynamsoft zoom](https://www.dynamsoft.com/codepool/camera-zoom-control-on-web.html)

### Inferences
- Sketch of a selection routine that combines the evidence above (not tested; derived from the cited sources):
  ```ts
  // 1. Get permission once so labels are filled.
  const tmp = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
  tmp.getTracks().forEach(t => t.stop());
  const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');

  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let pick: MediaDeviceInfo | undefined;
  if (isIOS) {
    // Virtual devices do macro lens switching. Labels are localized: extend this list or use the zoom.min probe.
    pick = cams.find(c => /triple/i.test(c.label)) ?? cams.find(c => /dual wide/i.test(c.label))
        ?? cams.find(c => /^back camera$/i.test(c.label));
  } else {
    // Android: lowest Camera2 index among back cameras, then check focus capability after opening.
    pick = cams.filter(c => /back/i.test(c.label))
               .sort((a, b) => (+(a.label.match(/\d+/)?.[0] ?? 99)) - (+(b.label.match(/\d+/)?.[0] ?? 99)))[0];
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: pick ? { deviceId: { exact: pick.deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
                : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  });
  const track = stream.getVideoTracks()[0];
  const caps: any = track.getCapabilities?.() ?? {};
  const adv: any = {};
  if (caps.focusMode?.includes('continuous')) adv.focusMode = 'continuous';      // Android only
  // iOS plain wide lens: min focus distance is large -> zoom 2 so the user holds the phone further away
  if (isIOS && caps.zoom && caps.zoom.min >= 1 && caps.focusDistance?.min > 0.12 && caps.zoom.max >= 2) adv.zoom = 2;
  if (Object.keys(adv).length) await track.applyConstraints({ advanced: [adv] });
  // Android: if caps.focusMode lacks 'continuous', try the next back camera.
  ```
- The developer's current iOS path (html5-qrcode + `facingMode` only) is the most likely cause of blur on iPhone Pro. Moving iOS to the same `getUserMedia` path as Android with explicit `deviceId` selection should help most. Note: html5-qrcode accepts a `deviceId` string as camera config, but this was not verified in this research.

### Gaps
- No zxing-js or @yudiel/react-qr-scanner source or issue with explicit iOS virtual-camera selection was found within the search budget.
- No Scandit or Scanbot web-SDK blog post on iPhone minimum focus distance was found; the Scanbot evidence is from its native iOS changelog.
