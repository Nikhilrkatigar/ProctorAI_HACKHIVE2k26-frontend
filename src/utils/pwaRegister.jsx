import toast from 'react-hot-toast'

/**
 * Check for PWA installation prompt and app-installed events.
 * The service worker is registered automatically by vite-plugin-pwa.
 */
export function checkPWAInstallation() {
  let deferredPrompt

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferredPrompt = e
    showInstallPrompt(deferredPrompt)
  })

  window.addEventListener('appinstalled', () => {
    toast.success('ProctorAI installed successfully!', {
      icon: '📱',
      duration: 3000,
    })
    deferredPrompt = null
  })

  return deferredPrompt
}

function showInstallPrompt(deferredPrompt) {
  if (!deferredPrompt) return

  toast.custom(t => (
    <div className="bg-indigo-600 text-white px-6 py-4 rounded-lg shadow-lg max-w-md">
      <p className="font-semibold mb-3">Install ProctorAI</p>
      <p className="text-sm mb-4 opacity-90">Get offline access and app-like experience.</p>
      <div className="flex gap-2">
        <button
          onClick={async () => {
            deferredPrompt.prompt()
            const { outcome } = await deferredPrompt.userChoice
            console.log(`[PWA] User install response: ${outcome}`)
            toast.dismiss(t.id)
          }}
          className="flex-1 bg-white text-indigo-600 px-4 py-2 rounded font-semibold text-sm hover:bg-gray-50 transition"
        >
          Install
        </button>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="flex-1 bg-indigo-700 px-4 py-2 rounded font-semibold text-sm hover:bg-indigo-800 transition"
        >
          Not Now
        </button>
      </div>
    </div>
  ), {
    duration: Infinity,
    position: 'top-center',
  })
}

export function isPWAInstalled() {
  if (window.navigator.standalone === true) {
    return true
  }
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true
  }
  return false
}

export function getDisplayMode() {
  const isStandalone = window.navigator.standalone === true
  if (document.referrer.startsWith('android-app://')) {
    return 'twa'
  }
  if (isStandalone || window.matchMedia('(display-mode: standalone)').matches) {
    return 'standalone'
  }
  return 'browser'
}
