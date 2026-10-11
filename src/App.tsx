import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import {
  ArrowRightIcon, ArrowUpIcon, BanknoteIcon, ChartIcon, CheckIcon, ChevronDownIcon,
  ClipboardIcon, CreditCardIcon, DownloadIcon, EditIcon, FilterIcon, HomeIcon,
  LogOutIcon, MenuIcon, MinusIcon, MoreIcon, PackageIcon, PlusIcon, PrinterIcon,
  ReceiptIcon, ScanIcon, SearchIcon, SendIcon, SettingsIcon, SparkIcon, TrashIcon,
  UserPlusIcon, UsersIcon, WalletIcon, XIcon,
} from './icons'
import {
  CATEGORY_LABELS, dateOnly, dateTime, defaultSettings, money, seedCustomers, seedOrders, seedPaymentMethods,
  seedProducts,
} from './data'
import type { CartLine, Customer, OnlinePaymentDetails, Order, PaymentMethod, Product, ProductCategory, ProductKind, Settings } from './data'

type Page = 'home' | 'products' | 'orders' | 'customers' | 'reports' | 'settings'
type CategoryFilter = ProductCategory | 'all'

const STORAGE = {
  products: 'gg-products-v2',
  cart: 'gg-cart-v1',
  customers: 'gg-customers-v1',
  orders: 'gg-orders-v1',
  settings: 'gg-settings-v2',
  paymentMethods: 'gg-payment-methods-v1',
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

function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => loadStored(key, fallback))
  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])
  return [value, setValue] as const
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function App() {
  const [page, setPage] = useState<Page>('home')
  const [products, setProducts] = useStored<Product[]>(STORAGE.products, seedProducts)
  const [cart, setCart] = useStored<CartLine[]>(STORAGE.cart, [])
  const [customers, setCustomers] = useStored<Customer[]>(STORAGE.customers, seedCustomers)
  const [orders, setOrders] = useStored<Order[]>(STORAGE.orders, seedOrders)
  const [settings, setSettings] = useStored<Settings>(STORAGE.settings, defaultSettings)
  const [paymentMethods, setPaymentMethods] = useStored<string[]>(STORAGE.paymentMethods, seedPaymentMethods)
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')
  const [payment, setPayment] = useState<PaymentMethod>('Cash')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [toast, setToast] = useState<string>('')
  const [receipt, setReceipt] = useState<Order | null>(null)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' })
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [onlinePayment, setOnlinePayment] = useState<OnlinePaymentDetails | undefined>()
  const [showOnlinePayment, setShowOnlinePayment] = useState(false)

  useEffect(() => {
    const cleanCatalog = products.filter((product) => product.category === 'shirts' || product.category === 'bandanas').map((product) => ({ ...product, price: 650 }))
    const changed = cleanCatalog.length !== products.length || cleanCatalog.some((product, index) => product.price !== products[index]?.price || product.id !== products[index]?.id)
    if (changed) setProducts(cleanCatalog)
  }, [products, setProducts])

  useEffect(() => {
    const validIds = new Set(products.map((product) => product.id))
    const cleanCart = cart.filter((line) => validIds.has(line.productId))
    if (cleanCart.length !== cart.length) setCart(cleanCart)
  }, [cart, products, setCart])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

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
  const goTo = (nextPage: Page) => {
    setPage(nextPage)
    setMobileCartOpen(false)
  }

  const addToCart = (productId: string) => {
    const product = products.find((item) => item.id === productId)
    if (!product) return
    const currentQty = cart.find((line) => line.productId === productId)?.quantity ?? 0
    if (currentQty >= product.stock) {
      notify(`${product.name} is at its available stock limit`)
      return
    }
    setCart((current) => current.some((line) => line.productId === productId)
      ? current.map((line) => line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line)
      : [...current, { productId, quantity: 1 }])
    notify(`${product.name} added to tab`)
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart((current) => current.flatMap((line) => {
      if (line.productId !== productId) return [line]
      const product = products.find((item) => item.id === productId)
      const next = line.quantity + delta
      if (!product || next <= 0) return []
      if (next > product.stock) {
        notify(`Only ${product.stock} left in stock`)
        return [line]
      }
      return [{ ...line, quantity: next }]
    }))
  }

  const removeFromCart = (productId: string) => setCart((current) => current.filter((line) => line.productId !== productId))

  const chargeCustomer = () => {
    if (!cartDetails.length) {
      notify('Add an item before charging the customer')
      return
    }
    if (payment === 'Online' && (!onlinePayment?.accountName.trim() || (!onlinePayment.referenceNumber.trim() && !onlinePayment.receiptImage))) {
      setShowOnlinePayment(true)
      notify('Complete the online payment details first')
      return
    }
    const customer = customers.find((item) => item.id === selectedCustomerId)
    const orderNumber = `#${1029 + orders.length}`
    const order: Order = {
      id: `o-${Date.now()}`,
      number: orderNumber,
      createdAt: new Date().toISOString(),
      items: cartDetails.map((line) => ({ productId: line.productId, productName: line.product.name, sku: line.product.sku, quantity: line.quantity, price: line.product.price })),
      subtotal,
      tax,
      total,
      paymentMethod: payment,
      onlinePayment: payment === 'Online' ? onlinePayment : undefined,
      customerId: customer?.id,
      customerName: customer?.name,
    }
    setOrders((current) => [order, ...current])
    setProducts((current) => current.map((product) => {
      const line = cart.find((item) => item.productId === product.id)
      return line ? { ...product, stock: Math.max(0, product.stock - line.quantity) } : product
    }))
    if (customer) {
      setCustomers((current) => current.map((item) => item.id === customer.id ? { ...item, orders: item.orders + 1, totalSpent: item.totalSpent + total } : item))
    }
    setCart([])
    setReceipt(order)
    setSelectedCustomerId('')
    setOnlinePayment(undefined)
    notify(`Sale ${orderNumber} complete`)
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
  }

  const resetStore = () => {
    if (!window.confirm('Reset the local catalog, orders, and settings to the seeded Gee Graphics demo?')) return
    setProducts(seedProducts)
    setCustomers(seedCustomers)
    setOrders(seedOrders)
    setCart([])
    setPaymentMethods(seedPaymentMethods)
    setSettings(defaultSettings)
    notify('Local POS data reset')
  }

  const updateSettings = (patch: Partial<Settings>) => setSettings((current) => ({ ...current, ...patch }))

  const navItems: Array<{ id: Page; label: string; icon: typeof HomeIcon }> = [
    { id: 'home', label: 'Home', icon: HomeIcon },
    { id: 'products', label: 'Products', icon: PackageIcon },
    { id: 'orders', label: 'Orders', icon: ReceiptIcon },
    { id: 'reports', label: 'Reports', icon: ChartIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ]

  return <div className={cx('app-shell', settings.compactMode && 'compact-mode')}>
    <div className="accent-orbit accent-orbit-one" />
    <div className="accent-orbit accent-orbit-two" />
    <aside className="sidebar">
      <div className="brand-lockup" onClick={() => goTo('home')} role="button" tabIndex={0}>
        <div className="brand-wordmark">gee<span>+</span><br />graphics</div>
        <div className="brand-grid-mark"><i /><i /><i /><i /></div>
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
      <button className="logout-button" onClick={() => notify('You are already working offline — no login required')}><LogOutIcon size={21} /><span>Log Out</span></button>
    </aside>

    <main className="main-column">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => notify('Use the navigation rail on desktop; your data is saved locally')}><MenuIcon size={22} /></button>
        <div className="crumbs"><span>Gee Graphics</span><b>/</b><strong>{page === 'home' ? 'Point of Sale' : navItems.find((item) => item.id === page)?.label}</strong></div>
        <div className="topbar-actions">
          <div className="shift-status"><span className="pulse-dot" /> Shift live <span className="shift-time">{new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date())}</span></div>
          <button className="avatar" onClick={() => goTo('settings')}>N</button>
        </div>
      </header>
      {page === 'home' && <DashboardPage products={filteredProducts} allProducts={products} category={category} setCategory={setCategory} search={search} setSearch={setSearch} addToCart={addToCart} goTo={goTo} todayRevenue={todayRevenue} todayOrders={todayOrders.length} lowStockCount={lowStockCount} />}
      {page === 'products' && <ProductsPage products={products} search={search} setSearch={setSearch} category={category} setCategory={setCategory} addToCart={addToCart} onEdit={setEditingProduct} />}
      {page === 'orders' && <OrdersPage orders={orders} />}
      {page === 'reports' && <ReportsPage orders={orders} products={products} />}
      {page === 'settings' && <SettingsPage settings={settings} updateSettings={updateSettings} onReset={resetStore} />}
    </main>

    {(page === 'home' || page === 'products') && <>
      <button className="mobile-cart-fab" onClick={() => setMobileCartOpen(true)}><ReceiptIcon size={20} /><span>{cart.length}</span><b>{money(total)}</b></button>
      <CartPanel cartDetails={cartDetails} subtotal={subtotal} tax={tax} total={total} payment={payment} onChooseCash={() => setPayment('Cash')} onChooseOnline={() => { setPayment('Online'); setShowOnlinePayment(true) }} onlinePayment={onlinePayment} customer={selectedCustomer} customers={customers} selectedCustomerId={selectedCustomerId} setSelectedCustomerId={setSelectedCustomerId} customerPickerOpen={customerPickerOpen} setCustomerPickerOpen={setCustomerPickerOpen} customerSearch={customerSearch} setCustomerSearch={setCustomerSearch} onAddCustomer={() => setShowCustomerForm(true)} updateQuantity={updateQuantity} removeFromCart={removeFromCart} chargeCustomer={chargeCustomer} mobileOpen={mobileCartOpen} setMobileOpen={setMobileCartOpen} />
    </>}

    {toast && <div className="toast"><span className="toast-icon"><CheckIcon size={16} /></span>{toast}</div>}
    {receipt && <ReceiptModal order={receipt} settings={settings} onClose={() => setReceipt(null)} />}
    {showOnlinePayment && <OnlinePaymentModal methods={paymentMethods} details={onlinePayment} onClose={() => { setShowOnlinePayment(false); if (!onlinePayment) setPayment('Cash') }} onAddMethod={(method) => setPaymentMethods((current) => current.includes(method) ? current : [...current, method])} onSave={(details) => { setOnlinePayment(details); setPayment('Online'); setShowOnlinePayment(false); notify(`${details.provider} payment details saved`) }} />}
    {showCustomerForm && <CustomerModal newCustomer={newCustomer} setNewCustomer={setNewCustomer} onClose={() => setShowCustomerForm(false)} onSubmit={addCustomer} />}
    {editingProduct && <ProductModal product={editingProduct} onClose={() => setEditingProduct(null)} onSave={(patch) => { setProducts((current) => current.map((item) => item.id === editingProduct.id ? { ...item, ...patch } : item)); setEditingProduct(null); notify('Product updated locally') }} />}
  </div>
}

function DashboardPage({ products, allProducts, category, setCategory, search, setSearch, addToCart, goTo, todayRevenue, todayOrders, lowStockCount }: { products: Product[]; allProducts: Product[]; category: CategoryFilter; setCategory: (value: CategoryFilter) => void; search: string; setSearch: (value: string) => void; addToCart: (id: string) => void; goTo: (page: Page) => void; todayRevenue: number; todayOrders: number; lowStockCount: number }) {
  const categories: Array<{ id: CategoryFilter; label: string; kind: ProductKind; visual: string }> = [
    { id: 'all', label: 'All', kind: 'shirt', visual: 'all' },
    { id: 'shirts', label: 'Shirts', kind: 'shirt', visual: 'shirt' },
    { id: 'bandanas', label: 'Bandanas', kind: 'bandana', visual: 'bandana' },
  ]
  const visible = category === 'all' ? products : products
  const sections = category === 'all' ? (['shirts', 'bandanas'] as ProductCategory[]) : [category]
  return <div className="page-content dashboard-page">
    <div className="welcome-row">
      <div><div className="eyebrow"><span className="eyebrow-line" /> Saturday, October 11, 2026</div><h1>Run the floor<span className="red-dot">.</span></h1><p>Make the next sale the best one yet.</p></div>
      <div className="quick-stats"><div className="quick-stat"><span>Today’s sales</span><strong>{money(todayRevenue)}</strong><small className={todayRevenue ? 'muted-stat' : 'warn-stat'}>{todayRevenue ? 'live' : 'No sales yet'}</small></div><div className="quick-stat"><span>Transactions</span><strong>{todayOrders}</strong><small className="muted-stat">active shift</small></div><div className="quick-stat"><span>Low stock</span><strong>{lowStockCount}</strong><small className="warn-stat">needs attention</small></div></div>
    </div>
    <div className="catalog-toolbar">
      <div className="section-title-row"><div><span className="eyebrow">Browse the drop</span><h2>Choose <em>Category</em></h2></div><div className="catalog-controls"><div className="filter-chips">{categories.map((item) => <button key={item.id} className={cx(category === item.id && 'active')} onClick={() => setCategory(item.id)}>{item.label}</button>)}</div><div className="search-box"><SearchIcon size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products..." /><kbd>⌘ K</kbd></div></div></div>
      <div className="category-strip">{categories.map((item) => <button key={item.id} className={cx('category-card', category === item.id && 'selected')} onClick={() => setCategory(item.id)}><div className="category-visual"><ProductArt kind={item.kind} accent={item.id === 'all' ? '#f4f3f4' : allProducts.find((product) => product.category === item.id)?.accent ?? '#ed1d2d'} accent2={item.id === 'all' ? '#ed1d2d' : allProducts.find((product) => product.category === item.id)?.accent2 ?? '#121318'} small={item.id === 'all'} /></div><span>{item.label}</span>{category === item.id && <i className="category-active-dot" />}</button>)}</div>
    </div>
    <div className="catalog-sections">{sections.map((section) => {
      const sectionProducts = visible.filter((product) => product.category === section)
      if (!sectionProducts.length) return null
      return <section className="catalog-section" key={section}><div className="section-heading"><div><h3>{CATEGORY_LABELS[section]}</h3><span>{sectionProducts.length} items · ready to sell</span></div><button onClick={() => { setCategory(section); goTo('products') }}>View all <ArrowRightIcon size={16} /></button></div><div className="product-grid">{sectionProducts.slice(0, section === 'shirts' ? sectionProducts.length : 5).map((product) => <ProductCard key={product.id} product={product} onAdd={addToCart} />)}</div></section>
    })}</div>
  </div>
}

function ProductsPage({ products, search, setSearch, category, setCategory, addToCart, onEdit }: { products: Product[]; search: string; setSearch: (value: string) => void; category: CategoryFilter; setCategory: (value: CategoryFilter) => void; addToCart: (id: string) => void; onEdit: (product: Product) => void }) {
  const shown = products.filter((product) => (category === 'all' || product.category === category) && (!search || `${product.name} ${product.sku}`.toLowerCase().includes(search.toLowerCase())))
  return <div className="page-content listing-page"><PageIntro eyebrow="Catalog control" title="Products" description="Manage the drop, pricing and on-hand inventory." action={<button className="ghost-button" onClick={() => setCategory('all')}><PackageIcon size={16} /> {products.length} SKUs</button>} /><div className="list-toolbar"><div className="search-box"><SearchIcon size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by product or SKU" /></div><div className="filter-pills">{(['all', 'shirts', 'bandanas'] as CategoryFilter[]).map((value) => <button key={value} className={cx(category === value && 'active')} onClick={() => setCategory(value)}>{CATEGORY_LABELS[value]}</button>)}</div><button className="icon-button"><FilterIcon size={18} /></button></div><div className="product-admin-grid">{shown.map((product) => <article className="admin-product-card" key={product.id} onClick={() => addToCart(product.id)}><div className="admin-product-art"><ProductArt kind={product.kind} accent={product.accent} accent2={product.accent2} /></div><div className="admin-product-info"><span className="product-category-tag">{CATEGORY_LABELS[product.category]}</span><h3>{product.name}</h3><p>{product.sku}</p><div className="admin-product-bottom"><strong>{money(product.price)}</strong><span className={cx('stock-badge', product.stock < 10 && 'low')}>{product.stock} in stock</span></div></div><button className="card-edit" onClick={(event) => { event.stopPropagation(); onEdit(product) }} aria-label={`Edit ${product.name}`}><EditIcon size={16} /></button></article>)}</div></div>
}

function OrdersPage({ orders }: { orders: Order[] }) {
  return <div className="page-content listing-page"><PageIntro eyebrow="Sales ledger" title="Orders" description="Every sale from this browser, kept right here on this device." action={<button className="ghost-button"><DownloadIcon size={16} /> Export CSV</button>} /><div className="order-summary-strip"><SummaryPill label="Gross sales" value={money(orders.reduce((sum, order) => sum + order.total, 0))} /><SummaryPill label="Transactions" value={String(orders.length)} /><SummaryPill label="Average ticket" value={money(orders.length ? orders.reduce((sum, order) => sum + order.total, 0) / orders.length : 0)} /></div><div className="table-card"><div className="table-toolbar"><strong>Recent orders</strong><button className="icon-button"><MoreIcon size={19} /></button></div><div className="orders-table"><div className="table-head"><span>Order</span><span>Customer</span><span>Items</span><span>Payment</span><span>Date</span><span>Total</span></div>{orders.map((order) => <div className="table-row" key={order.id}><strong>{order.number}</strong><span>{order.customerName || 'Walk-in customer'}</span><span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} items</span><span><PaymentBadge method={order.paymentMethod} /></span><span>{dateTime(order.createdAt)}</span><strong>{money(order.total)}</strong></div>)}</div></div></div>
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
  return <div className="page-content listing-page"><PageIntro eyebrow="Signals, not spreadsheets" title="Reports" description="A clear read on the local sales data in your POS." action={<button className="ghost-button"><PrinterIcon size={16} /> Print report</button>} /><div className="report-hero"><div><span className="eyebrow">All-time gross sales</span><strong>{money(gross)}</strong><p><span className={cx('green-copy', gross === 0 && 'muted-stat')}>{gross === 0 ? 'Ready for first sale' : '+14.2%'}</span> compared to last period</p></div><div className="sparkline"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><span /></div></div><div className="report-grid"><div className="panel-card"><div className="panel-heading"><div><span className="eyebrow">Revenue mix</span><h3>Payment methods</h3></div><MoreIcon size={19} /></div><div className="payment-bars"><PaymentBar label="Cash" value={cash} color="red" total={gross || 1} icon={<BanknoteIcon size={17} />} /><PaymentBar label="Online" value={online} color="violet" total={gross || 1} icon={<WalletIcon size={17} />} /></div></div><div className="panel-card inventory-panel"><div className="panel-heading"><div><span className="eyebrow">Inventory lens</span><h3>Stock on hand</h3></div><PackageIcon size={19} /></div><div className="stock-list">{inventory.map((product) => <div className="stock-line" key={product.id}><ProductArt kind={product.kind} accent={product.accent} accent2={product.accent2} tiny /><div><strong>{product.name}</strong><span>{product.sku}</span></div><b className={cx(product.stock < 10 && 'low')}>{product.stock}</b></div>)}</div></div></div></div>
}

function SettingsPage({ settings, updateSettings, onReset }: { settings: Settings; updateSettings: (patch: Partial<Settings>) => void; onReset: () => void }) {
  return <div className="page-content listing-page settings-page"><PageIntro eyebrow="Make it yours" title="Settings" description="Your preferences stay in this browser and nowhere else." /><div className="settings-grid"><section className="settings-card"><div className="panel-heading"><div><span className="eyebrow">Store profile</span><h3>Identity & receipts</h3></div><SparkIcon size={19} /></div><label className="field-label">Store name<input value={settings.storeName} onChange={(event) => updateSettings({ storeName: event.target.value })} /></label><label className="field-label">Tax rate <span className="input-suffix"><input type="number" min="0" max="30" step="0.1" value={settings.taxRate} onChange={(event) => updateSettings({ taxRate: Number(event.target.value) || 0 })} /> %</span></label><label className="field-label">Receipt footer<textarea rows={3} value={settings.receiptFooter} onChange={(event) => updateSettings({ receiptFooter: event.target.value })} /></label></section><section className="settings-card"><div className="panel-heading"><div><span className="eyebrow">Experience</span><h3>POS preferences</h3></div><SettingsIcon size={19} /></div><ToggleRow label="Sound effects" description="Play short feedback cues while selling." value={settings.soundEffects} onChange={(value) => updateSettings({ soundEffects: value })} /><ToggleRow label="Compact mode" description="Fit more products on smaller screens." value={settings.compactMode} onChange={(value) => updateSettings({ compactMode: value })} /><div className="settings-note"><WalletIcon size={18} /><div><strong>Local-only mode</strong><p>Orders, catalog, payment methods and settings are saved in localStorage on this device.</p></div></div></section><section className="settings-card danger-zone"><div className="panel-heading"><div><span className="eyebrow">Fresh start</span><h3>Reset local data</h3></div><TrashIcon size={19} /></div><p>Restore the original Gee Graphics demo catalog and clear sales added during this session.</p><button className="danger-button" onClick={onReset}>Reset POS data</button></section></div></div>
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-intro"><div><span className="eyebrow"><span className="eyebrow-line" /> {eyebrow}</span><h1>{title}<span className="red-dot">.</span></h1><p>{description}</p></div>{action}</div>
}

function SummaryPill({ label, value }: { label: string; value: string }) { return <div className="summary-pill"><span>{label}</span><strong>{value}</strong></div> }

function ProductCard({ product, onAdd }: { product: Product; onAdd: (id: string) => void }) {
  return <article className="product-card" onClick={() => onAdd(product.id)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onAdd(product.id) } }}><div className="product-art-wrap"><ProductArt kind={product.kind} accent={product.accent} accent2={product.accent2} /><span className="product-price">{money(product.price)}</span>{product.stock < 10 && <span className="stock-ribbon">Low stock</span>}</div><div className="product-card-copy"><div><h4>{product.name}</h4><span>{product.sku}</span></div></div><div className="product-card-meta"><span>{product.stock} in stock</span><span className="product-category-tag">{CATEGORY_LABELS[product.category]}</span></div></article>
}

function ProductArt({ kind, accent, accent2, small = false, tiny = false }: { kind: ProductKind; accent: string; accent2: string; small?: boolean; tiny?: boolean }) {
  const style = { '--product-accent': accent, '--product-accent-2': accent2 } as CSSProperties
  if (kind === 'bandana') return <div className={cx('product-art', 'bandana-art', small && 'small-art', tiny && 'tiny-art')} style={style}><div className="bandana-diamond"><span>88</span></div><i className="bandana-fold" /></div>
  if (kind === 'cap') return <div className={cx('product-art', 'cap-art', tiny && 'tiny-art')} style={style}><div className="cap-crown"><span>GG</span></div><div className="cap-brim" /></div>
  if (kind === 'sticker') return <div className={cx('product-art', 'sticker-art', tiny && 'tiny-art')} style={style}><b>G</b><span>GG+</span></div>
  if (kind === 'hoodie') return <div className={cx('product-art', 'hoodie-art', tiny && 'tiny-art')} style={style}><div className="hoodie-body"><i /><span>GG+</span></div></div>
  return <div className={cx('product-art', 'shirt-art', kind === 'set' && 'set-art', tiny && 'tiny-art')} style={style}><div className="shirt-back" /><div className="shirt-body"><i className="shirt-sleeve left" /><i className="shirt-sleeve right" /><div className="shirt-neck" /><span>{kind === 'set' ? 'SET' : '88'}</span></div>{kind === 'set' && <div className="mini-bandana" />}</div>
}

function CartPanel({ cartDetails, subtotal, tax, total, payment, onChooseCash, onChooseOnline, onlinePayment, customer, customers, selectedCustomerId, setSelectedCustomerId, customerPickerOpen, setCustomerPickerOpen, customerSearch, setCustomerSearch, onAddCustomer, updateQuantity, removeFromCart, chargeCustomer, mobileOpen, setMobileOpen }: { cartDetails: Array<CartLine & { product: Product }>; subtotal: number; tax: number; total: number; payment: PaymentMethod; onChooseCash: () => void; onChooseOnline: () => void; onlinePayment?: OnlinePaymentDetails; customer?: Customer; customers: Customer[]; selectedCustomerId: string; setSelectedCustomerId: (value: string) => void; customerPickerOpen: boolean; setCustomerPickerOpen: (value: boolean) => void; customerSearch: string; setCustomerSearch: (value: string) => void; onAddCustomer: () => void; updateQuantity: (id: string, delta: number) => void; removeFromCart: (id: string) => void; chargeCustomer: () => void; mobileOpen: boolean; setMobileOpen: (value: boolean) => void }) {
  const customerResults = customers.filter((item) => item.name.toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 4)
  return <aside className={cx('checkout-panel', mobileOpen && 'mobile-open')}>
    <div className="checkout-header">
      <div><span className="tab-kicker">Tab #1</span><h2>Current sale</h2></div>
      <div className="checkout-actions"><button title="Send receipt"><SendIcon size={17} /></button><button title="Print receipt"><PrinterIcon size={17} /></button><button className="close-cart" onClick={() => setMobileOpen(false)}><XIcon size={20} /></button></div>
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
    <div className="order-items-heading"><span>Order items <b>{cartDetails.reduce((sum, line) => sum + line.quantity, 0)}</b></span><button onClick={() => cartDetails.forEach((line) => removeFromCart(line.product.id))}>Clear all</button></div>
    <div className="cart-items">
      {cartDetails.length === 0 ? <div className="empty-cart"><div className="empty-cart-mark"><ReceiptIcon size={23} /></div><h3>Your tab is clear</h3><p>Add a product to get the floor moving.</p></div> : cartDetails.map((line) => <div className="cart-item" key={line.product.id}>
        <div className="cart-item-art"><ProductArt kind={line.product.kind} accent={line.product.accent} accent2={line.product.accent2} tiny /></div>
        <div className="cart-item-copy"><strong>{line.product.name}</strong><span>{line.product.sku}</span><div className="qty-control"><button onClick={() => updateQuantity(line.product.id, -1)}><MinusIcon size={13} /></button><b>{line.quantity}</b><button onClick={() => updateQuantity(line.product.id, 1)}><PlusIcon size={13} /></button></div></div>
        <div className="cart-item-price"><strong>{money(line.product.price * line.quantity)}</strong><button onClick={() => removeFromCart(line.product.id)}><TrashIcon size={14} /></button></div>
      </div>)}
    </div>
    <div className="totals"><div><span>Sub total</span><strong>{money(subtotal)}</strong></div><div><span>Tax ({tax === 0 ? '0' : ((tax / Math.max(subtotal, 1)) * 100).toFixed(0)}%)</span><strong>{money(tax)}</strong></div><div className="grand-total"><span>Total</span><strong>{money(total)}</strong></div></div>
    <div className="payment-section"><div className="payment-title"><span>Payment method</span><button><MoreIcon size={17} /></button></div><div className="payment-methods"><button className={cx('payment-method', payment === 'Cash' && 'selected')} onClick={onChooseCash}><BanknoteIcon size={21} /><span>Cash</span></button><button className={cx('payment-method', payment === 'Online' && 'selected')} onClick={onChooseOnline}><WalletIcon size={21} /><span>Online</span>{onlinePayment && <small className="payment-ready">{onlinePayment.provider} ready</small>}</button></div></div>
    <button className="charge-button" onClick={chargeCustomer}><span>Charge customer {money(total)}</span><span className="charge-arrow"><ArrowRightIcon size={19} /></span></button>
  </aside>
}

function PaymentBadge({ method }: { method: PaymentMethod }) { return <span className={cx('payment-badge', method.toLowerCase())}>{method}</span> }

function PaymentBar({ label, value, total, color, icon }: { label: string; value: number; total: number; color: string; icon: ReactNode }) { const percent = Math.min(100, (value / Math.max(total, 1)) * 100); return <div className="payment-bar"><div className="payment-bar-label"><span>{icon} {label}</span><strong>{money(value)}</strong></div><div className="bar-track"><i className={color} style={{ width: `${percent}%` }} /></div></div> }

function ToggleRow({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (value: boolean) => void }) { return <div className="toggle-row"><div><strong>{label}</strong><p>{description}</p></div><button className={cx('toggle', value && 'on')} onClick={() => onChange(!value)} aria-label={`Toggle ${label}`}><i /></button></div> }

function ReceiptModal({ order, settings, onClose }: { order: Order; settings: Settings; onClose: () => void }) { return <div className="modal-backdrop"><div className="receipt-modal"><div className="success-ring"><CheckIcon size={27} /></div><span className="eyebrow">Payment captured</span><h2>Nice work<span className="red-dot">.</span></h2><p>Sale {order.number} is complete and saved on this device.</p><div className="receipt-total"><span>Total charged</span><strong>{money(order.total)}</strong><PaymentBadge method={order.paymentMethod} />{order.onlinePayment && <small className="receipt-payment-detail">{order.onlinePayment.provider} · {order.onlinePayment.referenceNumber || "receipt attached"} · {order.onlinePayment.accountName}</small>}</div><div className="receipt-lines">{order.items.map((item) => <div key={item.productId}><span>{item.quantity} × {item.productName}</span><strong>{money(item.price * item.quantity)}</strong></div>)}</div><p className="receipt-footer">{settings.receiptFooter}</p><div className="modal-actions"><button className="ghost-button" onClick={onClose}>Close</button><button className="primary-button" onClick={() => window.print()}><PrinterIcon size={16} /> Print receipt</button></div></div></div> }

function CustomerModal({ newCustomer, setNewCustomer, onClose, onSubmit }: { newCustomer: { name: string; email: string; phone: string }; setNewCustomer: (value: { name: string; email: string; phone: string }) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) { return <div className="modal-backdrop"><form className="form-modal" onSubmit={onSubmit}><button type="button" className="modal-close" onClick={onClose}><XIcon size={19} /></button><span className="eyebrow">Add to the crew</span><h2>New customer<span className="red-dot">.</span></h2><p>Keep the relationship local, keep the checkout moving.</p><label className="field-label">Name<input autoFocus required value={newCustomer.name} onChange={(event) => setNewCustomer({ ...newCustomer, name: event.target.value })} placeholder="Full name" /></label><label className="field-label">Email<input type="email" value={newCustomer.email} onChange={(event) => setNewCustomer({ ...newCustomer, email: event.target.value })} placeholder="name@example.com" /></label><label className="field-label">Phone<input value={newCustomer.phone} onChange={(event) => setNewCustomer({ ...newCustomer, phone: event.target.value })} placeholder="(555) 000-0000" /></label><div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><UserPlusIcon size={16} /> Save customer</button></div></form></div> }

function ProductModal({ product, onClose, onSave }: { product: Product; onClose: () => void; onSave: (patch: Partial<Product>) => void }) { const [stock, setStock] = useState(product.stock); const [price, setPrice] = useState(product.price); return <div className="modal-backdrop"><form className="form-modal" onSubmit={(event) => { event.preventDefault(); onSave({ stock, price }) }}><button type="button" className="modal-close" onClick={onClose}><XIcon size={19} /></button><span className="eyebrow">Catalog edit</span><h2>{product.name}</h2><p>{product.sku} · {CATEGORY_LABELS[product.category]}</p><label className="field-label">Price<input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(Number(event.target.value))} /></label><label className="field-label">Stock on hand<input type="number" min="0" step="1" value={stock} onChange={(event) => setStock(Number(event.target.value))} /></label><div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><CheckIcon size={16} /> Save changes</button></div></form></div> }

export default App


function OnlinePaymentModal({ methods, details, onClose, onAddMethod, onSave }: { methods: string[]; details?: OnlinePaymentDetails; onClose: () => void; onAddMethod: (method: string) => void; onSave: (details: OnlinePaymentDetails) => void }) {
  const [provider, setProvider] = useState(details?.provider ?? methods[0] ?? 'GCash')
  const [accountName, setAccountName] = useState(details?.accountName ?? '')
  const [referenceNumber, setReferenceNumber] = useState(details?.referenceNumber ?? '')
  const [receiptImage, setReceiptImage] = useState(details?.receiptImage ?? '')
  const [newMethod, setNewMethod] = useState('')
  const [error, setError] = useState('')

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!accountName.trim()) {
      setError('Enter the account name used for the payment.')
      return
    }
    if (!referenceNumber.trim() && !receiptImage) {
      setError('Add a reference number or take a photo of the receipt.')
      return
    }
    onSave({ provider, accountName: accountName.trim(), referenceNumber: referenceNumber.trim(), receiptImage: receiptImage || undefined })
  }

  const addMethod = () => {
    const clean = newMethod.trim()
    if (!clean) return
    onAddMethod(clean)
    setProvider(clean)
    setNewMethod('')
  }

  return <div className="modal-backdrop"><form className="online-payment-modal" onSubmit={save}>
    <button type="button" className="modal-close" onClick={onClose}><XIcon size={19} /></button>
    <div className="online-modal-icon"><WalletIcon size={22} /></div>
    <span className="eyebrow">Payment details</span>
    <h2>Online payment<span className="red-dot">.</span></h2>
    <p>Record the transfer before charging this tab.</p>
    <div className="provider-label"><span>Choose provider</span><small>saved locally</small></div>
    <div className="provider-grid">{methods.map((method) => <button type="button" key={method} className={cx('provider-chip', provider === method && 'selected')} onClick={() => setProvider(method)}>{method}<i>{provider === method ? <CheckIcon size={12} /> : null}</i></button>)}</div>
    <div className="add-provider-row"><input value={newMethod} onChange={(event) => setNewMethod(event.target.value)} placeholder="Add another method" /><button type="button" onClick={addMethod}><PlusIcon size={15} /> Add</button></div>
    <label className="field-label">Account name<input autoFocus value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Name shown on the account" /></label>
    <label className="field-label">Reference number <span className="optional-label">or attach receipt below</span><input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="e.g. GC-2819-7712" /></label>
    <div className="receipt-upload"><input id="receipt-photo" type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setReceiptImage(String(reader.result)); reader.readAsDataURL(file) }} /><label htmlFor="receipt-photo" className={cx('receipt-upload-label', receiptImage && 'has-receipt')}><span className="camera-glyph">{receiptImage ? <CheckIcon size={18} /> : <ScanIcon size={18} />}</span><span><strong>{receiptImage ? 'Receipt photo attached' : 'Take a photo of receipt'}</strong><small>{receiptImage ? 'Tap to replace the image' : 'Optional if you have a reference number'}</small></span><ArrowRightIcon size={16} /></label></div>
    {error && <div className="form-error">{error}</div>}
    <div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><CheckIcon size={16} /> Save payment</button></div>
  </form></div>
}
