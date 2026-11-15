// Opens the back camera with autofocus for the native scanner.
// Phones with more than one back camera do not always give the main one for
// `facingMode: environment`. A Samsung phone gave "camera 2", a lens without autofocus, so every
// close barcode was blurred. Android numbers the main back camera 0, so after a camera without
// autofocus, try the other back cameras from the lowest number. Keep the ID of the camera that
// works, so the next scan opens it directly.

const CAMERA_KEY = 'scanCameraId'

function savedCameraId(): string | null {
  try {
    return localStorage.getItem(CAMERA_KEY)
  } catch {
    return null
  }
}

function saveCameraId(id: string | null | undefined) {
  try {
    if (id) localStorage.setItem(CAMERA_KEY, id)
    else localStorage.removeItem(CAMERA_KEY)
  } catch {
    /* ignore */
  }
}

function openCamera(camera: MediaTrackConstraints): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    // `ideal`, not `exact`, so a low-resolution camera still opens. A higher resolution makes
    // small barcodes sharper.
    video: { ...camera, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  })
}

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((t) => t.stop())
}

function hasAutofocus(stream: MediaStream): boolean {
  const modes = stream.getVideoTracks()[0]?.getCapabilities?.().focusMode
  return Array.isArray(modes) && modes.includes('continuous')
}

/** Chrome on Android labels cameras "camera 0, facing back" (older: "camera2 0, facing back"). */
function cameraNumber(label: string): number {
  const match = /camera2? (\d+)/.exec(label)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

export async function openScanCamera(): Promise<MediaStream> {
  const saved = savedCameraId()
  if (saved) {
    try {
      return await openCamera({ deviceId: { exact: saved } })
    } catch {
      saveCameraId(null) // The camera is gone or the ID changed.
    }
  }

  const first = await openCamera({ facingMode: { ideal: 'environment' } })
  const firstId = first.getVideoTracks()[0]?.getSettings().deviceId
  if (hasAutofocus(first)) {
    saveCameraId(firstId)
    return first
  }

  // The labels are available now, because the user gave camera permission.
  let others: MediaDeviceInfo[] = []
  try {
    others = (await navigator.mediaDevices.enumerateDevices())
      .filter((d) => d.kind === 'videoinput' && d.deviceId !== firstId && /back|rear|environment/i.test(d.label))
      .sort((a, b) => cameraNumber(a.label) - cameraNumber(b.label))
  } catch {
    /* keep the first camera */
  }
  if (others.length === 0) return first

  // Many phones cannot open two cameras at the same time.
  stopStream(first)
  for (const device of others) {
    try {
      const stream = await openCamera({ deviceId: { exact: device.deviceId } })
      if (hasAutofocus(stream)) {
        saveCameraId(device.deviceId)
        return stream
      }
      stopStream(stream)
    } catch {
      /* try the next camera */
    }
  }

  // No back camera has autofocus: open the first camera again.
  return openCamera(firstId ? { deviceId: { exact: firstId } } : { facingMode: { ideal: 'environment' } })
}
