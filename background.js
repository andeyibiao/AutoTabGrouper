const COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];

// 提取标签页的友好域名（去掉协议和 www. 以便更好地归类）
function getDomain(urlStr) {
  try {
    const url = new URL(urlStr);
    let hostname = url.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch (e) {
    return null;
  }
}

// 基于域名计算对应的颜色，确保同一个域名的颜色一致
function getColorForDomain(domain) {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  return COLORS[hash % COLORS.length];
}

// 检查并分组
async function checkAndGroup(windowId) {
  // 获取当前窗口中的所有普通标签页
  const tabs = await chrome.tabs.query({ windowId });
  
  // 按域名分类
  const domainToTabs = new Map();
  
  tabs.forEach(tab => {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://')) {
      return;
    }
    const domain = getDomain(tab.url);
    if (!domain) return;
    
    if (!domainToTabs.has(domain)) {
      domainToTabs.set(domain, []);
    }
    domainToTabs.get(domain).push(tab);
  });

  // 遍历每个域名的标签页
  for (const [domain, tabList] of domainToTabs.entries()) {
    if (tabList.length > 1) {
      // 检查这些标签页是否已经在同一个组
      const groupIds = new Set(
        tabList
          .map(t => t.groupId)
          .filter(id => id !== chrome.tabGroups.TAB_GROUP_ID_NONE)
      );

      let targetGroupId;
      if (groupIds.size === 1) {
        // 全都在一个或部分在一个已存在的组里面
        targetGroupId = groupIds.values().next().value;
      } else if (groupIds.size > 1) {
        // 如果分散在多个组中，可以把它们都合并到第一个组里
        targetGroupId = groupIds.values().next().value;
      }

      const tabIds = tabList.map(t => t.id);

      // 将所有属于这个域名的 tabs 放进对应目标组 (如果 targetGroupId undefined，会自动创建新组)
      const groupOptions = { tabIds: tabIds };
      if (targetGroupId !== undefined) {
        groupOptions.groupId = targetGroupId;
      }
      targetGroupId = await chrome.tabs.group(groupOptions);

      // 更新组名与组颜色
      const color = getColorForDomain(domain);
      await chrome.tabGroups.update(targetGroupId, {
        title: domain,
        color: color
      });
    }
  }
}

// 监听标签页更新（比如加载了新 URL）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    checkAndGroup(tab.windowId);
  }
});

// 也可以监听新标签页创建
chrome.tabs.onCreated.addListener((tab) => {
  // onCreated 时可能还没有完整 url (比如 "chrome://newtab/")，一般 onUpdated 会再捕捉一次
  if (tab.url && tab.url !== '') {
      checkAndGroup(tab.windowId);
  }
});
