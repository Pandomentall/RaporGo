import { basename } from 'node:path';
import { Menu, app, dialog, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import type { MenuCommand } from '../shared/api.js';
import type { Settings, ThemeChoice } from '../shared/settings.js';
import { mainStrings } from './i18n.js';

/**
 * The window's menu bar, in the app's language.
 *
 * Shortcuts the renderer already answers (Ctrl+N, Ctrl+O, Ctrl+E, Ctrl+Z…)
 * are shown here with `registerAccelerator: false`: the label tells the user
 * the key, the renderer keeps handling it — it knows whether the keyboard
 * belongs to a text field. A click sends the same command to the renderer.
 */

export type MenuState = {
  settings: Settings;
  /** A report is open; export and undo mean something. */
  hasDocument: boolean;
  recent: string[];
  isDev: boolean;
};

export type MenuHandlers = {
  send: (command: MenuCommand) => void;
  openRecent: (path: string) => void;
  setTheme: (theme: ThemeChoice) => void;
};

export function buildMenu(window: BrowserWindow, state: MenuState, handlers: MenuHandlers): void {
  const m = mainStrings(state.settings.language).menu;
  const shown = (accelerator: string): Partial<MenuItemConstructorOptions> => ({ accelerator, registerAccelerator: false });
  const command = (label: string, cmd: MenuCommand, accelerator?: string, enabled = true): MenuItemConstructorOptions => ({
    label,
    enabled,
    ...(accelerator ? shown(accelerator) : {}),
    click: () => handlers.send(cmd),
  });
  const theme = (label: string, value: ThemeChoice): MenuItemConstructorOptions => ({
    label,
    type: 'radio',
    checked: state.settings.theme === value,
    click: () => handlers.setTheme(value),
  });

  const template: MenuItemConstructorOptions[] = [
    {
      label: m.file,
      submenu: [
        command(m.newReport, 'new', 'CmdOrCtrl+N'),
        command(m.open, 'open', 'CmdOrCtrl+O'),
        {
          label: m.openRecent,
          submenu: state.recent.length
            ? state.recent.map((path) => ({ label: basename(path), sublabel: path, click: () => handlers.openRecent(path) }))
            : [{ label: m.noRecent, enabled: false }],
        },
        { type: 'separator' },
        command(m.exportPdf, 'export', 'CmdOrCtrl+E', state.hasDocument),
        { type: 'separator' },
        command(m.home, 'home', undefined, state.hasDocument),
        command(m.settings, 'settings', 'CmdOrCtrl+,'),
        { type: 'separator' },
        { label: m.quit, role: 'quit' },
      ],
    },
    {
      label: m.edit,
      submenu: [
        command(m.undo, 'undo', 'CmdOrCtrl+Z', state.hasDocument),
        command(m.redo, 'redo', 'CmdOrCtrl+Y', state.hasDocument),
        { type: 'separator' },
        { label: m.cut, role: 'cut' },
        { label: m.copy, role: 'copy' },
        { label: m.paste, role: 'paste' },
        { label: m.selectAll, role: 'selectAll' },
      ],
    },
    {
      label: m.view,
      submenu: [
        command(m.zoomIn, 'zoomIn', undefined, state.hasDocument),
        command(m.zoomOut, 'zoomOut', undefined, state.hasDocument),
        command(m.zoomFit, 'zoomFit', undefined, state.hasDocument),
        { type: 'separator' },
        { label: m.theme, submenu: [theme(m.themeSystem, 'system'), theme(m.themeLight, 'light'), theme(m.themeDark, 'dark')] },
        { type: 'separator' },
        { label: m.fullScreen, role: 'togglefullscreen' },
        ...(state.isDev
          ? ([
              { type: 'separator' },
              { label: m.reload, role: 'reload' },
              { label: m.devTools, role: 'toggleDevTools' },
            ] as MenuItemConstructorOptions[])
          : []),
      ],
    },
    {
      label: m.window,
      submenu: [
        { label: m.minimize, role: 'minimize' },
        { label: m.close, role: 'close' },
      ],
    },
    {
      label: m.help,
      submenu: [
        {
          label: m.about,
          click: () =>
            void dialog.showMessageBox(window, {
              type: 'info',
              title: m.about,
              message: `RaporGo ${app.getVersion()}`,
              detail: m.aboutDetail,
            }),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
