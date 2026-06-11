import React, { useState, useEffect, useCallback, useRef } from 'react';
import TabBar from './components/TabBar';
import TextEditor from './components/TextEditor';
import MindMap from './components/MindMap';
import { message } from 'antd';

const App = () => {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [windowId, setWindowId] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const dragSourceRef = useRef(null);

  // 初始化：从主进程获取窗口数据
  useEffect(() => {
    window.electronAPI.getWindowId().then(id => {
      setWindowId(id);
    });
    window.electronAPI.getWindowData().then(data => {
      if (data) {
        setTabs(data.tabs);
        setActiveTabId(data.activeTabId);
      }
      setIsInitialized(true);
    });
    window.electronAPI.onInitWindow((data) => {
      setWindowId(data.winId);
      setTabs(data.tabs);
      setActiveTabId(data.activeTabId);
    });
    window.electronAPI.onWindowDataUpdated((data) => {
      setTabs(data.tabs);
      setActiveTabId(data.activeTabId);
    });
  }, []);

  // 自动保存窗口状态到主进程
  useEffect(() => {
    if (!isInitialized) return;
    window.electronAPI.updateWindowData({ tabs, activeTabId });
  }, [tabs, activeTabId, isInitialized]);

  // 添加新标签页
  const addTab = (type, title = 'Untitled', content = '') => {
    const newTab = {
      id: Date.now(),
      type,
      title,
      content: type === 'text' ? content : '',
      nodes: type === 'mindmap' ? [] : undefined,
      edges: type === 'mindmap' ? [] : undefined,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  // 关闭标签页
  const closeTab = (tabId) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(newTabs[0]?.id || null);
      }
      return newTabs;
    });
  };

  // 分离标签页（拖出成独立窗口）
  const detachTab = async (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    // 调用主进程分离
    const newWindowId = await window.electronAPI.detachTab(tab);
    if (newWindowId) {
      // 从当前窗口移除标签页（主进程会更新当前窗口，但为了立即响应，手动移除）
      setTabs(prev => prev.filter(t => t.id !== tabId));
      if (activeTabId === tabId) {
        setActiveTabId(tabs.filter(t => t.id !== tabId)[0]?.id || null);
      }
      message.success('已分离到新窗口');
    }
  };

  // 跨窗口合并：当用户将标签页拖到另一个窗口时调用（由 TabBar 组件触发）
  const mergeToWindow = async (tabId, targetWindowId) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    const success = await window.electronAPI.mergeTab(windowId, targetWindowId, tab);
    if (success) {
      setTabs(prev => prev.filter(t => t.id !== tabId));
      message.success('已合并到目标窗口');
    } else {
      message.error('合并失败');
    }
  };

  const updateTabContent = (tabId, newContent) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, content: newContent } : tab
    ));
  };

  const updateMindMapData = (tabId, nodes, edges) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, nodes, edges } : tab
    ));
  };

  const activeTab = tabs.find(t => t.id === activeTabId);

  if (!isInitialized) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TabBar
        tabs={tabs}
        activeId={activeTabId}
        onSelect={setActiveTabId}
        onClose={closeTab}
        onDetach={detachTab}
        onNewText={() => addTab('text', 'Untitled', '')}
        onNewMindMap={() => addTab('mindmap', 'New Mind Map', '')}
        onMergeToWindow={mergeToWindow}
        windowId={windowId}
      />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab && activeTab.type === 'text' && (
          <TextEditor
            key={activeTab.id}
            content={activeTab.content || ''}
            onChange={(val) => updateTabContent(activeTab.id, val)}
            filePath={activeTab.filePath}
            onSaveAs={async (content) => {
              const newPath = await window.electronAPI.saveAs(content);
              if (newPath) {
                updateTabContent(activeTab.id, content);
                setTabs(prev => prev.map(tab =>
                  tab.id === activeTab.id ? { ...tab, filePath: newPath, title: newPath.split(/[/\\]/).pop() } : tab
                ));
              }
            }}
          />
        )}
        {activeTab && activeTab.type === 'mindmap' && (
          <MindMap
            key={activeTab.id}
            initialNodes={activeTab.nodes || []}
            initialEdges={activeTab.edges || []}
            onChange={(nodes, edges) => updateMindMapData(activeTab.id, nodes, edges)}
            title={activeTab.title}
            onTitleChange={(newTitle) => {
              setTabs(prev => prev.map(tab =>
                tab.id === activeTab.id ? { ...tab, title: newTitle } : tab
              ));
            }}
          />
        )}
      </div>
    </div>
  );
};

export default App;