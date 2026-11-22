export type ProductCategory = 'shirts'
export type ProductKind = 'shirt' | 'set' | 'cap' | 'sticker' | 'hoodie'
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
  sizeStock?: Record<string, number>
  accent: string
  accent2: string
  image?: string
  featured?: boolean
  description: string
}

export type CartLine = {
  productId: string
  quantity: number
  size?: string
}

export const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

export const DEFAULT_SHIRT_SIZE_STOCK: Record<string, number> = {
  XS: 2,
  S: 2,
  M: 2,
  L: 2,
  XL: 2,
  '2XL': 2,
  '3XL': 0,
  '4XL': 0,
  '5XL': 0,
}

export type AuditLog = {
  id: string
  createdAt: string
  action: string
  details: string
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
  lightMode: boolean
}

export const CATEGORY_LABELS: Record<ProductCategory | 'all', string> = {
  all: 'All',
  shirts: 'Shirts',
}

export const seedProducts: Product[] = [
  { id: 'p-gl01', sku: 'GG-GL01', name: 'Golden Lions Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 12, sizeStock: { ...DEFAULT_SHIRT_SIZE_STOCK }, accent: '#e5a800', accent2: '#7a4b00', image: '/jerseys/golden-lions.png', featured: true, description: 'Heavyweight performance jersey with a gold crest.' },
  { id: 'p-st02', sku: 'GG-ST02', name: 'Stallions Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 12, sizeStock: { ...DEFAULT_SHIRT_SIZE_STOCK }, accent: '#12734f', accent2: '#062b1c', image: '/jerseys/stallions.png', featured: true, description: 'Emerald mesh jersey with a classic racing stripe.' },
  { id: 'p-rd03', sku: 'GG-RD03', name: 'Red Dragon Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 12, sizeStock: { ...DEFAULT_SHIRT_SIZE_STOCK }, accent: '#dc1c22', accent2: '#5c070b', image: '/jerseys/red-dragon.png', featured: true, description: 'Crimson and black jersey with the Red Dragon crest.' },
  { id: 'p-eg04', sku: 'GG-EG04', name: 'Eagles Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 12, sizeStock: { ...DEFAULT_SHIRT_SIZE_STOCK }, accent: '#5a5f6b', accent2: '#17191e', image: '/jerseys/eagles.png', featured: true, description: 'Clean monochrome jersey built for everyday wear.' },
  { id: 'p-tg05', sku: 'GG-TG05', name: 'Tigers Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 12, sizeStock: { ...DEFAULT_SHIRT_SIZE_STOCK }, accent: '#df590c', accent2: '#5a1b04', image: '/jerseys/tigers.png', featured: true, description: 'Orange match jersey with bold lettering.' },
  { id: 'p-wv06', sku: 'GG-WV06', name: 'Wolves Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 12, sizeStock: { ...DEFAULT_SHIRT_SIZE_STOCK }, accent: '#6b0f2a', accent2: '#14040a', image: '/jerseys/wolves.png', description: 'Black and scarlet jersey with angular speed lines.' },
  { id: 'p-fx07', sku: 'GG-FX07', name: 'Fox Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 12, sizeStock: { ...DEFAULT_SHIRT_SIZE_STOCK }, accent: '#7c1df0', accent2: '#24074d', image: '/jerseys/fox.png', description: 'Purple and black jersey with a sharp fox mark.' },
  { id: 'p-pn08', sku: 'GG-PN08', name: 'Panthers Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 12, sizeStock: { ...DEFAULT_SHIRT_SIZE_STOCK }, accent: '#dc1266', accent2: '#61062c', image: '/jerseys/panthers.png', description: 'Pink performance jersey with a confident edge.' },
  { id: 'p-ph09', sku: 'GG-PH09', name: 'Phoenix Shirt', category: 'shirts', kind: 'shirt', price: 650, stock: 12, sizeStock: { ...DEFAULT_SHIRT_SIZE_STOCK }, accent: '#1246b3', accent2: '#071c52', image: '/jerseys/phoenix.png', description: 'Royal blue jersey with a flame-inspired crest.' },
]

export const seedCustomers: Customer[] = []

export const seedOrders: Order[] = []

export const seedPaymentMethods = ['GCash', 'MariBank', 'GoTyme', 'BPI']
export const defaultSettings: Settings = { storeName: 'Gee Graphics POS', taxRate: 6, receiptFooter: 'Thank you for supporting independent graphics.', soundEffects: true, compactMode: true, lightMode: false }

export const money = (value: number) => `₱${value.toFixed(2)}`
export const dateTime = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
export const dateOnly = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
