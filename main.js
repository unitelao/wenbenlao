const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

// 初始化存储
const store = new Store();
let windows = new Map();

// 配置 autoUpdater 日志（可选）
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

// 保存所有窗口状态
function saveWindowsState() {
    const state = [];
    for (let [id, data] of windows.entries()) {
        const win = data.win;
        if (!win.isDestroyed()) {
            state.push({
                id,
                bounds: win.getBounds(),
                tabs: data.tabs,
                activeTabId: data.activeTabId,
                type: data.type,
            });
        }
    }
    store.set('windowsState', state);
}

// 恢复窗口
function restoreWindows() {
    const saved = store.get('windowsState', []);
    if (saved.length === 0) {
        createWindow();
    } else {
        for (const state of saved) {
            createWindow({
                bounds: state.bounds,
                tabs: state.tabs,
                activeTabId: state.activeTabId,
                type: state.type,
            });
        }
    }
}

function createWindow(opts = {}) {
    const { bounds, tabs, activeTabId, type } = opts;
    const win = new BrowserWindow({
        width: bounds?.width || 1200,
        height: bounds?.height || 800,
        x: bounds?.x,
        y: bounds?.y,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        titleBarStyle: 'default',
        show: false,
    });

    const winId = win.id;
    const initialTabs = tabs || [{
        id: Date.now(),
        type: 'text',
        title: 'Untitled',
        content: '',
        filePath: null,
    }];

    windows.set(winId, {
        win,
        tabs: initialTabs,
        activeTabId: activeTabId || initialTabs[0].id,
        type: type || 'main',
    });

    const isDev = process.env.NODE_ENV === 'development';
    win.loadURL(
        isDev
            ? 'http://localhost:5173'
            : `file://${path.join(__dirname, 'dist/index.html')}`
    );

    win.once('ready-to-show', () => {
        win.show();
    });

    win.on('closed', () => {
        windows.delete(winId);
        saveWindowsState();
    });

    win.on('move', () => saveWindowsState());
    win.on('resize', () => saveWindowsState());

    win.webContents.once('did-finish-load', () => {
        win.webContents.send('init-window', {
            winId,
            tabs: initialTabs,
            activeTabId: initialTabs[0].id,
        });
    });

    saveWindowsState();
    return win;
}

// IPC 处理
ipcMain.handle('get-window-id', (event) => {
    return event.sender.id;
});

ipcMain.handle('get-window-data', (event) => {
    const winId = event.sender.id;
    const data = windows.get(winId);
    if (!data) return null;
    return {
        tabs: data.tabs,
        activeTabId: data.activeTabId,
    };
});

ipcMain.handle('update-window-data', (event, { tabs, activeTabId }) => {
    const winId = event.sender.id;
    const data = windows.get(winId);
    if (data) {
        data.tabs = tabs;
        data.activeTabId = activeTabId;
        saveWindowsState();
    }
});

ipcMain.handle('detach-tab', async (event, tabData) => {
    const sourceWinId = event.sender.id;
    const sourceData = windows.get(sourceWinId);
    if (!sourceData) return false;

    const sourceBounds = sourceData.win.getBounds();

    const newTabs = sourceData.tabs.filter(t => t.id !== tabData.id);
    let newActiveId = sourceData.activeTabId;
    if (sourceData.activeTabId === tabData.id) {
        newActiveId = newTabs[0]?.id || null;
    }
    sourceData.tabs = newTabs;
    sourceData.activeTabId = newActiveId;
    saveWindowsState();

    const sourceWin = sourceData.win;
    if (sourceWin && !sourceWin.isDestroyed()) {
        sourceWin.webContents.send('window-data-updated', {
            tabs: newTabs,
            activeTabId: newActiveId,
        });
    }

    const newWin = createWindow({
        bounds: sourceBounds,
        tabs: [tabData],
        activeTabId: tabData.id,
    });

    return newWin.id;
});

ipcMain.handle('merge-tab', async (event, { sourceWinId, targetWinId, tabData }) => {
    const sourceData = windows.get(sourceWinId);
    const targetData = windows.get(targetWinId);
    if (!sourceData || !targetData) return false;

    const newSourceTabs = sourceData.tabs.filter(t => t.id !== tabData.id);
    let sourceActiveId = sourceData.activeTabId;
    if (sourceData.activeTabId === tabData.id) {
        sourceActiveId = newSourceTabs[0]?.id || null;
    }
    sourceData.tabs = newSourceTabs;
    sourceData.activeTabId = sourceActiveId;

    const newTargetTabs = [...targetData.tabs, tabData];
    targetData.tabs = newTargetTabs;
    targetData.activeTabId = tabData.id;

    saveWindowsState();

    if (sourceData.win && !sourceData.win.isDestroyed()) {
        sourceData.win.webContents.send('window-data-updated', {
            tabs: newSourceTabs,
            activeTabId: sourceActiveId,
        });
    }
    if (targetData.win && !targetData.win.isDestroyed()) {
        targetData.win.webContents.send('window-data-updated', {
            tabs: newTargetTabs,
            activeTabId: tabData.id,
        });
    }
    return true;
});

ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'Text/Markdown', extensions: ['txt', 'md', 'json'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    if (!result.canceled && result.filePaths.length) {
        const filePath = result.filePaths[0];
        const content = fs.readFileSync(filePath, 'utf-8');
        return { filePath, content };
    }
    return null;
});

ipcMain.handle('save-file', async (event, { filePath, content }) => {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
});

ipcMain.handle('save-as', async (event, content) => {
    const result = await dialog.showSaveDialog({
        filters: [
            { name: 'Text', extensions: ['txt'] },
            { name: 'Markdown', extensions: ['md'] },
        ]
    });
    if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, content, 'utf-8');
        return result.filePath;
    }
    return null;
});

// 应用启动
app.whenReady().then(() => {
    restoreWindows();
    // 自动更新检查（生产环境且非开发模式）
    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
        autoUpdater.checkForUpdatesAndNotify();
    }
});

// 更新事件
autoUpdater.on('update-available', (info) => {
    console.log('发现新版本:', info.version);
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('更新已下载，即将安装...');
    autoUpdater.quitAndInstall();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
