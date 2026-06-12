import React, { useState } from 'react';
import { Tree, Dropdown, Menu, Modal, Input, message } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  FileOutlined,
  FolderOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';

const { DirectoryTree } = Tree;

// 生成唯一 key
const genKey = () => Date.now() + '-' + Math.random().toString(36).substr(2, 8);

// 递归查找节点
const findNode = (nodes, key, callback) => {
  for (const node of nodes) {
    if (node.key === key) {
      callback(node);
      return true;
    }
    if (node.children && findNode(node.children, key, callback)) return true;
  }
  return false;
};

// 递归删除节点
const deleteNode = (nodes, key) => {
  return nodes.filter(node => {
    if (node.key === key) return false;
    if (node.children) node.children = deleteNode(node.children, key);
    return true;
  });
};

const FileTree = ({ data, onDataChange, onOpenDocument, onRename }) => {
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [contextMenuNode, setContextMenuNode] = useState(null);

  // 新建文件或文件夹
  const handleCreate = (type, parentKey = null) => {
    let newNode = null;
    if (type === 'file') {
      newNode = {
        title: '新文档',
        key: genKey(),
        isLeaf: true,
        icon: <FileOutlined />,
        content: '',
        type: 'file',
      };
    } else {
      newNode = {
        title: '新建文件夹',
        key: genKey(),
        isLeaf: false,
        icon: <FolderOutlined />,
        children: [],
        type: 'folder',
      };
    }

    const newData = [...data];
    if (parentKey) {
      findNode(newData, parentKey, (node) => {
        if (!node.children) node.children = [];
        node.children.push(newNode);
      });
    } else {
      newData.push(newNode);
    }
    onDataChange(newData);
    setExpandedKeys([...expandedKeys, parentKey].filter(Boolean));
  };

  // 重命名
  const handleRename = (node) => {
    let newTitle = '';
    Modal.confirm({
      title: '重命名',
      content: (
        <Input
          defaultValue={node.title}
          onChange={(e) => (newTitle = e.target.value)}
          autoFocus
        />
      ),
      onOk: () => {
        if (!newTitle || newTitle === node.title) return;
        const updateTitle = (nodes) =>
          nodes.map(n => {
            if (n.key === node.key) return { ...n, title: newTitle };
            if (n.children) n.children = updateTitle(n.children);
            return n;
          });
        const newTree = updateTitle(data);
        onDataChange(newTree);
        if (onRename) onRename(node.key, newTitle);
        message.success('重命名成功');
      },
    });
  };

  // 删除
  const handleDelete = (node) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除“${node.title}”吗？${node.isLeaf ? '' : '文件夹内的所有文档也会被删除。'}`,
      onOk: () => {
        const newData = deleteNode(data, node.key);
        onDataChange(newData);
        message.success('删除成功');
      },
    });
  };

  const onSelect = (selectedKeys, info) => {
    if (info.node.isLeaf) {
      onOpenDocument(info.node);
    } else {
      setExpandedKeys(selectedKeys);
    }
  };

  const onRightClick = ({ event, node }) => {
    event.preventDefault();
    setContextMenuNode(node);
  };

  const contextMenu = (
    <Menu>
      <Menu.Item key="newFile" icon={<FileOutlined />} onClick={() => handleCreate('file', contextMenuNode?.key)}>
        新建文档
      </Menu.Item>
      <Menu.Item key="newFolder" icon={<FolderOutlined />} onClick={() => handleCreate('folder', contextMenuNode?.key)}>
        新建文件夹
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="rename" icon={<EditOutlined />} onClick={() => handleRename(contextMenuNode)}>
        重命名
      </Menu.Item>
      <Menu.Item key="delete" icon={<DeleteOutlined />} danger onClick={() => handleDelete(contextMenuNode)}>
        删除
      </Menu.Item>
    </Menu>
  );

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 8 }}>
      <div style={{ marginBottom: 8 }}>
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item onClick={() => handleCreate('file')}>新建文档</Menu.Item>
              <Menu.Item onClick={() => handleCreate('folder')}>新建文件夹</Menu.Item>
            </Menu>
          }
          trigger={['click']}
        >
          <PlusOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
        </Dropdown>
      </div>
      <DirectoryTree
        treeData={data}
        expandedKeys={expandedKeys}
        onExpand={setExpandedKeys}
        onSelect={onSelect}
        onRightClick={onRightClick}
        draggable
        onDrop={(info) => {
          // 拖拽移动节点（简化实现，暂不实现跨节点移动）
          // 高级功能可后续添加
        }}
      />
      {contextMenuNode && (
        <Dropdown
          overlay={contextMenu}
          visible={!!contextMenuNode}
          onVisibleChange={(visible) => !visible && setContextMenuNode(null)}
          trigger={['contextMenu']}
        >
          <span />
        </Dropdown>
      )}
    </div>
  );
};

export default FileTree;
