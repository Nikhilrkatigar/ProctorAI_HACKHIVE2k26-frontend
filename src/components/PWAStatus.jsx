import { useState, useEffect } from 'react'
import { Wifi, WifiOff } from 'lucide-react'

export default function PWAStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isPWAInstalled, setIsPWAInstalled] = useState(false)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check if PWA is installed
    const isStandalone = window.navigator.standalone === true || 
                         window.matchMedia('(display-mode: standalone)').matches
    setIsPWAInstalled(isStandalone)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:right-auto md:left-4 z-50 bg-amber-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 max-w-sm">
      <WifiOff size={18} />
      <span className="text-sm font-medium">Offline mode — Limited functionality</span>
    </div>
  )
}
