import React, { useState, useEffect } from 'react';
import { Layout, Button } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, FileOutlined } from '@ant-design/icons';
import TabBar from './components/TabBar';
import TextEditor from './components/TextEditor';
import MindMap from './components/MindMap';
import FileTree from './components/FileTree';
import { message } from 'antd';

const { Sider, Content } = Layout;

const App = () => {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [windowId, setWindowId] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [fileTreeData, setFileTreeData] = useState([]);
  const [collapsed, setCollapsed] = useState(false);

  // 加载文件树
  useEffect(() => {
    window.electronAPI.getFileTree().then(tree => {
      if (tree && tree.length) {
        setFileTreeData(tree);
      } else {
        // 初始化示例文档
        setFileTreeData([{
          title: '欢迎',
          key: 'welcome',
          isLeaf: true,
          icon: <FileOutlined />,
          content: '# 欢迎使用 wenbenLao\n\n双击文档节点打开编辑。\n\n你可以右键或点击加号创建文件夹和文档。',
          type: 'file',
        }]);
      }
    });
  }, []);

  // 保存文件树
  useEffect(() => {
    if (isInitialized) {
      window.electronAPI.saveFileTree(fileTreeData);
    }
  }, [fileTreeData, isInitialized]);

  useEffect(() => {
  window.electronAPI.getFileTree().then(tree => {
    console.log('加载文件树:', tree);
    if (tree && tree.length) {
      setFileTreeData(tree);
    } else {
      setFileTreeData([/* 默认欢迎文档 */]);
    }
  }).catch(err => console.error('加载失败', err));
}, []);

useEffect(() => {
  if (isInitialized) {
    console.log('保存文件树:', fileTreeData);
    window.electronAPI.saveFileTree(fileTreeData).catch(err => console.error('保存失败', err));
  }
}, [fileTreeData, isInitialized]);

  // 窗口初始化
  useEffect(() => {
    window.electronAPI.getWindowId().then(id => setWindowId(id));
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

  // 保存窗口状态
  useEffect(() => {
    if (!isInitialized) return;
    window.electronAPI.updateWindowData({ tabs, activeTabId });
  }, [tabs, activeTabId, isInitialized]);

  // 窗口标题显示当前文档名
  useEffect(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab) {
      document.title = `wenbenLao - ${activeTab.title}`;
    } else {
      document.title = 'wenbenLao';
    }
  }, [activeTabId, tabs]);

  // 从文件树打开文档
  const openDocumentFromTree = (node) => {
    const existingTab = tabs.find(t => t.filePath === node.key);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTab = {
        id: Date.now(),
        type: 'text',
        title: node.title,
        content: node.content || '',
        filePath: node.key,
        isFromTree: true,
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTab.id);
    }
  };

  // 重命名时同步标签页标题
  const handleRenameNode = (nodeKey, newTitle) => {
    setTabs(prevTabs =>
      prevTabs.map(tab => {
        if (tab.filePath === nodeKey) {
          return { ...tab, title: newTitle };
        }
        return tab;
      })
    );
  };

  // 更新文本内容并同步到文件树
  const updateTabContent = (tabId, newContent) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, content: newContent } : tab
    ));
    const tab = tabs.find(t => t.id === tabId);
    if (tab && tab.filePath && tab.isFromTree) {
      const updateTree = (nodes) =>
        nodes.map(node => {
          if (node.key === tab.filePath) {
            return { ...node, content: newContent };
          }
          if (node.children) node.children = updateTree(node.children);
          return node;
        });
      setFileTreeData(updateTree(fileTreeData));
    }
  };

  // 新增文本标签页
  const addTextTab = () => {
    const newTab = {
      id: Date.now(),
      type: 'text',
      title: 'Untitled',
      content: '',
      filePath: null,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  // 新增思维导图标签页
  const addMindMapTab = () => {
    const newTab = {
      id: Date.now(),
      type: 'mindmap',
      title: 'New Mind Map',
      nodes: [],
      edges: [],
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (tabId) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(newTabs[0]?.id || null);
      }
      return newTabs;
    });
  };

  const detachTab = async (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    await window.electronAPI.detachTab(tab);
    setTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTabId === tabId) {
      setActiveTabId(tabs.filter(t => t.id !== tabId)[0]?.id || null);
    }
  };

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

  const updateMindMapData = (tabId, nodes, edges) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, nodes, edges } : tab
    ));
  };

  const activeTab = tabs.find(t => t.id === activeTabId);

  if (!isInitialized) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider width={250} collapsed={collapsed} theme="light" style={{ background: '#f5f5f5' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 8 }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
        </div>
        {!collapsed && (
          <FileTree
            data={fileTreeData}
            onDataChange={setFileTreeData}
            onOpenDocument={openDocumentFromTree}
            onRename={handleRenameNode}
          />
        )}
      </Sider>
      <Content style={{ display: 'flex', flexDirection: 'column' }}>
        <TabBar
          tabs={tabs}
          activeId={activeTabId}
          onSelect={setActiveTabId}
          onClose={closeTab}
          onDetach={detachTab}
          onNewText={addTextTab}
          onNewMindMap={addMindMapTab}
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
                  const newFileName = newPath.split(/[/\\]/).pop();
                  updateTabContent(activeTab.id, content);
                  setTabs(prev => prev.map(tab =>
                    tab.id === activeTab.id ? { ...tab, filePath: newPath, title: newFileName } : tab
                  ));
                  // 可选：将新保存的文件添加到文件树
                  if (activeTab.filePath === null) {
                    // 询问是否添加到当前选中的文件夹
                    message.info('文件已保存，你可以手动在文件树中创建文档并粘贴内容。');
                  }
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
      </Content>
    </Layout>
  );
};

export default App;
