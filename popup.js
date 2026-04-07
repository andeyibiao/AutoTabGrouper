document.addEventListener('DOMContentLoaded', () => {
  // 解散所有分组（保留标签页）
  document.getElementById('ungroup-all').addEventListener('click', async () => {
    try {
      // 暂停自动分组，防止解散后被立即重新归组
      await chrome.runtime.sendMessage({ type: 'pause-auto-group' });

      // 获取当前窗口的所有分组
      const currentWindow = await chrome.windows.getCurrent();
      const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });
      
      // 收集所有已分组标签页的 ID，一次性解散
      const allTabIds = [];
      for (const group of groups) {
        const tabs = await chrome.tabs.query({ groupId: group.id });
        allTabIds.push(...tabs.map(t => t.id));
      }

      if (allTabIds.length > 0) {
        await chrome.tabs.ungroup(allTabIds);
      }

      // 恢复自动分组
      await chrome.runtime.sendMessage({ type: 'resume-auto-group' });
      // 操作完成后关闭 popup
      window.close();
    } catch (error) {
      // 出错时也要恢复自动分组
      try { await chrome.runtime.sendMessage({ type: 'resume-auto-group' }); } catch (e) {}
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
      
      // 暂停自动分组
      await chrome.runtime.sendMessage({ type: 'pause-auto-group' });

      const currentWindow = await chrome.windows.getCurrent();
      const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });
      
      // 收集所有已分组标签页的 ID，一次性关闭
      const allTabIds = [];
      for (const group of groups) {
        const tabs = await chrome.tabs.query({ groupId: group.id });
        allTabIds.push(...tabs.map(t => t.id));
      }

      if (allTabIds.length > 0) {
        await chrome.tabs.remove(allTabIds);
      }

      // 恢复自动分组
      await chrome.runtime.sendMessage({ type: 'resume-auto-group' });
      // 操作完成后关闭 popup
      window.close();
    } catch (error) {
      // 出错时也要恢复自动分组
      try { await chrome.runtime.sendMessage({ type: 'resume-auto-group' }); } catch (e) {}
      console.error('Error closing group tabs:', error);
      alert('关闭标签页时出错: ' + error.message);
    }
  });
});
