export type ProductCategory = 'shirts' | 'bandanas'
export type ProductKind = 'shirt' | 'bandana' | 'set' | 'cap' | 'sticker' | 'hoodie'
export type PaymentMethod = 'Cash' | 'Online'
export type OnlinePaymentDetails = {
  provider: string
  accountName: string
  referenceNumber: string
  receiptImage?: string
}

export type Product = {
  id: string
  sku: string
  name: string
  category: ProductCategory
  kind: ProductKind
  price: number
  stock: number
  accent: string
  accent2: string
  featured?: boolean
  description: string
}

export type CartLine = {
  productId: string
  quantity: number
}

export type Customer = {
  id: string
  name: string
  email: string
  phone: string
  orders: number
  totalSpent: number
  joinedAt: string
}

export type Order = {
  id: string
  number: string
  createdAt: string
  items: Array<CartLine & { productName: string; sku: string; price: number }>
  subtotal: number
  tax: number
  total: number
  paymentMethod: PaymentMethod
  onlinePayment?: OnlinePaymentDetails
  customerId?: string
  customerName?: string
}

export type Settings = {
  storeName: string
  taxRate: number
  receiptFooter: string
  soundEffects: boolean
  compactMode: boolean
}

export const CATEGORY_LABELS: Record<ProductCategory | 'all', string> = {
  all: 'All',
  shirts: 'Shirts',
  bandanas: 'Bandanas',
}

// New designs start without sellable stock until their quantities are entered.
export const additionalBandanas: Product[] = [
  { id: 'p-bdwv06', sku: 'GG-BDWV06', name: 'Wolves Bandana', category: 'bandanas', kind: 'bandana', price: 650, stock: 0, accent: '#ed1b29', accent2: '#190c13', description: 'Black and scarlet bandana with the Wolves design.' },
  { id: 'p-bdfx07', sku: 'GG-BDFX07', name: 'Fox Bandana', category: 'bandanas', kind: 'bandana', price: 650, stock: 0, accent: '#090a0d', accent2: '#c41827', description: 'Black bandana with the Fox design.' },
  { id: 'p-bdpn08', sku: 'GG-BDPN08', name: 'Panthers Bandana', category: 'bandanas', kind: 'bandana', price: 650, stock: 0, accent: '#f11c84', accent2: '#fff1f8', description: 'Pink bandana with the Panthers design.' },
  { id: 'p-bdph09', sku: 'GG-BDPH09', name: 'Phoenix Bandana', category: 'bandanas', kind: 'bandana', price: 650, stock: 0, accent: '#1c64a8', accent2: '#d9f0ff', description: 'Royal blue bandana with the Phoenix design.' },
]

export const seedProducts: Product[] = [
  { id: 'p-gl01', sku: 'GG-GL01', name: 'Golden Lions Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 24, accent: '#f5c500', accent2: '#171b11', featured: true, description: 'Heavyweight performance jersey with a gold crest.' },
  { id: 'p-st02', sku: 'GG-ST02', name: 'Stallions Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 18, accent: '#15825b', accent2: '#081c18', featured: true, description: 'Emerald mesh jersey with a classic racing stripe.' },
  { id: 'p-bd03', sku: 'GG-BD03', name: 'Bulldogs Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 20, accent: '#ebedf0', accent2: '#1946a2', featured: true, description: 'Premium white jersey with red and blue piping.' },
  { id: 'p-eg04', sku: 'GG-EG04', name: 'Eagles Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 16, accent: '#e7e8eb', accent2: '#1b1d22', featured: true, description: 'Clean monochrome jersey built for everyday wear.' },
  { id: 'p-tg05', sku: 'GG-TG05', name: 'Tigers Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 20, accent: '#f06a13', accent2: '#21100c', featured: true, description: 'Orange match jersey with bold white lettering.' },
  { id: 'p-wv06', sku: 'GG-WV06', name: 'Wolves Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 19, accent: '#ed1b29', accent2: '#190c13', description: 'Black and scarlet jersey with angular speed lines.' },
  { id: 'p-fx07', sku: 'GG-FX07', name: 'Fox Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 15, accent: '#090a0d', accent2: '#c41827', description: 'Shadow black jersey with a bright fox mark.' },
  { id: 'p-pn08', sku: 'GG-PN08', name: 'Panthers Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 17, accent: '#f11c84', accent2: '#fff1f8', description: 'Pink performance jersey with a confident edge.' },
  { id: 'p-ph09', sku: 'GG-PH09', name: 'Phoenix Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 21, accent: '#1c64a8', accent2: '#d9f0ff', description: 'Royal blue jersey with a flame-inspired crest.' },
  { id: 'p-bg01', sku: 'GG-BDGL01', name: 'Golden Lions Bandana', category: 'bandanas', kind: 'bandana', price: 650, stock: 30, accent: '#f4bf00', accent2: '#20231a', featured: true, description: 'Silky 22-inch bandana with a woven gold mark.' },
  { id: 'p-bgst02', sku: 'GG-BDST02', name: 'Stallions Bandana', category: 'bandanas', kind: 'bandana', price: 650, stock: 28, accent: '#16825c', accent2: '#d8f7e9', featured: true, description: 'Emerald bandana with all-over linework.' },
  { id: 'p-bdb03', sku: 'GG-BDBD03', name: 'Bulldogs Bandana', category: 'bandanas', kind: 'bandana', price: 650, stock: 26, accent: '#e8ebee', accent2: '#1a4caa', featured: true, description: 'White, red and blue sport bandana.' },
  { id: 'p-bdeg04', sku: 'GG-BDEG04', name: 'Eagles Bandana', category: 'bandanas', kind: 'bandana', price: 650, stock: 25, accent: '#e6e7eb', accent2: '#25262b', featured: true, description: 'Monochrome bandana with a graphite border.' },
  { id: 'p-bdtg05', sku: 'GG-BDTG05', name: 'Tigers Bandana', category: 'bandanas', kind: 'bandana', price: 650, stock: 24, accent: '#f26a11', accent2: '#35110a', featured: true, description: 'Orange bandana with the Tigers crest.' },
  ...additionalBandanas,
]

export const seedCustomers: Customer[] = []

export const seedOrders: Order[] = []

export const seedPaymentMethods = ['GCash', 'MariBank', 'GoTyme', 'BPI']
export const defaultSettings: Settings = { storeName: 'Gee Graphics POS', taxRate: 6, receiptFooter: 'Thank you for supporting independent graphics.', soundEffects: true, compactMode: true }

export const money = (value: number) => `₱${value.toFixed(2)}`
export const dateTime = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
export const dateOnly = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
