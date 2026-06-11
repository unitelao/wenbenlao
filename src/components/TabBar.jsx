import React, { useState, useRef } from 'react';
import { PlusOutlined, ExpandOutlined, CloseOutlined } from '@ant-design/icons';
import { Dropdown, Menu } from 'antd';

const TabBar = ({ tabs, activeId, onSelect, onClose, onDetach, onNewText, onNewMindMap, onMergeToWindow, windowId }) => {
  const [dragOverWinId, setDragOverWinId] = useState(null);
  const dragItemRef = useRef(null);

  // 开始拖拽标签页（用于跨窗口合并）
  const handleDragStart = (e, tab) => {
    dragItemRef.current = tab;
    e.dataTransfer.setData('text/plain', JSON.stringify({ tabId: tab.id, sourceWinId: windowId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  // 当拖拽到其他窗口时，需要全局监听（这里简化，实际需在 main.js 中实现全局拖拽监听）
  // 完整版建议使用 electron 的 `webContents.beginDrag` 和全局坐标检测
  // 为简化，我们仅实现窗口内拖动排序（跨窗口合并需要更复杂处理，下面的代码提供框架）
  
  // 窗口内拖拽排序（HTML5 原生）
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  
  const handleDrop = (e, targetTab) => {
    if (!dragItemRef.current) return;
    const dragIndex = tabs.findIndex(t => t.id === dragItemRef.current.id);
    const dropIndex = tabs.findIndex(t => t.id === targetTab.id);
    if (dragIndex === dropIndex) return;
    // 重新排序（需要父组件支持）
    const newTabs = [...tabs];
    const [removed] = newTabs.splice(dragIndex, 1);
    newTabs.splice(dropIndex, 0, removed);
    // 通知父组件更新 tabs（需通过 App 传递 setTabs，这里简化只演示）
    // 实际项目中应通过回调
    window.electronAPI.updateWindowData({ tabs: newTabs, activeTabId: activeId });
    dragItemRef.current = null;
  };

  // 右键菜单
  const contextMenu = (tab) => (
    <Menu>
      <Menu.Item key="detach" onClick={() => onDetach(tab.id)}>在新窗口打开</Menu.Item>
      <Menu.Item key="close" onClick={() => onClose(tab.id)}>关闭</Menu.Item>
    </Menu>
  );

  return (
    <div style={{ display: 'flex', background: '#1e1e1e', borderBottom: '1px solid #444', userSelect: 'none' }}>
      <div style={{ display: 'flex', flex: 1, overflowX: 'auto' }}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            draggable
            onDragStart={(e) => handleDragStart(e, tab)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, tab)}
            onClick={() => onSelect(tab.id)}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 16px',
              background: activeId === tab.id ? '#2d2d2d' : '#1e1e1e',
              color: '#fff',
              borderRight: '1px solid #444',
              cursor: 'pointer',
              gap: 8,
            }}
          >
            <span>{tab.title}</span>
            {tab.type === 'mindmap' && <span style={{ fontSize: 12 }}>🧠</span>}
            <CloseOutlined
              style={{ fontSize: 12, opacity: 0.6 }}
              onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
            />
            <ExpandOutlined
              style={{ fontSize: 12, opacity: 0.6 }}
              onClick={(e) => { e.stopPropagation(); onDetach(tab.id); }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
        <Dropdown overlay={(
          <Menu>
            <Menu.Item key="text" onClick={onNewText}>新建文本</Menu.Item>
            <Menu.Item key="mindmap" onClick={onNewMindMap}>新建思维导图</Menu.Item>
          </Menu>
        )} trigger={['click']}>
          <PlusOutlined style={{ color: '#fff', cursor: 'pointer', fontSize: 18 }} />
        </Dropdown>
      </div>
    </div>
  );
};

export default TabBar;