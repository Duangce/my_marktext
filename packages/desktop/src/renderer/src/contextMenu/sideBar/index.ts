import {
  SEPARATOR,
  getNewFile,
  getNewDirectory,
  getCOPY,
  getCUT,
  getPASTE,
  getRENAME,
  getDELETE,
  getCopyPath,
  getShowInFolder,
  getAddFolder,
  getRemoveFolder
} from './menuItems'
import { popupContextMenu, type ContextMenuItem } from '../popupMenu'

export const showContextMenu = (
  event: { clientX: number; clientY: number },
  hasPathCache: boolean
): void => {
  const contextItems: ContextMenuItem[] = [
    getNewFile(),
    getNewDirectory(),
    SEPARATOR,
    getCOPY(),
    getCUT(),
    getPASTE(),
    SEPARATOR,
    getRENAME(),
    getDELETE(),
    SEPARATOR,
    getCopyPath(),
    getShowInFolder()
  ]

  // PASTE entry (index 5) toggles based on the cached source path.
  contextItems[5].enabled = hasPathCache

  popupContextMenu(bindClicks(contextItems), { x: event.clientX, y: event.clientY })
}

const bindClicks = (contextItems: ContextMenuItem[]): ContextMenuItem[] =>
  contextItems.map((item) => {
    if (!item || item.type === 'separator') return item
    const click = item.click
    return {
      ...item,
      click: click ? () => click(null, null) : undefined
    }
  })

/**
 * Menu of an opened folder's header row (`forFolder`), or of the shared
 * header shown when several folders are open, which only adds folders.
 */
export const showRootContextMenu = (
  event: { clientX: number; clientY: number },
  { hasPathCache, forFolder }: { hasPathCache: boolean; forFolder: boolean }
): void => {
  const paste: ContextMenuItem = { ...getPASTE(), enabled: hasPathCache }
  const contextItems: ContextMenuItem[] = forFolder
    ? [
        getNewFile(),
        getNewDirectory(),
        SEPARATOR,
        paste,
        SEPARATOR,
        getAddFolder(),
        getRemoveFolder(),
        SEPARATOR,
        getCopyPath(),
        getShowInFolder()
      ]
    : [getAddFolder()]

  popupContextMenu(bindClicks(contextItems), { x: event.clientX, y: event.clientY })
}
