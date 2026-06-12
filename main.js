const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

const store = new Store();
let windows = new Map();

autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

// ---------- 文件树持久化（独立文件 + store 备份） ----------
let userDataPath = null;
let fileTreePath = null;

function initFileTreePaths() {
    userDataPath = app.getPath('userData');
    fileTreePath = path.join(userDataPath, 'fileTree.json');
}

// 保存文件树到磁盘 + store
function saveFileTreeToDisk(tree) {
    if (!fileTreePath) initFileTreePaths();
    try {
        fs.writeFileSync(fileTreePath, JSON.stringify(tree, null, 2), 'utf-8');
        store.set('fileTree', tree);
        return true;
    } catch (err) {
        console.error('保存文件树失败', err);
        return false;
    }
}

// 从磁盘或 store 加载文件树（优先磁盘）
function loadFileTreeFromDisk() {
    if (!fileTreePath) initFileTreePaths();
    try {
        if (fs.existsSync(fileTreePath)) {
            const data = fs.readFileSync(fileTreePath, 'utf-8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('读取文件树文件失败', err);
    }
    // 尝试从旧的 store 迁移
    const oldTree = store.get('fileTree');
    if (oldTree && oldTree.length) {
        saveFileTreeToDisk(oldTree);
        return oldTree;
    }
    // 默认示例文档
    const defaultTree = [{
        title: '欢迎',
        key: 'welcome',
        isLeaf: true,
        content: '# 欢迎使用 wenbenLao\n\n双击文档节点打开编辑。\n\n你可以右键或点击加号创建文件夹和文档。',
        type: 'file',
    }];
    saveFileTreeToDisk(defaultTree);
    return defaultTree;
}

// ---------- 窗口状态管理 ----------
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
        title: 'wenbenLao',
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

// ---------- IPC 处理 ----------
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

// 文件树存储（使用独立文件，可靠持久化）
ipcMain.handle('get-file-tree', () => {
    return loadFileTreeFromDisk();
});

ipcMain.handle('save-file-tree', (event, tree) => {
    return saveFileTreeToDisk(tree);
});

// ---------- 应用启动 ----------
app.whenReady().then(() => {
    // 确保文件树路径已初始化（其实在第一次调用时也会初始化）
    initFileTreePaths();
    // 预保存一次默认文件树（如果不存在）
    loadFileTreeFromDisk();
    restoreWindows();
    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
        autoUpdater.checkForUpdatesAndNotify();
    }
});

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
