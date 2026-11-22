const DB_NAME = 'gee-pos-media'
const DB_VERSION = 2
const RECEIPT_STORE = 'receipts'
const RECORD_STORE = 'records'
const IDB_PREFIX = 'idb:'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(RECEIPT_STORE)) {
        db.createObjectStore(RECEIPT_STORE)
      }
      if (!db.objectStoreNames.contains(RECORD_STORE)) {
        db.createObjectStore(RECORD_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'))
  })
}

export function isIndexedDbImage(value?: string): boolean {
  return Boolean(value && value.startsWith(IDB_PREFIX))
}

export async function saveRecordBackup<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RECORD_STORE, 'readwrite')
      tx.objectStore(RECORD_STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Could not back up record'))
    })
    db.close()
  } catch {
    // Fallback gracefully if IndexedDB is blocked
  }
}

export async function loadRecordBackup<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb()
    const result = await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(RECORD_STORE, 'readonly')
      const req = tx.objectStore(RECORD_STORE).get(key)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => reject(req.error ?? new Error('Could not read record backup'))
    })
    db.close()
    return result
  } catch {
    return undefined
  }
}

export async function saveReceiptImage(blob: Blob, fixedKey?: string): Promise<string> {
  const id = fixedKey && fixedKey.startsWith(IDB_PREFIX)
    ? fixedKey
    : `${IDB_PREFIX}rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RECEIPT_STORE, 'readwrite')
    tx.objectStore(RECEIPT_STORE).put(blob, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not save receipt image'))
  })
  db.close()
  return id
}

export async function loadReceiptImageUrl(key?: string): Promise<string | null> {
  if (!key) return null
  if (!key.startsWith(IDB_PREFIX)) return key
  const db = await openDb()
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(RECEIPT_STORE, 'readonly')
    const req = tx.objectStore(RECEIPT_STORE).get(key)
    req.onsuccess = () => resolve(req.result as Blob | undefined)
    req.onerror = () => reject(req.error ?? new Error('Could not read receipt image'))
  })
  db.close()
  return blob ? URL.createObjectURL(blob) : null
}

export async function exportReceiptImages(keys: string[]): Promise<Record<string, string>> {
  const uniqueKeys = Array.from(new Set(keys.filter((key) => key.startsWith(IDB_PREFIX))))
  const out: Record<string, string> = {}
  if (!uniqueKeys.length) return out
  try {
    const db = await openDb()
    for (const key of uniqueKeys) {
      const blob = await new Promise<Blob | undefined>((resolve, reject) => {
        const tx = db.transaction(RECEIPT_STORE, 'readonly')
        const req = tx.objectStore(RECEIPT_STORE).get(key)
        req.onsuccess = () => resolve(req.result as Blob | undefined)
        req.onerror = () => reject(req.error)
      })
      if (blob) {
        out[key] = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(blob)
        })
      }
    }
    db.close()
  } catch {
    // Return any images successfully read
  }
  return out
}

export async function importReceiptImages(images?: Record<string, string>): Promise<void> {
  if (!images || typeof images !== 'object') return
  for (const [key, dataUrl] of Object.entries(images)) {
    if (!key.startsWith(IDB_PREFIX) || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) continue
    try {
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      await saveReceiptImage(blob, key)
    } catch {
      // Skip malformed image entries without aborting import
    }
  }
}

export async function deleteReceiptImage(key?: string): Promise<void> {
  if (!key || !key.startsWith(IDB_PREFIX)) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RECEIPT_STORE, 'readwrite')
    tx.objectStore(RECEIPT_STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not delete receipt image'))
  })
  db.close()
}

export async function clearReceiptImages(): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RECEIPT_STORE, 'readwrite')
      tx.objectStore(RECEIPT_STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Could not clear receipt images'))
    })
    db.close()
  } catch {
    // Ignore if IndexedDB is unavailable
  }
}
