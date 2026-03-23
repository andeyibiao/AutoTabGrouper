document.addEventListener('DOMContentLoaded', () => {
  // 解散所有分组（保留标签页）
  document.getElementById('ungroup-all').addEventListener('click', async () => {
    try {
      // 获取当前窗口的所有分组
      const currentWindow = await chrome.windows.getCurrent();
      const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });
      
      for (const group of groups) {
        // 获取分组中的所有标签页
        const tabs = await chrome.tabs.query({ groupId: group.id });
        const tabIds = tabs.map(t => t.id);
        
        if (tabIds.length > 0) {
          // 解散分组
          await chrome.tabs.ungroup(tabIds);
        }
      }
      // 操作完成后关闭 popup
      window.close();
    } catch (error) {
      console.error('Error ungrouping tabs:', error);
      alert('解散分组时出错: ' + error.message);
    }
  });

  // 删除所有分组（关闭标签页）
  document.getElementById('close-all-groups').addEventListener('click', async () => {
    try {
      // 确认是否真的要关闭所有标签页
      if (!confirm('确定要关闭所有已分组的标签页吗？此操作无法撤销。')) {
        return;
      }
      
      const currentWindow = await chrome.windows.getCurrent();
      const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });
      
      for (const group of groups) {
        // 获取分组中的所有标签页
        const tabs = await chrome.tabs.query({ groupId: group.id });
        const tabIds = tabs.map(t => t.id);
        
        if (tabIds.length > 0) {
          // 关闭标签页（这也会自动移除该分组）
          await chrome.tabs.remove(tabIds);
        }
      }
      // 操作完成后关闭 popup
      window.close();
    } catch (error) {
      console.error('Error closing group tabs:', error);
      alert('关闭标签页时出错: ' + error.message);
    }
  });
});
