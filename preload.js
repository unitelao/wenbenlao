const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口信息
  getWindowId: () => ipcRenderer.invoke('get-window-id'),
  getWindowData: () => ipcRenderer.invoke('get-window-data'),
  updateWindowData: (data) => ipcRenderer.invoke('update-window-data', data),
  
  // 标签页操作
  detachTab: (tabData) => ipcRenderer.invoke('detach-tab', tabData),
  mergeTab: (sourceWinId, targetWinId, tabData) => ipcRenderer.invoke('merge-tab', { sourceWinId, targetWinId, tabData }),
  
  // 文件操作
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', { filePath, content }),
  saveAs: (content) => ipcRenderer.invoke('save-as', content),
  
  // 事件监听
  onInitWindow: (callback) => ipcRenderer.on('init-window', (event, data) => callback(data)),
  onWindowDataUpdated: (callback) => ipcRenderer.on('window-data-updated', (event, data) => callback(data)),
  
  // 新增文件树相关
  getFileTree: () => ipcRenderer.invoke('get-file-tree'),
  saveFileTree: (tree) => ipcRenderer.invoke('save-file-tree', tree),
});
