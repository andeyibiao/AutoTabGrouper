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
  const ungroupedTabIds = [];
  const groupDomains = new Map();
  
  tabs.forEach(tab => {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://')) {
      ungroupedTabIds.push(tab.id);
      return;
    }
    const domain = getDomain(tab.url);
    if (!domain) {
      ungroupedTabIds.push(tab.id);
      return;
    }
    
    // 记录被占用的 groupId 及其包含的域名成分
    if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      if (!groupDomains.has(tab.groupId)) {
        groupDomains.set(tab.groupId, new Set());
      }
      groupDomains.get(tab.groupId).add(domain);
    }

    if (!domainToTabs.has(domain)) {
      domainToTabs.set(domain, []);
    }
    domainToTabs.get(domain).push(tab);
  });

  const processedGroups = [];

  // 遍历每个域名的标签页
  for (const [domain, tabList] of domainToTabs.entries()) {
    // 检查这些标签页是否已经在同一个纯净的组内
    const validGroupIds = new Set();
    tabList.forEach(t => {
      const gId = t.groupId;
      if (gId !== chrome.tabGroups.TAB_GROUP_ID_NONE && groupDomains.has(gId)) {
        const domainsInGroup = groupDomains.get(gId);
        // 只有当该原有的组内“仅有”当前处理的这一种域名时，才可以安全复用它
        if (domainsInGroup.size === 1 && domainsInGroup.has(domain)) {
          validGroupIds.add(gId);
        }
      }
    });

    let targetGroupId;
    if (validGroupIds.size > 0) {
      targetGroupId = validGroupIds.values().next().value;
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
    
    // 缩短展示名字：提取域名的第一段
    // 例如：github.com -> github, calendar.google.com -> calendar
    let shortTitle = domain.split('.')[0] || domain;

    await chrome.tabGroups.update(targetGroupId, {
      title: shortTitle,
      color: color
    });

    processedGroups.push({ groupId: targetGroupId, title: shortTitle });
  }

  // 将所有分组按名称排序，并依次移动到末尾
  processedGroups.sort((a, b) => a.title.localeCompare(b.title));
  for (const group of processedGroups) {
    try {
      await chrome.tabGroups.move(group.groupId, { index: -1 });
    } catch (e) {
      console.error('Failed to move group:', e);
    }
  }

  // 将没有被分组的标签页放到最下面（最右侧），并确保解除原生分组
  if (ungroupedTabIds.length > 0) {
    try {
      await chrome.tabs.ungroup(ungroupedTabIds);
      await chrome.tabs.move(ungroupedTabIds, { index: -1 });
    } catch (e) {
      console.error('Failed to ungroup/move tabs:', e);
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

// 当扩展第一次安装、更新或 Chrome 启动时，自动对现有标签页执行一次分组
chrome.runtime.onInstalled.addListener(async () => {
  const windows = await chrome.windows.getAll({ populate: false });
  for (const win of windows) {
    await checkAndGroup(win.id);
  }
});
