import React, { useState, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { Button, Space, message, Tooltip } from 'antd';
import { SaveOutlined, FolderOpenOutlined, ZoomInOutlined, ZoomOutOutlined, SyncOutlined, AlignLeftOutlined } from '@ant-design/icons';

const TextEditor = ({ content, onChange, filePath, onSaveAs }) => {
  const [localContent, setLocalContent] = useState(content);
  const [currentFilePath, setCurrentFilePath] = useState(filePath);
  const [fontSize, setFontSize] = useState(14);
  const [autoResize, setAutoResize] = useState(true);
  const [wordWrap, setWordWrap] = useState(true); // 自动换行状态

  // 根据窗口宽度计算字体大小（12~28px）
  const calcFontSizeByWindow = useCallback(() => {
    const width = window.innerWidth;
    const minWidth = 800, maxWidth = 2000;
    const minFont = 12, maxFont = 28;
    let newSize = minFont + (width - minWidth) / (maxWidth - minWidth) * (maxFont - minFont);
    newSize = Math.min(maxFont, Math.max(minFont, newSize));
    return Math.round(newSize);
  }, []);

  const applyAutoFont = useCallback(() => {
    if (autoResize) {
      const newSize = calcFontSizeByWindow();
      setFontSize(newSize);
      localStorage.setItem('textEditorFontSize', newSize);
    }
  }, [autoResize, calcFontSizeByWindow]);

  // 监听窗口缩放，自动调整字体（如果开启）
  useEffect(() => {
    const handleResize = () => {
      if (autoResize) applyAutoFont();
    };
    window.addEventListener('resize', handleResize);
    applyAutoFont();
    return () => window.removeEventListener('resize', handleResize);
  }, [autoResize, applyAutoFont]);

  // 读取保存的字体设置
  useEffect(() => {
    const saved = localStorage.getItem('textEditorFontSize');
    if (saved && !autoResize) {
      setFontSize(parseInt(saved, 10));
    } else if (autoResize) {
      applyAutoFont();
    }
  }, [autoResize, applyAutoFont]);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const handleSave = async () => {
    if (currentFilePath) {
      await window.electronAPI.saveFile(currentFilePath, localContent);
      message.success('保存成功');
    } else {
      const newPath = await window.electronAPI.saveAs(localContent);
      if (newPath) {
        setCurrentFilePath(newPath);
        message.success('已保存');
      }
    }
  };

  const handleOpen = async () => {
    const result = await window.electronAPI.openFileDialog();
    if (result) {
      setLocalContent(result.content);
      setCurrentFilePath(result.filePath);
      onChange(result.content);
      message.success(`打开 ${result.filePath}`);
    }
  };

  const increaseFont = () => {
    if (autoResize) setAutoResize(false);
    const newSize = Math.min(fontSize + 2, 32);
    setFontSize(newSize);
    localStorage.setItem('textEditorFontSize', newSize);
  };

  const decreaseFont = () => {
    if (autoResize) setAutoResize(false);
    const newSize = Math.max(fontSize - 2, 10);
    setFontSize(newSize);
    localStorage.setItem('textEditorFontSize', newSize);
  };

  const toggleAutoResize = () => {
    setAutoResize(!autoResize);
    if (!autoResize) applyAutoFont();
  };

  const toggleWordWrap = () => {
    setWordWrap(!wordWrap);
    localStorage.setItem('textEditorWordWrap', !wordWrap);
  };

  // 读取换行设置
  useEffect(() => {
    const savedWrap = localStorage.getItem('textEditorWordWrap');
    if (savedWrap !== null) setWordWrap(savedWrap === 'true');
  }, []);

  // 根据 wordWrap 状态动态生成 CodeMirror 扩展
  const extensions = [
    markdown(),
    oneDark,
    EditorView.theme({
      '&': { fontSize: `${fontSize}px` },
    }),
  ];
  if (wordWrap) {
    extensions.push(EditorView.lineWrapping);
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 8, background: '#252526', borderBottom: '1px solid #3e3e42', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<FolderOpenOutlined />} onClick={handleOpen}>打开</Button>
          <Button icon={<SaveOutlined />} onClick={handleSave}>保存</Button>
          {!currentFilePath && <Button onClick={() => onSaveAs(localContent)}>另存为</Button>}
        </Space>
        <Space>
          <Tooltip title="自动换行">
            <Button 
              icon={<AlignLeftOutlined />} 
              onClick={toggleWordWrap} 
              type={wordWrap ? "primary" : "default"}
              size="small"
            >
              换行
            </Button>
          </Tooltip>
          <Tooltip title="缩小字体">
            <Button icon={<ZoomOutOutlined />} onClick={decreaseFont} size="small">A-</Button>
          </Tooltip>
          <span style={{ color: '#ddd', margin: '0 8px', minWidth: '50px', textAlign: 'center' }}>{fontSize}px</span>
          <Tooltip title="放大字体">
            <Button icon={<ZoomInOutlined />} onClick={increaseFont} size="small">A+</Button>
          </Tooltip>
          <Tooltip title={autoResize ? "自动缩放已开启" : "自动缩放已关闭"}>
            <Button 
              icon={<SyncOutlined />} 
              onClick={toggleAutoResize} 
              size="small" 
              type={autoResize ? "primary" : "default"}
            >
              {autoResize ? "自动" : "手动"}
            </Button>
          </Tooltip>
        </Space>
      </div>
      <CodeMirror
        value={localContent}
        height="100%"
        extensions={extensions}
        onChange={(val) => {
          setLocalContent(val);
          onChange(val);
        }}
        theme="dark"
        style={{ flex: 1, overflow: 'auto' }}
      />
    </div>
  );
};

export default TextEditor;