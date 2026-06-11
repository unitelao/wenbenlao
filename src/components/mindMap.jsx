import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button, Space, ColorPicker, Input, Popover, Upload, message, Tooltip } from 'antd';
import { SaveOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';

const initialNodes = [
  { id: '1', position: { x: 250, y: 100 }, data: { label: '中心主题', color: '#ffcc00', icon: '💡' } },
];
const initialEdges = [];

const MindMap = ({ initialNodes: propNodes, initialEdges: propEdges, onChange, title, onTitleChange }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(propNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(propEdges);
  const [selectedNode, setSelectedNode] = useState(null);
  const reactFlowWrapper = useRef(null);
  const isInternalChange = useRef(false); // 防止外部 props 引起的循环
  const isMoving = useRef(false);          // 防止拖动过程中同步父组件

  // 仅当外部 props 变化且非内部触发时，同步节点/边
  useEffect(() => {
    if (!isInternalChange.current) {
      setNodes(propNodes);
      setEdges(propEdges);
    }
    isInternalChange.current = false;
  }, [propNodes, propEdges, setNodes, setEdges]);

  // 同步数据到父组件：仅在非拖动状态下执行
  useEffect(() => {
    if (!isMoving.current && onChange && (nodes.length || edges.length)) {
      onChange(nodes, edges);
    }
  }, [nodes, edges, onChange]);

  // 连线
  const onConnect = useCallback((params) => {
    isInternalChange.current = true;
    setEdges((eds) => addEdge(params, eds));
  }, [setEdges]);

  // 节点点击
  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  // 拖动开始/结束
  const onNodeDragStart = useCallback(() => {
    isMoving.current = true;
  }, []);

  const onNodeDragStop = useCallback(() => {
    isMoving.current = false;
    // 拖动结束后同步一次（保存最新位置）
    if (onChange && (nodes.length || edges.length)) {
      onChange(nodes, edges);
    }
  }, [nodes, edges, onChange]);

  // 添加节点
  const addNode = useCallback(() => {
    isInternalChange.current = true;
    const newNode = {
      id: `${Date.now()}`,
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { label: '新节点', color: '#a0c0f0', icon: '📄' },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  // 更新样式
  const updateNodeStyle = useCallback((color, icon) => {
    if (selectedNode) {
      isInternalChange.current = true;
      setNodes((nds) =>
        nds.map((node) =>
          node.id === selectedNode.id
            ? { ...node, data: { ...node.data, color, icon } }
            : node
        )
      );
    }
  }, [selectedNode, setNodes]);

  // 更新文字
  const updateNodeLabel = useCallback((label) => {
    if (selectedNode) {
      isInternalChange.current = true;
      setNodes((nds) =>
        nds.map((node) =>
          node.id === selectedNode.id
            ? { ...node, data: { ...node.data, label } }
            : node
        )
      );
    }
  }, [selectedNode, setNodes]);

  // 删除节点
  const deleteSelectedNode = useCallback(() => {
    if (selectedNode) {
      isInternalChange.current = true;
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
      setSelectedNode(null);
    }
  }, [selectedNode, setNodes, setEdges]);

  // 导出
  const exportData = useCallback(() => {
    const dataStr = JSON.stringify({ nodes, edges });
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'mindmap'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('导出成功');
  }, [nodes, edges, title]);

  // 导入
  const importData = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const { nodes: importedNodes, edges: importedEdges } = JSON.parse(e.target.result);
        isInternalChange.current = true;
        setNodes(importedNodes);
        setEdges(importedEdges);
        message.success('导入成功');
      } catch (err) {
        message.error('文件格式错误');
      }
    };
    reader.readAsText(file);
    return false;
  }, [setNodes, setEdges]);

  // 快捷键删除
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Del') && selectedNode) {
        deleteSelectedNode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, deleteSelectedNode]);

  // 稳定节点样式映射（避免每次渲染都新建对象）
  const styledNodes = useMemo(() => {
    return nodes.map(node => ({
      ...node,
      style: { background: node.data.color || '#a0c0f0', border: '2px solid #333', borderRadius: 8, padding: 8 },
      data: { label: `${node.data.icon || '📄'} ${node.data.label}` }
    }));
  }, [nodes]);

  const defaultEdgeOptions = useMemo(() => ({ animated: true, style: { stroke: '#888' } }), []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 8, background: '#f0f0f0', borderBottom: '1px solid #ccc' }}>
        <Space wrap>
          <Button type="primary" onClick={addNode}>➕ 添加节点</Button>
          <Button icon={<SaveOutlined />} onClick={exportData}>导出</Button>
          <Upload accept=".json" beforeUpload={importData} showUploadList={false}>
            <Button icon={<UploadOutlined />}>导入</Button>
          </Upload>
          {selectedNode && (
            <>
              <Input
                placeholder="节点文字"
                value={selectedNode.data.label}
                onChange={(e) => updateNodeLabel(e.target.value)}
                style={{ width: 150 }}
              />
              <Popover
                content={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <ColorPicker
                      value={selectedNode.data.color || '#a0c0f0'}
                      onChange={(color) => updateNodeStyle(color.toHexString(), selectedNode.data.icon)}
                    />
                    <Input
                      placeholder="图标 (emoji)"
                      value={selectedNode.data.icon}
                      onChange={(e) => updateNodeStyle(selectedNode.data.color, e.target.value)}
                    />
                  </div>
                }
                title="样式"
                trigger="click"
              >
                <Button>🎨 样式</Button>
              </Popover>
              <Tooltip title="删除节点 (Del)">
                <Button icon={<DeleteOutlined />} onClick={deleteSelectedNode} danger />
              </Tooltip>
            </>
          )}
        </Space>
      </div>
      <div style={{ flex: 1, position: 'relative' }} ref={reactFlowWrapper}>
        <ReactFlow
          nodes={styledNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
};

export default MindMap;