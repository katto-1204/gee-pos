import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, FormEvent, ReactNode } from 'react'
import {
  ArrowRightIcon, ArrowUpIcon, BanknoteIcon, BluetoothIcon, ChartIcon, CheckIcon, ChevronDownIcon,
  ClipboardIcon, CreditCardIcon, DownloadIcon, EditIcon, FilterIcon, HomeIcon,
  MinusIcon, MoonIcon, MoreIcon, PackageIcon, PlusIcon, PrinterIcon,
  ReceiptIcon, ScanIcon, SearchIcon, SendIcon, SettingsIcon, SparkIcon, SunIcon, TrashIcon,
  UserPlusIcon, UsersIcon, WalletIcon, XIcon,
} from './icons'
import {
  CATEGORY_LABELS, dateOnly, dateTime, defaultSettings, money, seedCustomers, seedOrders, seedPaymentMethods,
  seedProducts, SHIRT_SIZES,
} from './data'
import type { AuditLog, CartLine, Customer, OnlinePaymentDetails, Order, PaymentMethod, Product, ProductCategory, ProductKind, Settings } from './data'
import {
  clearReceiptImages, deleteReceiptImage, exportReceiptImages, importReceiptImages,
  loadReceiptImageUrl, loadRecordBackup, saveReceiptImage, saveRecordBackup,
} from './receiptDb'

type Page = 'home' | 'products' | 'orders' | 'customers' | 'reports' | 'settings'
type CategoryFilter = ProductCategory | 'all'
type Receipt = Order & { isDraft?: boolean; justPaid?: boolean; successShown?: boolean; printedOnce?: boolean }
type BtPrinterState = {
  name: string
  connected: boolean
  sendBytes?: (data: Uint8Array) => Promise<void>
  disconnect?: () => void
}

const BT_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000af30-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000fee0-0000-1000-8000-00805f9b34fb',
  '0000fee8-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
]

const SYSTEM_GATT_SERVICES = new Set([
  '00001800-0000-1000-8000-00805f9b34fb',
  '00001801-0000-1000-8000-00805f9b34fb',
  '0000180a-0000-1000-8000-00805f9b34fb',
  '0000180f-0000-1000-8000-00805f9b34fb',
])

function playPaymentSuccessSound() {
  try {
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    const notes = [880, 1174.66, 1567.98]
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.075)
      gain.gain.setValueAtTime(0.0001, now + idx * 0.075)
      gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.075 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.075 + 0.28)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + idx * 0.075)
      osc.stop(now + idx * 0.075 + 0.3)
    })
    window.setTimeout(() => { void ctx.close().catch(() => { }) }, 700)
  } catch {
    // Ignore audio errors when autoplay is blocked or unavailable
  }
}

async function buildEscPosLogo(src: string, maxWidth = 240): Promise<Uint8Array[]> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.crossOrigin = 'anonymous'
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Logo load failed'))
      el.src = src
    })
    const width = Math.min(maxWidth, Math.floor((img.naturalWidth || maxWidth) / 8) * 8) || 240
    const height = Math.max(16, Math.round((img.naturalHeight / Math.max(img.naturalWidth, 1)) * width))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return []
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    const { data } = ctx.getImageData(0, 0, width, height)
    const widthBytes = width / 8
    const bandHeight = 16
    const bands: Uint8Array[] = [new Uint8Array([0x1b, 0x61, 0x01, 0x1b, 0x33, 0x00])] // Center + 0 line spacing between bands

    for (let startY = 0; startY < height; startY += bandHeight) {
      const rows = Math.min(bandHeight, height - startY)
      const raster = new Uint8Array(widthBytes * rows)
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < width; x++) {
          const idx = ((startY + y) * width + x) * 4
          const lum = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
          if (lum < 160) {
            raster[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7)
          }
        }
      }
      const header = new Uint8Array([
        0x1d, 0x76, 0x30, 0x00, // GS v 0 normal raster
        widthBytes & 0xff, (widthBytes >> 8) & 0xff,
        rows & 0xff, (rows >> 8) & 0xff,
      ])
      const band = new Uint8Array(header.length + raster.length)
      band.set(header, 0)
      band.set(raster, header.length)
      bands.push(band)
    }
    bands.push(new Uint8Array([0x1b, 0x32, 0x0a])) // Reset default line spacing + newline
    return bands
  } catch {
    return []
  }
}

function wrapEscPosText(text: string, width = 32): string {
  return text.split('\n').map((paragraph) => {
    const words = paragraph.trim().split(/\s+/)
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      if (!line) {
        line = word
      } else if (line.length + 1 + word.length <= width) {
        line += ` ${word}`
      } else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
    return lines.join('\n')
  }).join('\n')
}

function padEscPosRow(left: string, right: string, width = 32): string {
  const space = Math.max(1, width - left.length - right.length)
  return `${left}${' '.repeat(space)}${right}`
}

async function buildEscPosReceipt(order: Receipt, settings: Settings): Promise<Uint8Array[]> {
  const enc = new TextEncoder()
  const logoBands = await buildEscPosLogo('/icons/gee-logo-black.png')
  const createdAt = new Date(order.createdAt)
  const dateStr = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(createdAt)
  const timeStr = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(createdAt)

  const textChunks: Uint8Array[] = [
    new Uint8Array([0x1b, 0x61, 0x01, 0x1b, 0x45, 0x01]), // Center + Bold
    enc.encode(`${settings.storeName.toUpperCase()}\n`),
    new Uint8Array([0x1b, 0x45, 0x00]),
    enc.encode(`${order.isDraft ? 'SAMPLE / UNPAID COPY' : 'OFFICIAL SALES RECEIPT'}\n`),
    enc.encode('================================\n'),
    new Uint8Array([0x1b, 0x61, 0x00]), // Left align
    enc.encode(`${padEscPosRow('Receipt:', order.number)}\n`),
    enc.encode(`${padEscPosRow('Date:', `${dateStr} ${timeStr}`)}\n`),
    enc.encode('--------------------------------\n'),
    ...order.items.map((item) => enc.encode(
      `${item.productName}${item.size ? ` [${item.size}]` : ''}\n${padEscPosRow(`  ${item.quantity} x PHP ${item.price.toFixed(2)}`, `PHP ${(item.price * item.quantity).toFixed(2)}`)}\n`,
    )),
    enc.encode('--------------------------------\n'),
    enc.encode(`${padEscPosRow('Subtotal', `PHP ${order.subtotal.toFixed(2)}`)}\n`),
    enc.encode(`${padEscPosRow('Tax', `PHP ${order.tax.toFixed(2)}`)}\n`),
    enc.encode('================================\n'),
    new Uint8Array([0x1b, 0x45, 0x01, 0x1d, 0x21, 0x01]), // Bold + double height
    enc.encode(`${padEscPosRow('TOTAL', `PHP ${order.total.toFixed(2)}`)}\n`),
    new Uint8Array([0x1d, 0x21, 0x00, 0x1b, 0x45, 0x00]),
    enc.encode(`${padEscPosRow('Payment', order.onlinePayment ? `${order.paymentMethod} (${order.onlinePayment.provider})` : order.paymentMethod)}\n`),
    enc.encode('--------------------------------\n'),
    new Uint8Array([0x1b, 0x61, 0x01]), // Center
    enc.encode(`${wrapEscPosText(settings.receiptFooter, 32)}\n`),
    new Uint8Array([0x1b, 0x45, 0x01]),
    enc.encode('*** THANK YOU FOR SHOPPING ***\n\n\n\n'),
    new Uint8Array([0x1d, 0x56, 0x42, 0x00]), // Paper cut
  ]

  const totalLen = textChunks.reduce((sum, c) => sum + c.length, 0)
  const textBody = new Uint8Array(totalLen)
  let offset = 0
  for (const chunk of textChunks) {
    textBody.set(chunk, offset)
    offset += chunk.length
  }
  return [new Uint8Array([0x1b, 0x40]), ...logoBands, textBody]
}

const STORAGE = {
  products: 'gg-products-v3',
  cart: 'gg-cart-v1',
  customers: 'gg-customers-v1',
  orders: 'gg-orders-v1',
  settings: 'gg-settings-v2',
  paymentMethods: 'gg-payment-methods-v1',
  auditLogs: 'gg-audit-logs-v1',
}

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback

    const parsed = JSON.parse(raw) as Partial<T>
    if (parsed && typeof parsed === 'object' && typeof fallback === 'object' && fallback !== null && !Array.isArray(parsed) && !Array.isArray(fallback)) {
      return { ...fallback, ...parsed } as T
    }

    return parsed as T
  } catch {
    return fallback
  }
}

function hasStoredKey(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== null
  } catch {
    return false
  }
}

function useStored<T>(key: string, fallback: T) {
  const hadLocalOnMount = useRef(hasStoredKey(key))
  const hydratedFromIdb = useRef(hadLocalOnMount.current)
  const [value, setValue] = useState<T>(() => loadStored(key, fallback))

  useEffect(() => {
    if (hadLocalOnMount.current) return
    let active = true
    void loadRecordBackup<T>(key).then((backup) => {
      hydratedFromIdb.current = true
      if (!active || backup === undefined) return
      if (backup && typeof backup === 'object' && typeof fallback === 'object' && fallback !== null && !Array.isArray(backup) && !Array.isArray(fallback)) {
        setValue({ ...fallback, ...backup })
      } else {
        setValue(backup)
      }
    })
    return () => { active = false }
  }, [key])

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // localStorage may be full or unavailable; IndexedDB backup still persists below
    }
    if (hydratedFromIdb.current) {
      void saveRecordBackup(key, value)
    }
  }, [key, value])

  return [value, setValue] as const
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function distributeStock(total: number): Record<string, number> {
  const sizeStock = Object.fromEntries(SHIRT_SIZES.map((size) => [size, 0]))
  const standardSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL']
  let remaining = Math.max(0, total)
  standardSizes.forEach((size, index) => {
    const allocation = Math.ceil(remaining / (standardSizes.length - index))
    sizeStock[size] = Math.min(remaining, allocation)
    remaining -= sizeStock[size]
  })
  return sizeStock
}

function normalizeProductStock(product: Product): Product {
  const stock = Math.max(0, Math.floor(Number.isFinite(product.stock) ? product.stock : 0))
  if (product.category !== 'shirts') return product.stock === stock ? product : { ...product, stock }
  const sizeStock = product.sizeStock
  const validSizeStock = sizeStock && SHIRT_SIZES.every((size) => Number.isFinite(sizeStock[size]) && sizeStock[size] >= 0 && Number.isInteger(sizeStock[size]))
  const sizeTotal = validSizeStock ? SHIRT_SIZES.reduce((sum, size) => sum + sizeStock[size], 0) : -1
  return validSizeStock && sizeTotal === stock ? { ...product, stock } : { ...product, stock, sizeStock: distributeStock(stock) }
}

function getSizeStock(product: Product): Record<string, number> {
  const normalized = normalizeProductStock(product)
  return normalized.sizeStock ?? {}
}

function App() {
  const [page, setPage] = useState<Page>('home')
  const [products, setProducts] = useStored<Product[]>(STORAGE.products, seedProducts)
  const [cart, setCart] = useStored<CartLine[]>(STORAGE.cart, [])
  const [customers, setCustomers] = useStored<Customer[]>(STORAGE.customers, seedCustomers)
  const [orders, setOrders] = useStored<Order[]>(STORAGE.orders, seedOrders)
  const [settings, setSettings] = useStored<Settings>(STORAGE.settings, defaultSettings)
  const [paymentMethods, setPaymentMethods] = useStored<string[]>(STORAGE.paymentMethods, seedPaymentMethods)
  const [auditLogs, setAuditLogs] = useStored<AuditLog[]>(STORAGE.auditLogs, [])
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')
  const [payment, setPayment] = useState<PaymentMethod>('Cash')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [toast, setToast] = useState<string>('')
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' })
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [sizeProduct, setSizeProduct] = useState<Product | null>(null)
  const [onlinePayment, setOnlinePayment] = useState<OnlinePaymentDetails | undefined>()
  const [showOnlinePayment, setShowOnlinePayment] = useState(false)
  const [btPrinter, setBtPrinter] = useState<BtPrinterState | null>(null)
  const [btPairing, setBtPairing] = useState(false)
  const [btPrinting, setBtPrinting] = useState(false)
  const [btStatus, setBtStatus] = useState('')
  const [showTestPrint, setShowTestPrint] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState<{ number: string; total: number; method: PaymentMethod } | null>(null)
  const importInput = useRef<HTMLInputElement>(null)

  const recordAudit = (action: string, details: string) => {
    setAuditLogs((current) => [{ id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString(), action, details }, ...current].slice(0, 500))
  }

  useEffect(() => {
    const seedById = new Map(seedProducts.map((product) => [product.id, product]))
    const redDragonSeed = seedById.get('p-rd03')
    const cleanCatalog = products
      .filter((product) => product.category === 'shirts')
      .map((product) => {
        if (product.id === 'p-bd03' && redDragonSeed) {
          return normalizeProductStock({ ...redDragonSeed, stock: product.stock, sizeStock: product.sizeStock, price: product.price })
        }
        const seed = seedById.get(product.id)
        const synced = seed && (product.image !== seed.image || product.accent !== seed.accent || product.accent2 !== seed.accent2)
          ? { ...product, image: seed.image, accent: seed.accent, accent2: seed.accent2 }
          : product
        return normalizeProductStock(synced)
      })
    const changed = cleanCatalog.length !== products.length || cleanCatalog.some((product, index) => (
      product.id !== products[index]?.id ||
      product.stock !== products[index]?.stock ||
      product.sizeStock !== products[index]?.sizeStock ||
      product.image !== products[index]?.image ||
      product.accent !== products[index]?.accent ||
      product.accent2 !== products[index]?.accent2
    ))
    if (changed) setProducts(cleanCatalog)
  }, [products, setProducts])

  useEffect(() => {
    const validIds = new Set(products.map((product) => product.id))
    const reserved = new Map<string, number>()
    const cleanCart = cart.flatMap((line) => {
      const product = products.find((item) => item.id === line.productId)
      if (!product || !Number.isInteger(line.quantity) || line.quantity <= 0) return []
      const key = `${line.productId}:${line.size ?? 'one-size'}`
      const available = line.size ? product.sizeStock?.[line.size] ?? 0 : product.stock
      const remaining = Math.max(0, available - (reserved.get(key) ?? 0))
      const quantity = Math.min(line.quantity, remaining)
      if (!quantity) return []
      reserved.set(key, (reserved.get(key) ?? 0) + quantity)
      return [{ ...line, quantity }]
    })
    if (cleanCart.length !== cart.length || cleanCart.some((line, index) => line.quantity !== cart[index]?.quantity)) setCart(cleanCart)
  }, [cart, products, setCart])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!paymentSuccess) return
    const timer = window.setTimeout(() => setPaymentSuccess(null), 2000)
    return () => window.clearTimeout(timer)
  }, [paymentSuccess])

  useEffect(() => {
    document.documentElement.classList.toggle('light-mode', settings.lightMode)
    const themeMeta = document.querySelector('meta[name="theme-color"]')
    if (themeMeta) themeMeta.setAttribute('content', settings.lightMode ? '#f2f3f6' : '#0a0a0b')
  }, [settings.lightMode])

  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => { })
  }, [])

  // Silently reconnect any previously paired Bluetooth COM / USB Serial or BLE printer on load
  useEffect(() => {
    let cancelled = false
    const autoReconnect = async () => {
      const serial = (navigator as Navigator & { serial?: { getPorts?: () => Promise<any[]> } }).serial
      if (serial?.getPorts) {
        try {
          const ports = await serial.getPorts()
          const port = ports[0]
          if (port && !cancelled) {
            if (!port.writable) await port.open({ baudRate: 9600 })
            const sendBytes = async (data: Uint8Array) => {
              const writer = port.writable.getWriter()
              try {
                await writer.write(data)
              } finally {
                writer.releaseLock()
              }
            }
            setBtPrinter({
              name: 'BT / Serial Printer',
              connected: true,
              sendBytes,
              disconnect: () => {
                void port.close?.().catch(() => { })
                setBtPrinter(null)
              },
            })
            return
          }
        } catch {
          // Port may be busy or disconnected; user can reconnect manually
        }
      }

      const bt = (navigator as Navigator & { bluetooth?: { getDevices?: () => Promise<any[]> } }).bluetooth
      if (bt?.getDevices) {
        try {
          const devices = await bt.getDevices()
          for (const device of devices) {
            if (cancelled || !device.gatt) continue
            try {
              const server = await device.gatt.connect()
              const services = typeof server.getPrimaryServices === 'function' ? await server.getPrimaryServices() : []
              let writeChar: any = null
              for (const service of services) {
                if (SYSTEM_GATT_SERVICES.has(String(service.uuid ?? '').toLowerCase())) continue
                const chars = await service.getCharacteristics()
                writeChar = chars.find((c: any) => c.properties?.writeWithoutResponse) ?? chars.find((c: any) => c.properties?.write)
                if (writeChar) break
              }
              if (writeChar && !cancelled) {
                device.addEventListener?.('gattserverdisconnected', () => setBtPrinter(null))
                const sendBytes = async (data: Uint8Array) => {
                  for (let offset = 0; offset < data.length; offset += 20) {
                    const chunk = data.slice(offset, offset + 20)
                    if (writeChar.properties?.writeWithoutResponse && writeChar.writeValueWithoutResponse) {
                      await writeChar.writeValueWithoutResponse(chunk)
                    } else if (writeChar.writeValueWithResponse) {
                      await writeChar.writeValueWithResponse(chunk)
                    } else {
                      await writeChar.writeValue(chunk)
                    }
                    await new Promise((resolve) => window.setTimeout(resolve, 22))
                  }
                }
                setBtPrinter({
                  name: device.name || 'Bluetooth Printer',
                  connected: true,
                  sendBytes,
                  disconnect: () => {
                    device.gatt?.disconnect?.()
                    setBtPrinter(null)
                  },
                })
                return
              }
            } catch {
              // Try next remembered device
            }
          }
        } catch {
          // Ignore if getDevices is unavailable
        }
      }
    }
    void autoReconnect()
    return () => { cancelled = true }
  }, [])

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId)
  const cartDetails = useMemo(() => cart.map((line) => {
    const product = products.find((item) => item.id === line.productId)
    return product ? { ...line, product } : null
  }).filter(Boolean) as Array<CartLine & { product: Product }>, [cart, products])
  const subtotal = cartDetails.reduce((sum, line) => sum + line.product.price * line.quantity, 0)
  const tax = subtotal * (settings.taxRate / 100)
  const total = subtotal + tax
  const filteredProducts = products.filter((product) => {
    const matchesCategory = category === 'all' || product.category === category
    const term = search.toLowerCase().trim()
    const matchesSearch = !term || `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(term)
    return matchesCategory && matchesSearch
  })
  const todayOrders = orders.filter((order) => new Date(order.createdAt).toDateString() === new Date().toDateString())
  const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total, 0)
  const lowStockCount = products.filter((product) => product.stock < 10).length

  const notify = (message: string) => setToast(message)
  const triggerPaymentSuccess = (order: Pick<Order, 'number' | 'total' | 'paymentMethod'>) => {
    setPaymentSuccess({ number: order.number, total: order.total, method: order.paymentMethod })
    if (settings.soundEffects) playPaymentSuccessSound()
  }
  const goTo = (nextPage: Page) => {
    setPage(nextPage)
    setMobileCartOpen(false)
  }

  const addToCart = (productId: string, size?: string) => {
    const product = products.find((item) => item.id === productId)
    if (!product) return
    if (product.category === 'shirts' && !size) {
      setSizeProduct(product)
      return
    }
    const currentQty = cart.filter((line) => line.productId === productId && line.size === size).reduce((sum, line) => sum + line.quantity, 0)
    const available = size ? getSizeStock(product)[size] ?? 0 : product.stock
    if (currentQty >= available) {
      notify(`${product.name}${size ? ` (${size})` : ''} is out of stock`)
      return
    }
    setCart((current) => current.some((line) => line.productId === productId && line.size === size)
      ? current.map((line) => line.productId === productId && line.size === size ? { ...line, quantity: line.quantity + 1 } : line)
      : [...current, { productId, quantity: 1, ...(size ? { size } : {}) }])
    setSizeProduct(null)
    notify(`${product.name} added to tab`)
  }

  const updateQuantity = (productId: string, delta: number, size?: string) => {
    setCart((current) => current.flatMap((line) => {
      if (line.productId !== productId || line.size !== size) return [line]
      const product = products.find((item) => item.id === productId)
      const next = line.quantity + delta
      if (!product || next <= 0) return []
      const available = line.size ? getSizeStock(product)[line.size] ?? 0 : product.stock
      if (next > available) {
        notify(`Only ${available} ${line.size ? `${line.size} size ` : ''}left in stock`)
        return [line]
      }
      return [{ ...line, quantity: next }]
    }))
  }

  const removeFromCart = (productId: string, size?: string) => setCart((current) => current.filter((line) => line.productId !== productId || line.size !== size))

  const previewReceipt = () => {
    if (!cartDetails.length) {
      notify('Add an item before printing the current sale')
      return
    }
    const draft: Receipt = {
      id: 'current-sale', number: 'Current sale', createdAt: new Date().toISOString(), isDraft: true,
      items: cartDetails.map((line) => ({ productId: line.productId, productName: line.product.name, sku: line.product.sku, quantity: line.quantity, price: line.product.price, size: line.size })),
      subtotal, tax, total, paymentMethod: payment,
      onlinePayment: payment === 'Online' ? onlinePayment : undefined,
      customerName: selectedCustomer?.name,
    }
    if (btPrinter?.connected) {
      void sendBluetoothReceipt(draft)
      return
    }
    setReceipt(draft)
  }

  const chargeCustomer = () => {
    if (!cartDetails.length) {
      notify('Add an item before charging the customer')
      return
    }
    if (payment === 'Online' && !onlinePayment?.receiptImage && (!onlinePayment?.accountName.trim() || !onlinePayment.referenceNumber.trim())) {
      setShowOnlinePayment(true)
      notify('Complete the online payment details first')
      return
    }
    const customer = customers.find((item) => item.id === selectedCustomerId)
    const maxOrderNum = orders.reduce((max, item) => {
      const parsed = Number.parseInt(item.number.replace(/\D/g, ''), 10)
      return Number.isFinite(parsed) ? Math.max(max, parsed) : max
    }, 1028)
    const orderNumber = `#${maxOrderNum + 1}`
    const order: Order = {
      id: `o-${Date.now()}`,
      number: orderNumber,
      createdAt: new Date().toISOString(),
      items: cartDetails.map((line) => ({ productId: line.productId, productName: line.product.name, sku: line.product.sku, quantity: line.quantity, price: line.product.price, size: line.size })),
      subtotal,
      tax,
      total,
      paymentMethod: payment,
      onlinePayment: payment === 'Online' ? onlinePayment : undefined,
      customerId: customer?.id,
      customerName: customer?.name,
    }
    setOrders((current) => [order, ...current])
    recordAudit('Sale completed', `${order.number} · ${money(total)} · ${payment}`)
    setProducts((current) => current.map((product) => {
      const soldLines = cart.filter((item) => item.productId === product.id)
      const quantitySold = soldLines.reduce((sum, item) => sum + item.quantity, 0)
      if (!quantitySold) return product
      const sizeStock = product.category === 'shirts' ? { ...getSizeStock(product) } : undefined
      soldLines.forEach((item) => { if (sizeStock && item.size) sizeStock[item.size] = Math.max(0, (sizeStock[item.size] ?? 0) - item.quantity) })
      return { ...product, stock: Math.max(0, product.stock - quantitySold), ...(sizeStock ? { sizeStock } : {}) }
    }))
    if (customer) {
      setCustomers((current) => current.map((item) => item.id === customer.id ? { ...item, orders: item.orders + 1, totalSpent: item.totalSpent + total } : item))
    }
    setCart([])
    setToast('')
    setSelectedCustomerId('')
    setOnlinePayment(undefined)
    if (btPrinter?.connected) {
      setReceipt({ ...order, justPaid: true, successShown: false, printedOnce: false })
      void sendBluetoothReceipt(order).then((ok) => {
        if (ok) {
          setReceipt((current) => current && current.id === order.id ? { ...current, printedOnce: true } : current)
        }
      })
    } else {
      setReceipt({ ...order, justPaid: true, successShown: false, printedOnce: false })
    }
  }

  const addCustomer = (event: FormEvent) => {
    event.preventDefault()
    if (!newCustomer.name.trim()) return
    const customer: Customer = { id: `c-${Date.now()}`, name: newCustomer.name.trim(), email: newCustomer.email.trim() || '—', phone: newCustomer.phone.trim() || '—', orders: 0, totalSpent: 0, joinedAt: new Date().toISOString() }
    setCustomers((current) => [customer, ...current])
    setSelectedCustomerId(customer.id)
    setNewCustomer({ name: '', email: '', phone: '' })
    setShowCustomerForm(false)
    notify(`${customer.name} added to customers`)
    recordAudit('Customer added', customer.name)
  }

  const resetStore = () => {
    if (!window.confirm('Reset the local catalog, orders, and settings to the seeded Gee Graphics demo?')) return
    setProducts(seedProducts)
    setCustomers(seedCustomers)
    setOrders(seedOrders)
    setCart([])
    setPaymentMethods(seedPaymentMethods)
    setSettings(defaultSettings)
    setAuditLogs([])
    recordAudit('POS reset', 'Catalog, records, and settings restored to demo data')
    notify('Local POS data reset')
  }

  const resetInventory = () => {
    if (!window.confirm('Reset all jersey stock back to default (XS–2XL: 2 each, 3XL–5XL: 0)?')) return
    setProducts(seedProducts.map((product) => ({ ...product, sizeStock: product.sizeStock ? { ...product.sizeStock } : undefined })))
    setCart([])
    recordAudit('Inventory reset', 'All 9 jerseys reset to default size stock (XS–2XL: 2 each, 3XL–5XL: 0)')
    notify('Inventory reset to default')
  }

  const clearRecords = () => {
    if (!window.confirm('Clear all orders, customers, and the current cart? This cannot be undone.')) return
    setOrders([])
    setCustomers([])
    setCart([])
    setSelectedCustomerId('')
    setReceipt(null)
    void clearReceiptImages()
    recordAudit('Sales records cleared', 'Orders, customers, and current cart removed')
    notify('Sales records cleared')
  }

  const exportData = async () => {
    const receiptKeys = orders.map((order) => order.onlinePayment?.receiptImage).filter((value): value is string => Boolean(value))
    const receiptImages = await exportReceiptImages(receiptKeys)
    const snapshot = {
      format: 'gee-pos-export',
      version: 2,
      exportedAt: new Date().toISOString(),
      products,
      cart,
      customers,
      orders,
      settings,
      paymentMethods,
      auditLogs,
      receiptImages,
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `gee-pos-export-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    recordAudit('Data exported', `${orders.length} transactions and ${products.length} products`)
    notify('POS data exported')
  }

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const imported = JSON.parse(await file.text()) as Partial<{
        products: Product[]; cart: CartLine[]; customers: Customer[]; orders: Order[]
        settings: Settings; paymentMethods: string[]; auditLogs: AuditLog[]
        receiptImages: Record<string, string>
      }>
      if (!Array.isArray(imported.products) || !Array.isArray(imported.orders) || !Array.isArray(imported.customers) || !imported.settings) throw new Error('Invalid Gee POS export file')
      if (!window.confirm('Replace this POS data with the imported file?')) return
      await importReceiptImages(imported.receiptImages)
      setProducts(imported.products)
      setCart(Array.isArray(imported.cart) ? imported.cart : [])
      setCustomers(imported.customers)
      setOrders(imported.orders)
      setSettings(imported.settings)
      setPaymentMethods(Array.isArray(imported.paymentMethods) ? imported.paymentMethods : seedPaymentMethods)
      setAuditLogs([{ id: `audit-${Date.now()}`, createdAt: new Date().toISOString(), action: 'Data imported', details: `${imported.orders.length} transactions restored from ${file.name}` }, ...(imported.auditLogs ?? [])].slice(0, 500))
      notify('POS data imported')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not import POS data')
    }
  }

  const deleteProduct = (product: Product) => {
    if (!window.confirm(`Delete ${product.name}? This cannot be undone.`)) return
    setProducts((current) => current.filter((item) => item.id !== product.id))
    setCart((current) => current.filter((line) => line.productId !== product.id))
    notify(`${product.name} deleted`)
    recordAudit('Product deleted', product.name)
  }

  const updateSettings = (patch: Partial<Settings>) => setSettings((current) => ({ ...current, ...patch }))

  const pairBluetoothPrinter = async () => {
    const bt = (navigator as Navigator & { bluetooth?: { requestDevice: (opts: unknown) => Promise<any> } }).bluetooth
    if (!bt) {
      const msg = 'Bluetooth pairing requires Chrome or Edge over HTTPS/localhost. Use Manual Print instead.'
      setBtStatus(msg)
      notify('Bluetooth not supported in this browser')
      return
    }
    setBtPairing(true)
    setBtStatus('Scanning for nearby Bluetooth printers...')
    try {
      const device = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: BT_PRINTER_SERVICES,
      })
      const printerName = device.name || 'Bluetooth Printer'
      let writeChar: any = null
      let server: any = null
      if (device.gatt) {
        server = await device.gatt.connect()
        const discoveredServices: any[] = []
        if (typeof server.getPrimaryServices === 'function') {
          try {
            const all = await server.getPrimaryServices()
            discoveredServices.push(...all)
          } catch {
            // Fall back to probing known printer service UUIDs individually
          }
        }
        if (!discoveredServices.length) {
          for (const uuid of BT_PRINTER_SERVICES) {
            try {
              discoveredServices.push(await server.getPrimaryService(uuid))
            } catch {
              // Service not present on this printer
            }
          }
        }
        for (const service of discoveredServices) {
          if (SYSTEM_GATT_SERVICES.has(String(service.uuid ?? '').toLowerCase())) continue
          try {
            const chars = await service.getCharacteristics()
            writeChar = chars.find((c: any) => c.properties?.writeWithoutResponse)
              ?? chars.find((c: any) => c.properties?.write)
            if (writeChar) break
          } catch {
            // Try next service
          }
        }
      }
      device.addEventListener?.('gattserverdisconnected', () => {
        setBtPrinter(null)
        setBtStatus('Bluetooth printer disconnected.')
      })
      const sendBytes = writeChar ? async (data: Uint8Array) => {
        const chunkSize = 20
        for (let offset = 0; offset < data.length; offset += chunkSize) {
          const chunk = data.slice(offset, offset + chunkSize)
          if (writeChar.properties?.writeWithoutResponse && writeChar.writeValueWithoutResponse) {
            await writeChar.writeValueWithoutResponse(chunk)
          } else if (writeChar.writeValueWithResponse) {
            await writeChar.writeValueWithResponse(chunk)
          } else {
            await writeChar.writeValue(chunk)
          }
          await new Promise((resolve) => window.setTimeout(resolve, 22))
        }
      } : undefined
      setBtPrinter({
        name: printerName,
        connected: true,
        sendBytes,
        disconnect: () => {
          device.gatt?.disconnect?.()
          setBtPrinter(null)
          setBtStatus('Printer disconnected.')
        },
      })
      setBtStatus(sendBytes
        ? `Connected to ${printerName} (ready to print).`
        : `Connected to ${printerName}, but it uses Classic Bluetooth Serial instead of BLE. Use "Pair BT COM / USB" below.`)
      notify(sendBytes ? `Paired with ${printerName}` : `${printerName} needs BT COM / Serial`)
      recordAudit('Printer paired', printerName)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        setBtStatus('Pairing cancelled. Select a nearby printer or use Manual Print.')
      } else {
        setBtStatus(error instanceof Error ? error.message : 'Could not connect to Bluetooth printer.')
      }
    } finally {
      setBtPairing(false)
    }
  }

  const pairSerialPrinter = async () => {
    const serial = (navigator as Navigator & { serial?: { requestPort: () => Promise<any> } }).serial
    if (!serial) {
      setBtStatus('Serial / Bluetooth COM printing requires Chrome or Edge on desktop.')
      notify('Web Serial not supported in this browser')
      return
    }
    setBtPairing(true)
    setBtStatus('Select your Bluetooth COM port (e.g. Standard Serial over Bluetooth)...')
    try {
      const port = await serial.requestPort()
      if (!port.writable) {
        await port.open({ baudRate: 9600 })
      }
      const sendBytes = async (data: Uint8Array) => {
        const writer = port.writable.getWriter()
        try {
          await writer.write(data)
        } finally {
          writer.releaseLock()
        }
      }
      setBtPrinter({
        name: 'BT / Serial Printer',
        connected: true,
        sendBytes,
        disconnect: () => {
          void port.close?.().catch(() => { })
          setBtPrinter(null)
          setBtStatus('Serial printer disconnected.')
        },
      })
      setBtStatus('Connected to Serial / Bluetooth COM printer (ready to print).')
      notify('Serial / BT COM printer connected')
      recordAudit('Printer paired', 'Serial / BT COM Printer')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        setBtStatus('Port selection cancelled.')
      } else {
        setBtStatus(error instanceof Error ? error.message : 'Could not open COM port.')
      }
    } finally {
      setBtPairing(false)
    }
  }

  const sendBluetoothReceipt = async (order: Receipt): Promise<boolean> => {
    if (!btPrinter?.connected) {
      setShowTestPrint(true)
      return false
    }
    if (!btPrinter.sendBytes) {
      setBtStatus(`Connected to ${btPrinter.name}, but no printable Bluetooth write characteristic was found.`)
      notify(`${btPrinter.name} has no printable Bluetooth channel`)
      return false
    }
    setBtPrinting(true)
    try {
      const segments = await buildEscPosReceipt(order, settings)
      for (const segment of segments) {
        if (!segment.length) continue
        await btPrinter.sendBytes(segment)
        await new Promise((resolve) => window.setTimeout(resolve, 80))
      }
      notify(`Sent receipt to ${btPrinter.name}`)
      setBtStatus(`Sent to ${btPrinter.name}.`)
      return true
    } catch {
      setBtStatus('Could not send directly over Bluetooth. Check printer connection.')
      notify('Bluetooth print failed — check printer')
      return false
    } finally {
      setBtPrinting(false)
    }
  }

  const navItems: Array<{ id: Page; label: string; icon: typeof HomeIcon }> = [
    { id: 'home', label: 'Home', icon: HomeIcon },
    { id: 'products', label: 'Products', icon: PackageIcon },
    { id: 'orders', label: 'Orders', icon: ReceiptIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ]

  return <div className={cx('app-shell', settings.compactMode && 'compact-mode', settings.lightMode && 'light-mode')}>
    <div className="accent-orbit accent-orbit-one" />
    <div className="accent-orbit accent-orbit-two" />
    <aside className="sidebar">
      <div className="brand-lockup" onClick={() => goTo('home')} role="button" tabIndex={0} aria-label="Gee Graphics Home">
        <img className="brand-logo-img" src={settings.lightMode ? '/icons/gee-logo-black.png' : '/icons/gee-logo-white.png'} alt="Gee Graphics" draggable={false} />
      </div>
      <div className="sidebar-rule" />
      <nav className="primary-nav" aria-label="Primary navigation">
        {navItems.map((item) => {
          const Icon = item.icon
          return <button key={item.id} className={cx('nav-item', page === item.id && 'active')} onClick={() => goTo(item.id)}>
            <Icon size={22} />
            <span>{item.label}</span>
          </button>
        })}
      </nav>
      <button className="theme-toggle" onClick={() => updateSettings({ lightMode: !settings.lightMode })} aria-label={settings.lightMode ? 'Switch to dark mode' : 'Switch to light mode'}>
        {settings.lightMode ? <MoonIcon size={20} /> : <SunIcon size={20} />}
        <span>{settings.lightMode ? 'Dark' : 'Light'}</span>
      </button>
    </aside>

    <main className="main-column">
      {page === 'home' && <DashboardPage products={products} setCategory={setCategory} addToCart={addToCart} goTo={goTo} />}
      {page === 'products' && <ProductsPage products={products} orders={orders} addToCart={addToCart} onEdit={setEditingProduct} onCreate={() => setCreatingProduct(true)} onDelete={deleteProduct} />}
      {page === 'orders' && <OrdersPage orders={orders} products={products} auditLogs={auditLogs} onOpenReceipt={(order) => setReceipt(order)} />}
      {page === 'settings' && <SettingsPage settings={settings} updateSettings={updateSettings} onResetInventory={resetInventory} onClearRecords={clearRecords} onExport={exportData} onImport={() => importInput.current?.click()} btPrinter={btPrinter} onOpenTestPrint={() => { setBtStatus(''); setShowTestPrint(true) }} />}
    </main>

    {(page === 'home' || page === 'products') && <>
      <button className="mobile-cart-fab" onClick={() => setMobileCartOpen(true)}><ReceiptIcon size={20} /><span>{cart.length}</span><b>{money(total)}</b></button>
      <CartPanel cartDetails={cartDetails} subtotal={subtotal} tax={tax} total={total} payment={payment} onChooseCash={() => setPayment('Cash')} onChooseOnline={() => { setPayment('Online'); setShowOnlinePayment(true) }} onlinePayment={onlinePayment} customer={selectedCustomer} customers={customers} selectedCustomerId={selectedCustomerId} setSelectedCustomerId={setSelectedCustomerId} customerPickerOpen={customerPickerOpen} setCustomerPickerOpen={setCustomerPickerOpen} customerSearch={customerSearch} setCustomerSearch={setCustomerSearch} onAddCustomer={() => setShowCustomerForm(true)} updateQuantity={updateQuantity} removeFromCart={removeFromCart} chargeCustomer={chargeCustomer} previewReceipt={previewReceipt} btPrinter={btPrinter} btPrinting={btPrinting} onOpenTestPrint={() => { setBtStatus(''); setShowTestPrint(true) }} mobileOpen={mobileCartOpen} setMobileOpen={setMobileCartOpen} />
    </>}

    {toast && <div className="toast"><span className="toast-icon"><CheckIcon size={16} /></span>{toast}</div>}
    {paymentSuccess && (
      <div className="payment-success-overlay" role="status" aria-live="polite" aria-label="Payment successful">
        <div className="payment-success-modal" onClick={() => setPaymentSuccess(null)}>
          <div className="payment-success-check"><CheckIcon size={30} /></div>
          <h2>Payment Successful</h2>
          <strong>{money(paymentSuccess.total)}</strong>
          <span>{paymentSuccess.number} · {paymentSuccess.method}</span>
          <div className="payment-success-bar"><i /></div>
        </div>
      </div>
    )}
    {receipt && (
      <ReceiptModal
        order={receipt}
        settings={settings}
        btPrinter={btPrinter}
        btPairing={btPairing}
        btPrinting={btPrinting}
        btStatus={btStatus}
        onPairBt={pairBluetoothPrinter}
        onBtPrint={() => {
          void sendBluetoothReceipt(receipt).then((ok) => {
            if (ok) {
              setReceipt((current) => current ? { ...current, printedOnce: true } : null)
            }
          })
        }}
        onPrinted={() => {
          setReceipt((current) => current ? { ...current, printedOnce: true } : null)
        }}
        onClose={() => {
          const pending = receipt.justPaid && !receipt.successShown ? receipt : null
          setReceipt(null)
          if (pending) triggerPaymentSuccess(pending)
        }}
      />
    )}
    {showTestPrint && <TestPrintModal settings={settings} btPrinter={btPrinter} btPairing={btPairing} btStatus={btStatus} onPairBt={pairBluetoothPrinter} onPairSerial={pairSerialPrinter} onBtTestPrint={(sample) => sendBluetoothReceipt(sample)} onManualPrint={() => window.print()} onClose={() => setShowTestPrint(false)} />}
    {sizeProduct && <SizeModal product={sizeProduct} cart={cart} onClose={() => setSizeProduct(null)} onChoose={(size) => addToCart(sizeProduct.id, size)} />}
    {showOnlinePayment && <OnlinePaymentModal methods={paymentMethods} details={onlinePayment} onClose={() => { setShowOnlinePayment(false); if (!onlinePayment) setPayment('Cash') }} onAddMethod={(method) => setPaymentMethods((current) => current.includes(method) ? current : [...current, method])} onSave={(details) => { setOnlinePayment(details); setPayment('Online'); setShowOnlinePayment(false); notify(`${details.provider} payment details saved`) }} />}
    {showCustomerForm && <CustomerModal newCustomer={newCustomer} setNewCustomer={setNewCustomer} onClose={() => setShowCustomerForm(false)} onSubmit={addCustomer} />}
    {editingProduct && <ProductModal product={editingProduct} onClose={() => setEditingProduct(null)} onSave={(patch) => { setProducts((current) => current.map((item) => item.id === editingProduct.id ? { ...item, ...patch } : item)); setEditingProduct(null); recordAudit('Product updated', `${editingProduct.name} · ${patch.price !== undefined ? money(patch.price) : 'stock changed'}`); notify('Product updated locally') }} />}
    {creatingProduct && <ProductModal onClose={() => setCreatingProduct(false)} onSave={(patch) => {
      const name = patch.name?.trim()
      if (!name) return
      const id = `p-${Date.now()}`
      const product: Product = {
        id, sku: `GG-SH${Date.now().toString().slice(-4)}`,
        name, category: 'shirts', kind: 'shirt',
        price: patch.price ?? 0, stock: patch.stock ?? 0, accent: patch.accent ?? '#ef1b2d', accent2: '#17181b',
        description: `${name} jersey.`,
      }
      setProducts((current) => [product, ...current])
      setCreatingProduct(false)
      notify(`${name} added to the catalog`)
      recordAudit('Product added', name)
    }} create />}
    <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={importData} />
  </div>
}

function DashboardPage({ products, setCategory, addToCart, goTo }: { products: Product[]; setCategory: (value: CategoryFilter) => void; addToCart: (id: string) => void; goTo: (page: Page) => void }) {
  const sections: ProductCategory[] = ['shirts']
  return <div className="page-content dashboard-page">
    <div className="catalog-toolbar">
      <div className="dashboard-date">{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date())}</div>
    </div>
    <div className="catalog-sections">{sections.map((section) => {
      const sectionProducts = products.filter((product) => product.category === section)
      if (!sectionProducts.length) return null
      return <section className="catalog-section" key={section}><div className="section-heading"><div><h3>{CATEGORY_LABELS[section]}</h3><span>{sectionProducts.length} items · ready to sell</span></div><button onClick={() => { setCategory(section); goTo('products') }}>View all <ArrowRightIcon size={16} /></button></div><div className="product-grid">{sectionProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={addToCart} />)}</div></section>
    })}</div>
  </div>
}

function ProductsPage({ products, orders, addToCart, onEdit, onCreate, onDelete }: { products: Product[]; orders: Order[]; addToCart: (id: string) => void; onEdit: (product: Product) => void; onCreate: () => void; onDelete: (product: Product) => void }) {
  return <div className="page-content listing-page"><PageIntro title="Products" description="Update prices and stock here. Use Home to make a sale." action={<div className="page-actions"><button className="ghost-button" type="button"><PackageIcon size={16} /> {products.length} SKUs</button><button className="primary-button compact" onClick={onCreate}><PlusIcon size={16} /> Add product</button></div>} /><div className="product-admin-grid">{products.map((product) => { const latestSale = orders.flatMap((order) => order.items.map((item) => ({ order, item }))).filter(({ item }) => item.productId === product.id).sort((a, b) => new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime())[0]; return <article className="admin-product-card" key={product.id}><ProductColorBlock product={product} admin /><div className="admin-product-info"><span className="product-category-tag">{CATEGORY_LABELS[product.category]}</span><h3>{displayProductName(product.name)}</h3><p>{product.sku}</p><div className="admin-product-bottom"><strong>{money(product.price)}</strong><span className={cx('stock-badge', product.stock < 10 && 'low')}>{product.stock} in stock</span></div>{latestSale ? <div className="latest-sale"><span>Latest sale</span><strong>−{latestSale.item.quantity}{latestSale.item.size ? ` · ${latestSale.item.size}` : ''}</strong><small>{dateTime(latestSale.order.createdAt)} · {latestSale.order.number}</small></div> : <div className="latest-sale empty"><span>Latest sale</span><small>No sales yet</small></div>}<button className="admin-add-button" onClick={() => addToCart(product.id)}><PlusIcon size={14} /> Add to sale</button></div><button className="card-edit" onClick={() => onEdit(product)} aria-label={`Edit ${product.name}`}><EditIcon size={16} /></button><button className="card-delete" onClick={() => onDelete(product)} aria-label={`Delete ${product.name}`}><TrashIcon size={16} /></button></article> })}</div></div>
}

function OrdersPage({ orders, products, auditLogs, onOpenReceipt }: { orders: Order[]; products: Product[]; auditLogs: AuditLog[]; onOpenReceipt: (order: Order) => void }) {
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null)
  const [viewingOrderNum, setViewingOrderNum] = useState('')
  const [activeTab, setActiveTab] = useState<'orders' | 'activity'>('orders')
  const [paymentFilter, setPaymentFilter] = useState<'All' | PaymentMethod>('All')

  const todayKey = new Date().toDateString()
  const todayOrders = orders.filter((order) => new Date(order.createdAt).toDateString() === todayKey)
  const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total, 0)
  const gross = orders.reduce((sum, order) => sum + order.total, 0)
  const totalItemsSold = orders.reduce((sum, order) => sum + order.items.reduce((s, i) => s + i.quantity, 0), 0)
  const avgTicket = orders.length ? gross / orders.length : 0

  const cashOrders = orders.filter((order) => order.paymentMethod === 'Cash')
  const onlineOrders = orders.filter((order) => order.paymentMethod === 'Online')
  const cashTotal = cashOrders.reduce((sum, order) => sum + order.total, 0)
  const onlineTotal = onlineOrders.reduce((sum, order) => sum + order.total, 0)
  const cashPct = gross > 0 ? Math.round((cashTotal / gross) * 100) : 0
  const onlinePct = gross > 0 ? Math.round((onlineTotal / gross) * 100) : 0

  const topSellers = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number; image?: string }>()
    const byId = new Map(products.map((p) => [p.id, p]))
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const current = map.get(item.productId) ?? { name: displayProductName(item.productName), qty: 0, revenue: 0, image: byId.get(item.productId)?.image }
        current.qty += item.quantity
        current.revenue += item.price * item.quantity
        map.set(item.productId, current)
      })
    })
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 4)
  }, [orders, products])

  const inventory = [...products].sort((a, b) => a.stock - b.stock)
  const visibleOrders = paymentFilter === 'All' ? orders : orders.filter((order) => order.paymentMethod === paymentFilter)

  const openProof = async (order: Order) => {
    const url = await loadReceiptImageUrl(order.onlinePayment?.receiptImage)
    if (!url) return
    setViewingOrderNum(order.number)
    setViewingReceiptUrl(url)
  }

  const closeProof = () => {
    if (viewingReceiptUrl?.startsWith('blob:')) URL.revokeObjectURL(viewingReceiptUrl)
    setViewingReceiptUrl(null)
    setViewingOrderNum('')
  }

  return <div className="page-content listing-page orders-reports-page">
    <PageIntro title="Orders & Reports" description="Sales overview, payment breakdown, inventory levels, and transaction history." />

    <div className="kpi-grid">
      <div className="kpi-card highlight">
        <span>Today's sales</span>
        <strong>{money(todayRevenue)}</strong>
        <small>{todayOrders.length} {todayOrders.length === 1 ? 'order' : 'orders'} today</small>
      </div>
      <div className="kpi-card">
        <span>All-time revenue</span>
        <strong>{money(gross)}</strong>
        <small>{orders.length} total {orders.length === 1 ? 'transaction' : 'transactions'}</small>
      </div>
      <div className="kpi-card">
        <span>Jerseys sold</span>
        <strong>{totalItemsSold}</strong>
        <small>{products.reduce((sum, p) => sum + p.stock, 0)} pcs left in stock</small>
      </div>
      <div className="kpi-card">
        <span>Average order</span>
        <strong>{money(avgTicket)}</strong>
        <small>{onlineOrders.length} online · {cashOrders.length} cash</small>
      </div>
    </div>

    <div className="report-grid merged-report-grid">
      <div className="panel-card">
        <div className="panel-heading">
          <div><h3>Payment breakdown</h3><p className="panel-sub">Cash vs. online transfers</p></div>
          <WalletIcon size={18} />
        </div>
        <div className="payment-bars">
          <PaymentBar label={`Cash (${cashOrders.length} · ${cashPct}%)`} value={cashTotal} color="red" total={gross || 1} icon={<BanknoteIcon size={16} />} />
          <PaymentBar label={`Online (${onlineOrders.length} · ${onlinePct}%)`} value={onlineTotal} color="violet" total={gross || 1} icon={<WalletIcon size={16} />} />
        </div>

        <div className="top-sellers-block">
          <div className="sub-heading"><strong>Top selling jerseys</strong><span>by quantity</span></div>
          {topSellers.length ? (
            <div className="top-sellers-list">
              {topSellers.map((item) => (
                <div className="top-seller-row" key={item.name}>
                  {item.image && <img src={item.image} alt={item.name} />}
                  <div><strong>{item.name}</strong><small>{item.qty} sold</small></div>
                  <b>{money(item.revenue)}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-inline">Complete a sale to see top-selling jerseys.</p>
          )}
        </div>
      </div>

      <div className="panel-card inventory-panel">
        <div className="panel-heading">
          <div><h3>Stock on hand</h3><p className="panel-sub">Sorted by lowest stock first</p></div>
          <PackageIcon size={18} />
        </div>
        <div className="stock-list">
          {inventory.map((product) => (
            <div className="stock-line" key={product.id}>
              {product.image
                ? <span className="stock-jersey-thumb" style={{ background: `radial-gradient(circle at 50% 50%, ${product.accent}33, #17181b)` }}><img src={product.image} alt={product.name} /></span>
                : <span className="stock-color" style={{ background: product.accent }} />}
              <div><strong>{displayProductName(product.name)}</strong><span>{product.sku}</span></div>
              <b className={cx(product.stock === 0 ? 'out' : product.stock < 10 && 'low')}>{product.stock} left</b>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="table-card merged-orders-card">
      <div className="table-toolbar orders-toolbar">
        <div className="segmented-tabs">
          <button type="button" className={cx(activeTab === 'orders' && 'active')} onClick={() => setActiveTab('orders')}>Orders <b>{orders.length}</b></button>
          <button type="button" className={cx(activeTab === 'activity' && 'active')} onClick={() => setActiveTab('activity')}>Activity log <b>{auditLogs.length}</b></button>
        </div>
        {activeTab === 'orders' && (
          <div className="payment-filter-chips">
            {(['All', 'Cash', 'Online'] as const).map((method) => (
              <button key={method} type="button" className={cx(paymentFilter === method && 'active')} onClick={() => setPaymentFilter(method)}>{method}</button>
            ))}
          </div>
        )}
      </div>

      {activeTab === 'orders' ? (
        <div className="orders-table">
          <div className="table-head orders-head-v2"><span>Order</span><span>Items purchased</span><span>Payment</span><span>Date & time</span><span>Total</span><span>Actions</span></div>
          {visibleOrders.length ? visibleOrders.map((order) => (
            <div className="table-row orders-row-v2" key={order.id}>
              <strong>{order.number}</strong>
              <span className="order-items-summary">{order.items.map((item) => `${displayProductName(item.productName)}${item.size ? ` (${item.size})` : ''} ×${item.quantity}`).join(', ')}</span>
              <span className="order-payment-cell">
                <PaymentBadge method={order.paymentMethod} />
                {order.onlinePayment?.provider && <small className="provider-tag">{order.onlinePayment.provider}</small>}
              </span>
              <span>{dateTime(order.createdAt)}</span>
              <strong>{money(order.total)}</strong>
              <span className="order-row-actions">
                {order.onlinePayment?.receiptImage && <button type="button" className="view-proof-btn" onClick={() => void openProof(order)}>Proof</button>}
                <button type="button" className="view-receipt-btn" onClick={() => onOpenReceipt(order)}>Receipt</button>
              </span>
            </div>
          )) : <p className="empty-state">No {paymentFilter === 'All' ? '' : `${paymentFilter.toLowerCase()} `}orders recorded yet.</p>}
        </div>
      ) : (
        <div className="audit-list">
          {auditLogs.length ? auditLogs.map((log) => (
            <div className="audit-row" key={log.id}><time>{dateTime(log.createdAt)}</time><strong>{log.action}</strong><span>{log.details}</span></div>
          )) : <p className="empty-state">No activity recorded yet.</p>}
        </div>
      )}
    </div>

    {viewingReceiptUrl && (
      <div className="modal-backdrop" onClick={closeProof}>
        <div className="form-modal proof-modal" role="dialog" aria-modal="true" aria-label={`Payment proof ${viewingOrderNum}`} onClick={(e) => e.stopPropagation()}>
          <button type="button" className="modal-close" onClick={closeProof} aria-label="Close proof"><XIcon size={18} /></button>
          <h2>Payment Proof {viewingOrderNum}</h2>
          <img className="proof-full-img" src={viewingReceiptUrl} alt={`Receipt proof for ${viewingOrderNum}`} />
          <div className="modal-actions"><button type="button" className="primary-button" onClick={closeProof}>Close</button></div>
        </div>
      </div>
    )}
  </div>
}

function CustomersPage({ customers, onAdd }: { customers: Customer[]; onAdd: () => void }) {
  const returningRate = customers.length ? Math.round((customers.filter((customer) => customer.orders > 1).length / customers.length) * 100) : 0
  return <div className="page-content listing-page"><PageIntro eyebrow="People behind the drop" title="Customers" description="Keep regulars close without sending anything to a server." action={<button className="primary-button compact" onClick={onAdd}><UserPlusIcon size={17} /> New customer</button>} /><div className="customer-stats"><SummaryPill label="Total customers" value={String(customers.length)} /><SummaryPill label="Returning rate" value={`${returningRate}%`} /><SummaryPill label="Lifetime value" value={money(customers.reduce((sum, customer) => sum + customer.totalSpent, 0))} /></div><div className="customer-grid">{customers.map((customer) => <article className="customer-card" key={customer.id}><div className="customer-card-top"><div className="customer-avatar">{customer.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><button className="icon-button"><MoreIcon size={18} /></button></div><h3>{customer.name}</h3><p>{customer.email}</p><p>{customer.phone}</p><div className="customer-card-footer"><span>{customer.orders} orders</span><strong>{money(customer.totalSpent)}</strong></div></article>)}</div></div>
}

function ReportsPage({ orders, products }: { orders: Order[]; products: Product[] }) {
  const gross = orders.reduce((sum, order) => sum + order.total, 0)
  const cash = orders.filter((order) => order.paymentMethod === 'Cash').reduce((sum, order) => sum + order.total, 0)
  const online = orders.filter((order) => order.paymentMethod === 'Online').reduce((sum, order) => sum + order.total, 0)
  const inventory = [...products].sort((a, b) => b.stock - a.stock)
  return <div className="page-content listing-page"><PageIntro eyebrow="Signals, not spreadsheets" title="Reports" description="A clear read on the local sales data in your POS." action={<button className="ghost-button"><PrinterIcon size={16} /> Print report</button>} /><div className="report-hero"><div><span className="eyebrow">All-time gross sales</span><strong>{money(gross)}</strong><p><span className={cx('green-copy', gross === 0 && 'muted-stat')}>{gross === 0 ? 'Ready for first sale' : '+14.2%'}</span> compared to last period</p></div><div className="sparkline"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><span /></div></div><div className="report-grid"><div className="panel-card"><div className="panel-heading"><div><span className="eyebrow">Revenue mix</span><h3>Payment methods</h3></div><MoreIcon size={19} /></div><div className="payment-bars"><PaymentBar label="Cash" value={cash} color="red" total={gross || 1} icon={<BanknoteIcon size={17} />} /><PaymentBar label="Online" value={online} color="violet" total={gross || 1} icon={<WalletIcon size={17} />} /></div></div><div className="panel-card inventory-panel"><div className="panel-heading"><div><span className="eyebrow">Inventory lens</span><h3>Stock on hand</h3></div><PackageIcon size={19} /></div>  <div className="stock-list">{inventory.map((product) => <div className="stock-line" key={product.id}>{product.image ? <span className="stock-jersey-thumb" style={{ background: `radial-gradient(circle at 50% 50%, ${product.accent}33, #17181b)` }}><img src={product.image} alt={product.name} /></span> : <span className="stock-color" style={{ background: product.accent }} />}<div><strong>{displayProductName(product.name)}</strong><span>{product.sku}</span></div><b className={cx(product.stock < 10 && 'low')}>{product.stock}</b></div>)}</div></div></div></div>
}

function SettingsPage({ settings, updateSettings, onResetInventory, onClearRecords, onExport, onImport, btPrinter, onOpenTestPrint }: { settings: Settings; updateSettings: (patch: Partial<Settings>) => void; onResetInventory: () => void; onClearRecords: () => void; onExport: () => void; onImport: () => void; btPrinter: BtPrinterState | null; onOpenTestPrint: () => void }) {
  return <div className="page-content listing-page settings-page"><PageIntro title="Settings" description="Preferences and local data controls." /><div className="settings-grid"><section className="settings-card"><div className="panel-heading"><div><h3>Identity & receipts</h3></div><SparkIcon size={19} /></div><label className="field-label">Store name<input value={settings.storeName} onChange={(event) => updateSettings({ storeName: event.target.value })} /></label><label className="field-label">Tax rate <span className="input-suffix"><input type="number" inputMode="decimal" min="0" max="30" step="0.1" value={settings.taxRate} onChange={(event) => updateSettings({ taxRate: Number(event.target.value) || 0 })} /> %</span></label><label className="field-label">Receipt footer<textarea rows={3} value={settings.receiptFooter} onChange={(event) => updateSettings({ receiptFooter: event.target.value })} /></label></section><section className="settings-card"><div className="panel-heading"><div><h3>POS preferences</h3></div><SettingsIcon size={19} /></div><ToggleRow label="Light mode" description="Use a brighter theme for daytime work." value={settings.lightMode} onChange={(value) => updateSettings({ lightMode: value })} /><ToggleRow label="Sound effects" description="Play short feedback cues while selling." value={settings.soundEffects} onChange={(value) => updateSettings({ soundEffects: value })} /><ToggleRow label="Compact mode" description="Fit more products on smaller screens." value={settings.compactMode} onChange={(value) => updateSettings({ compactMode: value })} /><div className="settings-note"><WalletIcon size={18} /><div><strong>Local-only mode</strong><p>Orders, catalog, payment methods and settings are saved in localStorage on this device.</p></div></div></section><section className="settings-card"><div className="panel-heading"><div><h3>Receipt printer</h3></div><PrinterIcon size={19} /></div><p className="printer-summary">{btPrinter?.connected ? `Connected to ${btPrinter.name}.` : 'No Bluetooth printer connected. Pair a nearby Bluetooth thermal printer or run a manual test print.'}</p><div className="danger-actions"><button className="primary-button" onClick={onOpenTestPrint}><PrinterIcon size={15} /> {btPrinter?.connected ? 'Printer & Test Print' : 'Test Print'}</button>{btPrinter?.connected && btPrinter.disconnect && <button className="ghost-button" onClick={btPrinter.disconnect}>Disconnect</button>}</div></section><section className="settings-card"><div className="panel-heading"><div><h3>Backup data</h3></div><DownloadIcon size={19} /></div><p>Export all transactions, products, customers, settings, and audit history to a JSON file. Import it later to restore this POS.</p><div className="danger-actions"><button className="primary-button" onClick={onExport}>Export JSON</button><button className="ghost-button" onClick={onImport}>Import JSON</button></div></section><section className="settings-card danger-zone"><div className="panel-heading"><div><h3>Local data</h3></div><TrashIcon size={19} /></div><p>Reset jersey inventory to default (XS–2XL: 2 each, 3XL–5XL: 0) or clear sales records.</p><div className="danger-actions"><button className="ghost-button" onClick={onResetInventory}>Reset inventory</button><button className="danger-button" onClick={onClearRecords}>Clear sales records</button></div></section></div></div>
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-intro"><div>{eyebrow && <span className="eyebrow"><span className="eyebrow-line" /> {eyebrow}</span>}<h1>{title}<span className="red-dot">.</span></h1><p>{description}</p></div>{action}</div>
}

function SummaryPill({ label, value }: { label: string; value: string }) { return <div className="summary-pill"><span>{label}</span><strong>{value}</strong></div> }

function ProductCard({ product, onAdd }: { product: Product; onAdd: (id: string) => void }) {
  const cardStyle = {
    '--card-accent': product.accent,
    '--card-accent-2': product.accent2,
    background: `linear-gradient(155deg, ${product.accent} 0%, ${product.accent2} 100%)`,
  } as CSSProperties
  return <article className="product-card" style={cardStyle} onClick={() => onAdd(product.id)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onAdd(product.id) } }}>
    <span className={cx('stock-count-badge', product.stock < 10 && 'low')}>{product.stock} left</span>
    <div className="product-card-visual">
      {product.image
        ? <img className="product-jersey-img" src={product.image} alt={product.name} loading="eager" draggable={false} />
        : <span className="product-fallback-mark">{displayProductName(product.name).slice(0, 2)}</span>}
    </div>
    <div className="product-card-copy">
      <h4>{displayProductName(product.name)}</h4>
    </div>
  </article>
}

function displayProductName(name: string) {
  return name.replace(/\s+(shirt|bandana)$/i, '').toUpperCase()
}

function ProductColorBlock({ product, admin = false }: { product: Product; admin?: boolean }) {
  if (product.image) {
    return <div className={cx(admin ? 'admin-product-color' : 'product-color-block', 'has-image')} style={{ background: `radial-gradient(circle at 50% 55%, color-mix(in srgb, ${product.accent} 34%, #18191d), #111215)` }}>
      <img className="product-jersey-img" src={product.image} alt={product.name} loading="eager" draggable={false} />
      <span className="product-price">{money(product.price)}</span>
      {product.stock < 10 && <span className="stock-ribbon">Low stock</span>}
    </div>
  }
  return <div className={cx(admin ? 'admin-product-color' : 'product-color-block')} style={{ background: `linear-gradient(135deg, ${product.accent}, ${product.accent2})` }}><strong>{displayProductName(product.name)}</strong><span className="product-price">{money(product.price)}</span>{product.stock < 10 && <span className="stock-ribbon">Low stock</span>}</div>
}

function SizeModal({ product, cart, onClose, onChoose }: { product: Product; cart: CartLine[]; onClose: () => void; onChoose: (size: string) => void }) {
  const sizeStock = getSizeStock(product)
  const sizeItems = SHIRT_SIZES.map((size) => {
    const reserved = cart.filter((line) => line.productId === product.id && line.size === size).reduce((sum, line) => sum + line.quantity, 0)
    const available = Math.max(0, (sizeStock[size] ?? 0) - reserved)
    return { size, available }
  })
  const availableSizes = sizeItems.filter((item) => item.available > 0)
  const unavailableSizes = sizeItems.filter((item) => item.available === 0)

  return <div className="modal-backdrop">
    <div className="form-modal size-modal" role="dialog" aria-modal="true" aria-labelledby="size-modal-title">
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close size picker"><XIcon size={19} /></button>
      <span className="modal-step">Step 1 of 1</span>
      <h2 id="size-modal-title">Choose a size</h2>
      <p>Select an available size for {displayProductName(product.name)}.</p>

      {availableSizes.length > 0 ? (
        <div className="size-section">
          <span className="size-section-label">Available</span>
          <div className="size-grid">
            {availableSizes.map(({ size, available }) => (
              <button type="button" className="size-option" key={size} onClick={() => onChoose(size)}>
                <strong>{size}</strong>
                <small>{available} available</small>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="size-empty-note">All sizes are currently out of stock.</p>
      )}

      {unavailableSizes.length > 0 && (
        <div className="size-section unavailable">
          <span className="size-section-label">Not available</span>
          <div className="size-grid size-grid-unavailable">
            {unavailableSizes.map(({ size }) => (
              <button type="button" className="size-option unavailable" disabled key={size}>
                <strong>{size}</strong>
                <small>Out of stock</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <button type="button" className="ghost-button size-cancel" onClick={onClose}>Cancel</button>
    </div>
  </div>
}

function ProductArt({ kind, accent, accent2, tiny = false }: { kind: ProductKind; accent: string; accent2: string; small?: boolean; tiny?: boolean }) {
  const style = { '--product-accent': accent, '--product-accent-2': accent2 } as CSSProperties
  if (kind === 'cap') return <div className={cx('product-art', 'cap-art', tiny && 'tiny-art')} style={style}><div className="cap-crown"><span>GG</span></div><div className="cap-brim" /></div>
  if (kind === 'sticker') return <div className={cx('product-art', 'sticker-art', tiny && 'tiny-art')} style={style}><b>G</b><span>GG+</span></div>
  if (kind === 'hoodie') return <div className={cx('product-art', 'hoodie-art', tiny && 'tiny-art')} style={style}><div className="hoodie-body"><i /><span>GG+</span></div></div>
  return <div className={cx('product-art', 'shirt-art', kind === 'set' && 'set-art', tiny && 'tiny-art')} style={style}><div className="shirt-back" /><div className="shirt-body"><i className="shirt-sleeve left" /><i className="shirt-sleeve right" /><div className="shirt-neck" /><span>{kind === 'set' ? 'SET' : '88'}</span></div>{kind === 'set' && <div className="mini-bandana" />}</div>
}

function CartPanel({ cartDetails, subtotal, tax, total, payment, onChooseCash, onChooseOnline, onlinePayment, customer, customers, selectedCustomerId, setSelectedCustomerId, customerPickerOpen, setCustomerPickerOpen, customerSearch, setCustomerSearch, onAddCustomer, updateQuantity, removeFromCart, chargeCustomer, previewReceipt, btPrinter, btPrinting, onOpenTestPrint, mobileOpen, setMobileOpen }: { cartDetails: Array<CartLine & { product: Product }>; subtotal: number; tax: number; total: number; payment: PaymentMethod; onChooseCash: () => void; onChooseOnline: () => void; onlinePayment?: OnlinePaymentDetails; customer?: Customer; customers: Customer[]; selectedCustomerId: string; setSelectedCustomerId: (value: string) => void; customerPickerOpen: boolean; setCustomerPickerOpen: (value: boolean) => void; customerSearch: string; setCustomerSearch: (value: string) => void; onAddCustomer: () => void; updateQuantity: (id: string, delta: number, size?: string) => void; removeFromCart: (id: string, size?: string) => void; chargeCustomer: () => void; previewReceipt: () => void; btPrinter: BtPrinterState | null; btPrinting: boolean; onOpenTestPrint: () => void; mobileOpen: boolean; setMobileOpen: (value: boolean) => void }) {
  const customerResults = customers.filter((item) => item.name.toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 4)
  return <aside className={cx('checkout-panel', mobileOpen && 'mobile-open')}>
    <div className="checkout-header">
      <div><span className="tab-kicker">Tab #1</span><h2>Current sale</h2></div>
      <div className="checkout-actions">
        {!btPrinter?.connected ? (
          <button className="test-print-pill" onClick={onOpenTestPrint} title="Test print or pair Bluetooth printer"><PrinterIcon size={13} /> Test Print</button>
        ) : (
          <button className="test-print-pill connected" onClick={onOpenTestPrint} title={`Connected to ${btPrinter.name}`}><BluetoothIcon size={13} /> {btPrinter.name}</button>
        )}
        <button title="Send receipt"><SendIcon size={17} /></button>
        <button title="Print receipt" onClick={previewReceipt}><PrinterIcon size={17} /></button>
        <button className="close-cart" onClick={() => setMobileOpen(false)}><XIcon size={20} /></button>
      </div>
    </div>
    <div className="customer-select-wrap">
      <button className="customer-select" onClick={() => setCustomerPickerOpen(!customerPickerOpen)}>
        <div className="customer-mini-avatar">{customer ? customer.name.slice(0, 1) : 'W'}</div>
        <div><span>Customer</span><strong>{customer?.name || 'Walk-in customer'}</strong></div><ChevronDownIcon size={16} />
      </button>
      {customerPickerOpen && <div className="customer-popover">
        <div className="search-box small-search"><SearchIcon size={15} /><input autoFocus value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Find customer" /></div>
        {customerResults.map((item) => <button key={item.id} onClick={() => { setSelectedCustomerId(item.id); setCustomerPickerOpen(false) }}><span className="customer-mini-avatar">{item.name.slice(0, 1)}</span><span>{item.name}<small>{item.orders} orders · {money(item.totalSpent)}</small></span></button>)}
        <button className="add-customer-link" onClick={onAddCustomer}><UserPlusIcon size={15} /> Add new customer</button>
        {customer && <button className="clear-customer" onClick={() => { setSelectedCustomerId(''); setCustomerPickerOpen(false) }}>Clear customer</button>}
      </div>}
    </div>
    <div className="order-items-heading"><span>Order items <b>{cartDetails.reduce((sum, line) => sum + line.quantity, 0)}</b></span><button onClick={() => cartDetails.forEach((line) => removeFromCart(line.product.id, line.size))}>Clear all</button></div>
    <div className="cart-items">
      {cartDetails.length === 0 ? <div className="empty-cart"><div className="empty-cart-mark"><ReceiptIcon size={23} /></div><h3>Your tab is clear</h3><p>Add a product to get the floor moving.</p></div> : cartDetails.map((line) => <div className="cart-item" key={`${line.product.id}-${line.size ?? 'one-size'}`}>
        <div className="cart-item-art">{line.product.image ? <img className="cart-jersey-thumb" src={line.product.image} alt={line.product.name} /> : <span className="cart-color" style={{ background: line.product.accent }} />}</div>
        <div className="cart-item-copy"><strong>{line.product.name}</strong><span>{line.product.sku}{line.size ? ` · Size ${line.size}` : ''}</span><div className="qty-control"><button onClick={() => updateQuantity(line.product.id, -1, line.size)}><MinusIcon size={13} /></button><b>{line.quantity}</b><button onClick={() => updateQuantity(line.product.id, 1, line.size)}><PlusIcon size={13} /></button></div></div>
        <div className="cart-item-price"><strong>{money(line.product.price * line.quantity)}</strong><button onClick={() => removeFromCart(line.product.id, line.size)}><TrashIcon size={14} /></button></div>
      </div>)}
    </div>
    <div className="totals"><div><span>Sub total</span><strong>{money(subtotal)}</strong></div><div><span>Tax ({tax === 0 ? '0' : ((tax / Math.max(subtotal, 1)) * 100).toFixed(0)}%)</span><strong>{money(tax)}</strong></div><div className="grand-total"><span>Total</span><strong>{money(total)}</strong></div></div>
    <div className="payment-section"><div className="payment-title"><span>Payment method</span><button><MoreIcon size={17} /></button></div><div className="payment-methods"><button className={cx('payment-method', payment === 'Cash' && 'selected')} onClick={onChooseCash}><BanknoteIcon size={21} /><span>Cash</span></button><button className={cx('payment-method', payment === 'Online' && 'selected')} onClick={onChooseOnline}><WalletIcon size={21} /><span>Online</span>{onlinePayment && <small className="payment-ready">{onlinePayment.provider} ready</small>}</button></div></div>
    <button className="charge-button" onClick={chargeCustomer} disabled={btPrinting}><span>{btPrinting ? 'Printing...' : `Charge customer ${money(total)}`}</span><span className="charge-arrow"><ArrowRightIcon size={19} /></span></button>
  </aside>
}

function PaymentBadge({ method }: { method: PaymentMethod }) { return <span className={cx('payment-badge', method.toLowerCase())}>{method}</span> }

function PaymentBar({ label, value, total, color, icon }: { label: string; value: number; total: number; color: string; icon: ReactNode }) { const percent = Math.min(100, (value / Math.max(total, 1)) * 100); return <div className="payment-bar"><div className="payment-bar-label"><span>{icon} {label}</span><strong>{money(value)}</strong></div><div className="bar-track"><i className={color} style={{ width: `${percent}%` }} /></div></div> }

function ToggleRow({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (value: boolean) => void }) { return <div className="toggle-row"><div><strong>{label}</strong><p>{description}</p></div><button className={cx('toggle', value && 'on')} onClick={() => onChange(!value)} aria-label={`Toggle ${label}`}><i /></button></div> }

  function ReceiptModal({ order, settings, btPrinter, btPairing, btPrinting, btStatus, onPairBt, onBtPrint, onClose }: { order: Receipt; settings: Settings; btPrinter: BtPrinterState | null; btPairing: boolean; btPrinting: boolean; btStatus: string; onPairBt: () => void; onBtPrint: () => void; onPrinted?: () => void; onClose: () => void }) {
    const createdAt = new Date(order.createdAt)
    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
    const canSkip = Boolean(order.justPaid && !order.successShown)
    const [needBtPrompt, setNeedBtPrompt] = useState(false)

    useEffect(() => {
      if (needBtPrompt && btPrinter?.connected) {
        setNeedBtPrompt(false)
        onBtPrint()
      }
    }, [needBtPrompt, btPrinter?.connected])

    const handlePrintClick = () => {
      if (btPrinter?.connected) {
        onBtPrint()
        return
      }
      setNeedBtPrompt(true)
      onPairBt()
    }

    return <div className="modal-backdrop receipt-backdrop"><div className="receipt-modal" role="dialog" aria-modal="true" aria-label={`Receipt ${order.number}`}>
      <div className="receipt-success"><span><CheckIcon size={15} /> {order.isDraft ? 'Current sale preview' : 'Sale complete'}</span><button onClick={onClose} aria-label="Close receipt"><XIcon size={18} /></button></div>
      <article className="receipt-paper">
        <header className="receipt-heading">
          <img className="receipt-logo-img thermal-logo" src="/icons/gee-logo-black.png" alt="Gee Graphics" />
          <h3 className="receipt-store">{settings.storeName}</h3>
          <p className="receipt-label">{order.isDraft ? 'UNPAID · CURRENT SALE' : 'OFFICIAL SALES RECEIPT'}</p>
        </header>
        <dl className="receipt-meta">
          <div><dt>{order.isDraft ? 'Status' : 'Receipt no.'}</dt><dd>{order.isDraft ? 'Awaiting payment' : order.number}</dd></div>
          <div><dt>Date</dt><dd><time dateTime={order.createdAt}>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(createdAt)}</time></dd></div>
          <div><dt>Time</dt><dd>{new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(createdAt)}</dd></div>
          {order.customerName && <div><dt>Customer</dt><dd>{order.customerName}</dd></div>}
        </dl>
        <div className="receipt-item-heading"><span>ITEM / QTY</span><span>AMOUNT</span></div>
        <div className="receipt-lines">{order.items.map((item, index) => <div key={`${item.productId}-${item.size ?? 'one-size'}-${index}`}><span><b>{item.productName}</b><small>{item.quantity} × {money(item.price)}{item.size && ` · Size ${item.size}`}<span className="receipt-sku">{item.sku}</span></small></span><strong>{money(item.price * item.quantity)}</strong></div>)}</div>
        <div className="receipt-breakdown"><div><span>Subtotal</span><strong>{money(order.subtotal)}</strong></div><div><span>Tax</span><strong>{money(order.tax)}</strong></div></div>
        <div className="receipt-total"><div className="receipt-amount"><span>{order.isDraft ? 'Total due' : 'Total paid'}</span><strong>{money(order.total)}</strong></div>{!order.isDraft && <div className="receipt-payment"><span>Payment method</span><strong>{order.paymentMethod}{order.onlinePayment && ` · ${order.onlinePayment.provider}`}</strong></div>}{!order.isDraft && order.onlinePayment && <small className="receipt-payment-detail">Account: {order.onlinePayment.accountName}<br />Reference: {order.onlinePayment.referenceNumber || 'Receipt photo attached'}</small>}</div>
        <footer className="receipt-ending">
          <span>{itemCount} {itemCount === 1 ? 'item' : 'items'} · {order.isDraft ? 'Payment pending' : 'Payment received'}</span>
          <p className="receipt-footer">{settings.receiptFooter}</p>
          <div className="receipt-barcode" aria-hidden="true"><span /><i /><span /><span /><i /><span /><i /><i /><span /><span /><i /><span /><i /><span /><span /><i /><span /><i /><span /><span /><i /><span /></div>
          <small className="receipt-code">{order.isDraft ? 'UNPAID-PREVIEW' : `GG-${order.number.replace('#', '')}`}</small>
          <strong>{order.isDraft ? 'UNPAID COPY' : 'THANK YOU FOR SHOPPING WITH US'}</strong>
        </footer>
      </article>
      <p className="receipt-print-hint">{btPrinter?.connected ? `Connected to ${btPrinter.name} — prints directly via Bluetooth.` : 'Connect your Bluetooth thermal printer to print this receipt.'}</p>
      <div className="modal-actions receipt-modal-actions">
        {btPrinting ? (
          <button className="primary-button" disabled><PrinterIcon size={16} /> Printing...</button>
        ) : order.printedOnce ? (
          <>
            <button className="ghost-button" onClick={handlePrintClick}><PrinterIcon size={16} /> Reprint</button>
            <button className="primary-button" onClick={onClose}><CheckIcon size={16} /> Done printing</button>
          </>
        ) : (
          <>
            <button className="ghost-button" onClick={onClose}>{canSkip ? 'Skip printing' : 'Close'}</button>
            {!btPrinter?.connected && <button className="ghost-button" onClick={() => { setNeedBtPrompt(true); onPairBt() }} disabled={btPairing}><BluetoothIcon size={15} /> {btPairing ? 'Searching...' : 'Pair BT Printer'}</button>}
            <button className="primary-button" onClick={handlePrintClick}>{btPrinter?.connected ? <><BluetoothIcon size={16} /> Print via BT</> : <><PrinterIcon size={16} /> Print receipt</>}</button>
          </>
        )}
      </div>
      {needBtPrompt && !btPrinter?.connected && (
        <div className="bt-required-overlay" role="dialog" aria-modal="true" aria-label="Connect BT printer first">
          <div className="bt-required-card">
            <div className="bt-required-icon"><BluetoothIcon size={28} /></div>
            <h3>Connect BT Printer First</h3>
            <p>{btPairing ? 'Searching for your Bluetooth thermal printer...' : 'No Bluetooth printer is connected yet. Connect your printer to print this receipt.'}</p>
            {btStatus && <small className="bt-required-status">{btStatus}</small>}
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setNeedBtPrompt(false)}>Cancel</button>
              <button type="button" className="primary-button" onClick={onPairBt} disabled={btPairing}>
                <BluetoothIcon size={16} /> {btPairing ? 'Searching...' : 'Search BT Printer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div></div>
  }

  function TestPrintModal({ settings, btPrinter, btPairing, btStatus, onPairBt, onPairSerial, onBtTestPrint, onManualPrint, onClose }: { settings: Settings; btPrinter: BtPrinterState | null; btPairing: boolean; btStatus: string; onPairBt: () => void; onPairSerial: () => void; onBtTestPrint: (sample: Receipt) => void; onManualPrint: () => void; onClose: () => void }) {
    const now = new Date()
    const subtotal = 650
    const tax = subtotal * (settings.taxRate / 100)
    const total = subtotal + tax
    const isAppleTouch = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    const hasWebSerial = typeof navigator !== 'undefined' && 'serial' in navigator
    const hasShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
    const sampleOrder: Receipt = {
      id: 'test-print',
      number: '#TEST-001',
      createdAt: now.toISOString(),
      isDraft: true,
      items: [
        { productId: 'p-gl01', productName: 'Golden Lions Shirt', sku: 'GG-GL01', quantity: 1, price: 650, size: 'L' },
      ],
      subtotal,
      tax,
      total,
      paymentMethod: 'Cash',
    }

    const shareReceipt = async () => {
      if (!hasShare) return
      const text = [
        settings.storeName.toUpperCase(),
        `Receipt ${sampleOrder.number}`,
        'Golden Lions Shirt (L) x1 - PHP 650.00',
        `Total: PHP ${total.toFixed(2)} (Cash)`,
        settings.receiptFooter,
      ].join('\n')
      try {
        await navigator.share({ title: `${settings.storeName} Receipt`, text })
      } catch {
        // User cancelled share sheet
      }
    }

    return <div className="modal-backdrop receipt-backdrop">
      <div className="test-print-modal" role="dialog" aria-modal="true" aria-label="Test Print">
        <div className="test-print-preview">
          <article className="receipt-paper test-receipt-paper">
            <header className="receipt-heading">
              <img className="receipt-logo-img thermal-logo" src="/icons/gee-logo-black.png" alt="Gee Graphics" />
              <h3 className="receipt-store">{settings.storeName}</h3>
              <p className="receipt-label">SAMPLE / UNPAID COPY</p>
            </header>
            <dl className="receipt-meta">
              <div><dt>Receipt no.</dt><dd>{sampleOrder.number}</dd></div>
              <div><dt>Date</dt><dd><time dateTime={sampleOrder.createdAt}>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(now)}</time></dd></div>
              <div><dt>Time</dt><dd>{new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(now)}</dd></div>
            </dl>
            <div className="receipt-item-heading"><span>ITEM / QTY</span><span>AMOUNT</span></div>
            <div className="receipt-lines">
              {sampleOrder.items.map((item) => <div key={item.productId}><span><b>{item.productName}</b><small>{item.quantity} × {money(item.price)} · Size {item.size}</small></span><strong>{money(item.price * item.quantity)}</strong></div>)}
            </div>
            <div className="receipt-breakdown"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Tax</span><strong>{money(tax)}</strong></div></div>
            <div className="receipt-total"><div className="receipt-amount"><span>Total</span><strong>{money(total)}</strong></div><div className="receipt-payment"><span>Payment</span><strong>Cash</strong></div></div>
            <footer className="receipt-ending">
              <p className="receipt-footer">{settings.receiptFooter}</p>
              <div className="receipt-barcode" aria-hidden="true"><span /><i /><span /><span /><i /><span /><i /><i /><span /><span /><i /><span /><i /><span /><span /><i /><span /><i /><span /><span /><i /><span /></div>
              <small className="receipt-code">GG-TEST-001</small>
              <strong>PRINTER ALIGNMENT OK</strong>
            </footer>
          </article>
        </div>

        <div className="test-print-controls">
          <div className="test-print-head">
            <div>
              <h2>Test Print<span className="red-dot">.</span></h2>
              <span className={cx('printer-badge', btPrinter?.connected && 'connected')}>
                <i /> {btPrinter?.connected ? btPrinter.name : 'Not connected'}
              </span>
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close test print"><XIcon size={18} /></button>
          </div>

          <div className="test-print-options">
            {!isAppleTouch && (
              <button type="button" className="printer-option-btn bt-option" onClick={onPairBt} disabled={btPairing}>
                <BluetoothIcon size={18} />
                <span>{btPairing ? 'Searching...' : 'Pair BT Printer'}</span>
              </button>
            )}

            {hasWebSerial && !isAppleTouch && (
              <button type="button" className="printer-option-btn bt-option" onClick={onPairSerial} disabled={btPairing}>
                <PrinterIcon size={18} />
                <span>Pair BT COM / USB</span>
              </button>
            )}

            {btPrinter?.connected && (
              <button type="button" className="printer-option-btn send-bt-option" onClick={() => onBtTestPrint(sampleOrder)}>
                <CheckIcon size={18} />
                <span>Send BT Test Print</span>
              </button>
            )}

            <button type="button" className="printer-option-btn manual-option" onClick={onManualPrint}>
              <PrinterIcon size={18} />
              <span>{isAppleTouch ? 'AirPrint / Manual Print' : 'Manual Print'}</span>
            </button>

            {isAppleTouch && hasShare && (
              <button type="button" className="printer-option-btn bt-option" onClick={() => void shareReceipt()}>
                <SendIcon size={17} />
                <span>Share to Thermal App</span>
              </button>
            )}
          </div>

          {isAppleTouch && !btStatus && (
            <div className="bt-status-note">iPad Safari prints via AirPrint or Share to a thermal printer app (Web Bluetooth is disabled by iPadOS).</div>
          )}

          {btStatus && <div className="bt-status-note">{btStatus}</div>}

          <div className="test-print-footer">
            {btPrinter?.connected && btPrinter.disconnect && <button type="button" className="ghost-button" onClick={btPrinter.disconnect}>Disconnect</button>}
            <button type="button" className="ghost-button test-print-cancel" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  }

  function CustomerModal({ newCustomer, setNewCustomer, onClose, onSubmit }: { newCustomer: { name: string; email: string; phone: string }; setNewCustomer: (value: { name: string; email: string; phone: string }) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) { return <div className="modal-backdrop"><form className="form-modal" onSubmit={onSubmit}><button type="button" className="modal-close" onClick={onClose}><XIcon size={19} /></button><span className="eyebrow">Add to the crew</span><h2>New customer<span className="red-dot">.</span></h2><p>Keep the relationship local, keep the checkout moving.</p><label className="field-label">Name<input autoFocus required value={newCustomer.name} onChange={(event) => setNewCustomer({ ...newCustomer, name: event.target.value })} placeholder="Full name" /></label><label className="field-label">Email<input type="email" value={newCustomer.email} onChange={(event) => setNewCustomer({ ...newCustomer, email: event.target.value })} placeholder="name@example.com" /></label><label className="field-label">Phone<input type="tel" inputMode="tel" value={newCustomer.phone} onChange={(event) => setNewCustomer({ ...newCustomer, phone: event.target.value })} placeholder="(555) 000-0000" /></label><div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><UserPlusIcon size={16} /> Save customer</button></div></form></div> }

  function ProductModal({ product, onClose, onSave, create = false }: { product?: Product; onClose: () => void; onSave: (patch: Partial<Product>) => void; create?: boolean }) {
    const [name, setName] = useState(product ? displayProductName(product.name) : '')
    const [price, setPrice] = useState(product?.price ?? 0)
    const [sizeStock, setSizeStock] = useState<Record<string, number>>(product?.sizeStock ?? Object.fromEntries(SHIRT_SIZES.map((size) => [size, 0])))
    return <div className="modal-backdrop"><form className="form-modal" onSubmit={(event) => { event.preventDefault(); onSave({ name: name.trim(), category: 'shirts', stock: Object.values(sizeStock).reduce((sum, value) => sum + value, 0), price, sizeStock }) }}><button type="button" className="modal-close" onClick={onClose}><XIcon size={19} /></button><h2>{create ? 'Add product' : displayProductName(product?.name ?? '')}</h2>{product && <p>{product.sku} · {CATEGORY_LABELS[product.category]}</p>}{create && <label className="field-label">Name<input required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Golden Lions" /></label>}<div className="inventory-size-grid"><strong>Available by size</strong>{SHIRT_SIZES.map((size) => <label key={size}>{size}<input type="number" inputMode="numeric" pattern="[0-9]*" min="0" step="1" value={sizeStock[size] ?? 0} onChange={(event) => setSizeStock({ ...sizeStock, [size]: Number(event.target.value) || 0 })} /></label>)}</div><label className="field-label">Price<input required type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={(event) => setPrice(Number(event.target.value))} /></label><div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><CheckIcon size={16} /> {create ? 'Add product' : 'Save changes'}</button></div></form></div>
  }

  export default App


  function OnlinePaymentModal({ methods, details, onClose, onAddMethod, onSave }: { methods: string[]; details?: OnlinePaymentDetails; onClose: () => void; onAddMethod: (method: string) => void; onSave: (details: OnlinePaymentDetails) => void }) {
    const [provider, setProvider] = useState(details?.provider ?? methods[0] ?? 'GCash')
    const [accountName, setAccountName] = useState(details?.accountName ?? '')
    const [referenceNumber, setReferenceNumber] = useState(details?.referenceNumber ?? '')
    const [receiptImageKey, setReceiptImageKey] = useState(details?.receiptImage ?? '')
    const [previewUrl, setPreviewUrl] = useState<string>('')
    const [savingImage, setSavingImage] = useState(false)
    const [newMethod, setNewMethod] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
      let active = true
      let createdBlobUrl = ''
      if (!receiptImageKey) {
        setPreviewUrl('')
        return
      }
      void loadReceiptImageUrl(receiptImageKey).then((url) => {
        if (!active) {
          if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
          return
        }
        if (url?.startsWith('blob:')) createdBlobUrl = url
        setPreviewUrl(url ?? '')
      })
      return () => {
        active = false
        if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl)
      }
    }, [receiptImageKey])

    const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      setSavingImage(true)
      setError('')
      try {
        const previousKey = receiptImageKey
        const idbKey = await saveReceiptImage(file)
        setReceiptImageKey(idbKey)
        if (previousKey && previousKey !== details?.receiptImage) {
          void deleteReceiptImage(previousKey)
        }
      } catch {
        setError('Could not save image locally. Please try again.')
      } finally {
        setSavingImage(false)
      }
    }

    const removeImage = () => {
      if (receiptImageKey && receiptImageKey !== details?.receiptImage) {
        void deleteReceiptImage(receiptImageKey)
      }
      setReceiptImageKey('')
      setPreviewUrl('')
    }

    const save = (event: FormEvent) => {
      event.preventDefault()
      if (!receiptImageKey && !accountName.trim()) {
        setError('Upload a receipt image or enter the account name.')
        return
      }
      if (!receiptImageKey && !referenceNumber.trim()) {
        setError('Upload a receipt image or enter a reference number.')
        return
      }
      onSave({
        provider,
        accountName: accountName.trim() || `${provider} receipt`,
        referenceNumber: referenceNumber.trim(),
        receiptImage: receiptImageKey || undefined,
      })
    }

    const addMethod = () => {
      const clean = newMethod.trim()
      if (!clean) return
      onAddMethod(clean)
      setProvider(clean)
      setNewMethod('')
    }

    return <div className="modal-backdrop"><form className="online-payment-modal" onSubmit={save}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close online payment"><XIcon size={19} /></button>
      <h2>Online payment<span className="red-dot">.</span></h2>
      <p>Choose provider and upload the receipt screenshot (saved in IndexedDB) or enter details.</p>
      <div className="provider-grid">{methods.map((method) => <button type="button" key={method} className={cx('provider-chip', provider === method && 'selected')} onClick={() => setProvider(method)}>{method}<i>{provider === method ? <CheckIcon size={12} /> : null}</i></button>)}</div>
      <div className="add-provider-row"><input value={newMethod} onChange={(event) => setNewMethod(event.target.value)} placeholder="Add another method" /><button type="button" onClick={addMethod}><PlusIcon size={15} /> Add</button></div>

      <div className="receipt-upload">
        <input id="receipt-photo" type="file" accept="image/*" onChange={handleImageUpload} />
        <label htmlFor="receipt-photo" className={cx('receipt-upload-label', receiptImageKey && 'has-receipt')}>
          <span className="camera-glyph">{receiptImageKey ? <CheckIcon size={18} /> : <ScanIcon size={18} />}</span>
          <span>
            <strong>{savingImage ? 'Saving to IndexedDB...' : receiptImageKey ? 'Receipt image saved locally' : 'Upload receipt image'}</strong>
            <small>{receiptImageKey ? 'Tap to replace image · stored in IndexedDB' : 'Pick screenshot or photo — no typing needed'}</small>
          </span>
          <ArrowRightIcon size={16} />
        </label>
        {previewUrl && <div className="receipt-thumb-bar">
          <img src={previewUrl} alt="Uploaded payment receipt" />
          <button type="button" className="ghost-button" onClick={removeImage}><TrashIcon size={14} /> Remove</button>
        </div>}
      </div>

      <div className="online-optional-fields">
        <label className="field-label">Account name / number <span className="optional-label">{receiptImageKey ? '(optional)' : ''}</span><input inputMode="numeric" value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Name shown on the account" /></label>
        <label className="field-label">Reference number <span className="optional-label">{receiptImageKey ? '(optional)' : ''}</span><input inputMode="numeric" value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="e.g. GC-2819-7712" /></label>
      </div>

      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={savingImage}><CheckIcon size={16} /> Save payment</button></div>
    </form></div>
  }

