import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Several folders can be shown in the side bar: the root folder
// (`projectTree`) plus folders added next to it (`extraProjectTrees`).

const ipc = vi.hoisted(() => {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear()
    }
  })

  const listeners = new Map<string, (...args: unknown[]) => void>()
  const sent: unknown[][] = []
  const relative = (from: string, to: string): string => {
    if (to === from) return ''
    if (to.startsWith(`${from}/`)) return to.slice(from.length + 1)
    return `../${to}`
  }

  const w = globalThis as unknown as { window?: Record<string, unknown> }
  w.window ??= {}
  Object.assign(w.window, {
    marktext: { env: { windowId: 1 } },
    path: {
      sep: '/',
      normalize: (p: string) => p,
      basename: (p: string) => p.split('/').pop() ?? p,
      dirname: (p: string) => p.split('/').slice(0, -1).join('/') || '/',
      isAbsolute: (p: string) => p.startsWith('/'),
      relative
    },
    fileUtils: {
      hasMarkdownExtension: (n: string) => n.endsWith('.md'),
      pathExists: () => Promise.resolve(false),
      isSamePathSync: (a: string, b: string) => a === b
    },
    electron: {
      ipcRenderer: {
        send: (...args: unknown[]) => sent.push(args),
        on: (channel: string, listener: (...args: unknown[]) => void) => {
          listeners.set(channel, listener)
        }
      }
    }
  })
  return { listeners, sent }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))
vi.mock('@/store/bufferedState', () => ({
  debouncedSendBufferedState: vi.fn()
}))

import { useProjectStore } from '@/store/project'

const emitTreeEvent = (type: string, pathname: string): void => {
  ipc.listeners.get('mt::update-object-tree')?.({}, { type, change: { pathname } })
}

describe('side bar with several folders', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ipc.sent.length = 0
  })

  it('adds folders next to the root folder and ignores duplicates', () => {
    const store = useProjectStore()
    store.OPEN_PROJECT('/a')
    store.ADD_PROJECT_FOLDER('/b')
    store.ADD_PROJECT_FOLDER('/b')
    store.ADD_PROJECT_FOLDER('/a')

    expect(store.projectTree?.pathname).toBe('/a')
    expect(store.projectTrees.map((tree) => tree.pathname)).toEqual(['/a', '/b'])
  })

  it('opens the first added folder as the root folder', () => {
    const store = useProjectStore()
    store.ADD_PROJECT_FOLDER('/a')

    expect(store.projectTree?.pathname).toBe('/a')
    expect(store.extraProjectTrees).toEqual([])
  })

  it('routes watcher events to the folder that holds the path', () => {
    const store = useProjectStore()
    store.LISTEN_FOR_UPDATE_PROJECT()
    store.OPEN_PROJECT('/a')
    store.ADD_PROJECT_FOLDER('/b')

    emitTreeEvent('addDir', '/b/notes')
    emitTreeEvent('addDir', '/a/drafts')

    expect(store.extraProjectTrees[0]?.folders.map((f) => f.name)).toEqual(['notes'])
    expect(store.projectTree?.folders.map((f) => f.name)).toEqual(['drafts'])
  })

  it('keeps events for a folder that is not shown yet until it is added', () => {
    const store = useProjectStore()
    store.LISTEN_FOR_UPDATE_PROJECT()
    store.OPEN_PROJECT('/a')

    emitTreeEvent('addDir', '/b/early')
    expect(store.pendingTreeEvents).toHaveLength(1)

    store.ADD_PROJECT_FOLDER('/b')
    expect(store.pendingTreeEvents).toHaveLength(0)
    expect(store.extraProjectTrees[0]?.folders.map((f) => f.name)).toEqual(['early'])
  })

  it('promotes the next folder when the root folder is removed', () => {
    const store = useProjectStore()
    store.OPEN_PROJECT('/a')
    store.ADD_PROJECT_FOLDER('/b')
    store.CHANGE_ACTIVE_ITEM({ pathname: '/a/x.md', isFile: true, isDirectory: false })

    store.REMOVE_PROJECT_FOLDER('/a')

    expect(store.projectTree?.pathname).toBe('/b')
    expect(store.extraProjectTrees).toEqual([])
    expect(store.activeItem).toEqual({})
    expect(ipc.sent).toContainEqual(['mt::remove-project-folder', '/a'])
  })

  it('drops the added folders when another folder is opened', () => {
    const store = useProjectStore()
    store.OPEN_PROJECT('/a')
    store.ADD_PROJECT_FOLDER('/b')
    store.OPEN_PROJECT('/c')

    expect(store.projectTrees.map((tree) => tree.pathname)).toEqual(['/c'])
  })

  it('persists and restores the added folders', () => {
    const store = useProjectStore()
    store.OPEN_PROJECT('/a')
    store.ADD_PROJECT_FOLDER('/b')
    const state = store.CREATE_BUFFERED_STATE()
    expect(state).toEqual({ rootDirectory: '/a', extraDirectories: ['/b'] })

    setActivePinia(createPinia())
    const restored = useProjectStore()
    restored.RESTORE_BUFFERED_STATE(state)
    expect(restored.projectTrees.map((tree) => tree.pathname)).toEqual(['/a', '/b'])
  })
})
