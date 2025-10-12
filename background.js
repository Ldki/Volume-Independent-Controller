
// 網址正規化函數 - 專注於視頻識別
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // 專門處理視頻網站
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      const videoId = getYouTubeVideoId(url);
      if (videoId) {
        return `youtube:${videoId}`;
      }
    }
    
    // 添加对 iyf.tv 的支持
    if (urlObj.hostname.includes('iyf.tv')) {
      const videoId = getIyfTvVideoId(url);
      if (videoId) {
        return `iyftv:${videoId}`;
      }
    }
    
    // 其他視頻網站可以在此添加
    return null;
    
  } catch (error) {
    console.error('網址正規化錯誤:', error);
    return null;
  }
}

// 獲取YouTube視頻ID
function getYouTubeVideoId(url) {
  try {
    const urlObj = new URL(url);
    
    // 標準YouTube網址: youtube.com/watch?v=VIDEO_ID
    if (urlObj.hostname.includes('youtube.com') && urlObj.pathname === '/watch') {
      return urlObj.searchParams.get('v');
    }
    
    // 短網址: youtu.be/VIDEO_ID
    if (urlObj.hostname.includes('youtu.be')) {
      return urlObj.pathname.substring(1);
    }
    
    // 嵌入式網址
    if (urlObj.hostname.includes('youtube.com') && urlObj.pathname.includes('/embed/')) {
      const pathParts = urlObj.pathname.split('/');
      return pathParts[pathParts.length - 1];
    }
    
    return null;
  } catch (error) {
    console.error('獲取YouTube視頻ID錯誤:', error);
    return null;
  }
}

// 獲取 iyf.tv 視頻ID
function getIyfTvVideoId(url) {
  try {
    const urlObj = new URL(url);
    
    // 處理類似 https://www.iyf.tv/play/iJRRzoPlAjI?id=zzaEyiQptCf1 的URL
    if (urlObj.hostname.includes('iyf.tv') && urlObj.pathname.includes('/play/')) {
      // 從路徑中獲取播放ID，從查詢參數中獲取視頻ID
      const pathParts = urlObj.pathname.split('/');
      const playId = pathParts[pathParts.length - 1];
      const videoId = urlObj.searchParams.get('id');
      
      // 如果兩個都有，組合使用；否則使用其中一個
      if (playId && videoId) {
        return `${playId}:${videoId}`;
      } else if (playId) {
        return playId;
      } else if (videoId) {
        return videoId;
      }
    }
    
    return null;
  } catch (error) {
    console.error('獲取 iyf.tv 視頻ID錯誤:', error);
    return null;
  }
}

// 檢查是否為視頻網址
function isVideoUrl(url) {
  const normalized = normalizeUrl(url);
  return normalized !== null && (
    normalized.startsWith('youtube:') || 
    normalized.startsWith('iyftv:') ||
    normalized.startsWith('video:')
  );
}

// 新增：檢查記憶功能是否啟用
async function isMemoryEnabled() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['memoryEnabled'], (result) => {
      // 預設為不記憶（false）
      resolve(result.memoryEnabled || false);
    });
  });
}

// 保存視頻音量設定（修復：只有當音量不是100%或靜音時才保存，新增：檢查記憶開關）
async function saveVideoVolumeSettings(url, volume, isMuted, videoTitle = null) {
  // 新增：檢查記憶功能是否啟用
  const memoryEnabled = await isMemoryEnabled();
  if (!memoryEnabled) {
    console.log('記憶功能已關閉，不保存音量設定');
    return;
  }
  
  const normalizedUrl = normalizeUrl(url);
  
  if (!normalizedUrl) return;
  
  // 獲取當前時間戳
  const timestamp = Date.now();
  
  // 只有當音量不是100%或靜音時才保存（重要修復！）
  if (volume !== 100 || isMuted) {
    const settingData = {
      volume: volume,
      isMuted: isMuted,
      timestamp: timestamp,
      url: normalizedUrl,
      originalUrl: url // 保存原始URL用於顯示
    };
    
    // 如果有影片名稱，一併保存
    if (videoTitle && videoTitle !== '未知內容' && videoTitle !== '') {
      settingData.title = videoTitle;
      console.log('保存影片標題:', videoTitle);
    } else {
      // 如果沒有標題，生成一個友好的顯示名稱
      settingData.title = generateDisplayName(normalizedUrl, url);
      console.log('生成顯示名稱:', settingData.title);
    }
    
    chrome.storage.local.set({
      [`videoVolume_${normalizedUrl}`]: settingData
    });
    
    console.log(`已保存視頻 ${normalizedUrl} 的音量設定: ${volume}%, 靜音: ${isMuted}, 標題: ${settingData.title}`);
  } else {
    // 如果是預設值，刪除保存的設定（避免儲存預設值）
    chrome.storage.local.remove([`videoVolume_${normalizedUrl}`]);
    console.log(`已刪除視頻 ${normalizedUrl} 的預設音量設定（音量為100%且未靜音）`);
  }
}

// 生成友好的顯示名稱
function generateDisplayName(normalizedUrl, originalUrl) {
  if (normalizedUrl.startsWith('youtube:')) {
    const videoId = normalizedUrl.replace('youtube:', '');
    return `YouTube: ${videoId}`;
  } else if (normalizedUrl.startsWith('iyftv:')) {
    const videoId = normalizedUrl.replace('iyftv:', '');
    return `iyf.tv視頻: ${videoId}`;
  } else {
    // 對於其他網址，使用主機名和路徑
    try {
      const urlObj = new URL(originalUrl);
      return `${urlObj.hostname}${urlObj.pathname}`;
    } catch (error) {
      return originalUrl;
    }
  }
}

// 查找視頻設定
async function findVideoSettings(url) {
  const normalizedUrl = normalizeUrl(url);
  
  if (!normalizedUrl) return null;
  
  const result = await chrome.storage.local.get([`videoVolume_${normalizedUrl}`]);
  const settingData = result[`videoVolume_${normalizedUrl}`];
  
  if (settingData) {
    return {
      videoId: normalizedUrl,
      volume: settingData.volume,
      isMuted: settingData.isMuted || false,
      timestamp: settingData.timestamp || 0,
      title: settingData.title || generateDisplayName(normalizedUrl, settingData.originalUrl || url),
      originalUrl: settingData.originalUrl || url
    };
  }
  
  return null;
}

// 獲取所有設定（按時間排序）
async function getAllSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (items) => {
      const settings = [];
      
      // 過濾出視頻音量設定
      for (const key in items) {
        if (key.startsWith('videoVolume_')) {
          const settingData = items[key];
          
          // 確保設定數據包含必要的字段
          if (settingData && typeof settingData === 'object') {
            const normalizedUrl = key.replace('videoVolume_', '');
            
            settings.push({
              url: normalizedUrl,
              volume: settingData.volume,
              isMuted: settingData.isMuted || false,
              timestamp: settingData.timestamp || 0,
              title: settingData.title || generateDisplayName(normalizedUrl, settingData.originalUrl || ''),
              originalUrl: settingData.originalUrl || ''
            });
          }
        }
      }
      
      // 按時間戳降序排列（最新的在最上面）
      settings.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      resolve(settings);
    });
  });
}

// 匯出設定
async function exportSettings() {
  try {
    const settings = await getAllSettings();
    
    // 添加匯出元數據
    const exportData = {
      version: '2.8',
      exportDate: new Date().toISOString(),
      settingsCount: settings.length,
      settings: settings
    };
    
    return { success: true, data: exportData };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 匯入設定
async function importSettings(importData) {
  try {
    // 驗證匯入數據格式
    if (!importData.settings || !Array.isArray(importData.settings)) {
      throw new Error('無效的匯入檔案格式');
    }
    
    let importedCount = 0;
    
    // 逐個匯入設定
    for (const setting of importData.settings) {
      if (setting.url && setting.volume !== undefined) {
        await new Promise((resolve) => {
          const settingData = {
            volume: setting.volume,
            isMuted: setting.isMuted || false,
            timestamp: setting.timestamp || Date.now(),
            url: setting.url,
            originalUrl: setting.originalUrl || ''
          };
          
          if (setting.title) {
            settingData.title = setting.title;
          }
          
          chrome.storage.local.set({
            [`videoVolume_${setting.url}`]: settingData
          }, () => {
            importedCount++;
            resolve();
          });
        });
      }
    }
    
    return { success: true, importedCount: importedCount };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 刪除設定
async function deleteSettings(urls) {
  try {
    const keysToRemove = [];
    
    // 為每個URL生成要刪除的鍵
    urls.forEach(url => {
      keysToRemove.push(`videoVolume_${url}`);
    });
    
    await new Promise((resolve) => {
      chrome.storage.local.remove(keysToRemove, () => {
        resolve();
      });
    });
    
    return { success: true, deletedCount: urls.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 更新圖示和標記（顯示完整音量百分比）
function updateIconAndBadge(tabId, volume, isMuted) {
  // 設置徽章文本（顯示完整音量百分比）
  if (isMuted) {
    chrome.action.setBadgeText({ 
      tabId: tabId, 
      text: '靜音' 
    });
    chrome.action.setBadgeBackgroundColor({ 
      tabId: tabId, 
      color: '#e74c3c' 
    });
  } else {
    // 顯示完整音量數字
    let displayText = `${volume}`;
    
    chrome.action.setBadgeText({ 
      tabId: tabId, 
      text: displayText 
    });
    
    // 根據音量設置不同顏色
    if (volume === 0) {
      chrome.action.setBadgeBackgroundColor({ 
        tabId: tabId, 
        color: '#95a5a6' 
      });
    } else if (volume <= 100) {
      chrome.action.setBadgeBackgroundColor({ 
        tabId: tabId, 
        color: '#2ecc71' 
      });
    } else if (volume <= 300) {
      chrome.action.setBadgeBackgroundColor({ 
        tabId: tabId, 
        color: '#f39c12' 
      });
    } else {
      chrome.action.setBadgeBackgroundColor({ 
        tabId: tabId, 
        color: '#e74c3c' 
      });
    }
  }
  
  // 設置徽章文字顏色為白色
  chrome.action.setBadgeTextColor({
    tabId: tabId,
    color: '#FFFFFF'
  });
}

// 調整音量（每次20%）
function adjustVolume(tabId, direction) {
  chrome.tabs.get(tabId, (tab) => {
    chrome.storage.local.get([`tabVolume_${tabId}`, `tabMuted_${tabId}`], (result) => {
      let volume = result[`tabVolume_${tabId}`] !== undefined ? result[`tabVolume_${tabId}`] : 100;
      const isMuted = result[`tabMuted_${tabId}`] || false;
      
      if (isMuted) {
        chrome.storage.local.set({ [`tabMuted_${tabId}`]: false });
      }
      
      if (direction === 'increase') {
        volume = Math.min(volume + 20, 600);
      } else {
        volume = Math.max(volume - 20, 0);
      }
      
      chrome.storage.local.set({ [`tabVolume_${tabId}`]: volume });
      
      // 保存到視頻記憶（只有當音量不是100%或靜音時才保存）
      if (tab.url && isVideoUrl(tab.url)) {
        saveVideoVolumeSettings(tab.url, volume, false, null);
      }
      
      // 更新圖示和標記
      updateIconAndBadge(tabId, volume, false);
      
      // 發送消息到內容腳本（顯示提示）
      chrome.tabs.sendMessage(tabId, {
        action: 'setVolume',
        volume: volume / 100,
        showNotification: true,
        isMemoryApply: false  // 快捷鍵操作應該保存
      });
    });
  });
}

// 切換靜音
function toggleMute(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    chrome.storage.local.get([`tabMuted_${tabId}`, `tabVolume_${tabId}`], (result) => {
      const isMuted = !result[`tabMuted_${tabId}`];
      const volume = result[`tabVolume_${tabId}`] !== undefined ? result[`tabVolume_${tabId}`] : 100;
      
      chrome.storage.local.set({ [`tabMuted_${tabId}`]: isMuted });
      
      // 保存到視頻記憶（只有當音量不是100%或靜音時才保存）
      if (tab.url && isVideoUrl(tab.url)) {
        saveVideoVolumeSettings(tab.url, volume, isMuted, null);
      }
      
      // 更新圖示和標記
      updateIconAndBadge(tabId, volume, isMuted);
      
      // 發送消息到內容腳本（顯示提示）
      chrome.tabs.sendMessage(tabId, {
        action: 'toggleMute',
        isMuted,
        showNotification: true,
        isMemoryApply: false  // 快捷鍵操作應該保存
      });
    });
  });
}

// 重置音量
function resetVolume(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    const resetVolume = 100;
    const resetMuted = false;
    
    chrome.storage.local.set({ 
      [`tabVolume_${tabId}`]: resetVolume,
      [`tabMuted_${tabId}`]: resetMuted
    });
    
    // 保存到視頻記憶（重置時刪除保存的設定）
    if (tab.url && isVideoUrl(tab.url)) {
      const normalizedUrl = normalizeUrl(tab.url);
      if (normalizedUrl) {
        // 刪除保存的設定（因為重置為預設值）
        chrome.storage.local.remove([`videoVolume_${normalizedUrl}`]);
        console.log(`重置音量，已刪除視頻 ${normalizedUrl} 的設定`);
      }
    }
    
    // 更新圖示和標記
    updateIconAndBadge(tabId, resetVolume, resetMuted);
    
    // 發送消息到內容腳本（顯示提示）
    chrome.tabs.sendMessage(tabId, {
      action: 'setVolume',
      volume: 1.0,
      showNotification: true,
      isMemoryApply: false  // 重置操作應該保存（實際是刪除）
    });
  });
}

// 處理快捷鍵命令
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0]) {
      switch (command) {
        case 'increase-volume':
          adjustVolume(tabs[0].id, 'increase');
          break;
        case 'decrease-volume':
          adjustVolume(tabs[0].id, 'decrease');
          break;
        case 'toggle-mute':
          toggleMute(tabs[0].id);
          break;
        case 'reset-volume':
          resetVolume(tabs[0].id);
          break;
      }
    }
  });
});

// 監聽分頁更新 - 應用視頻記憶功能
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active && tab.url) {
    try {
      // 檢查是否為視頻網址
      if (isVideoUrl(tab.url)) {
        // 查找該視頻的記憶設定
        const videoSettings = await findVideoSettings(tab.url);
        
        if (videoSettings) {
          console.log(`為視頻 ${tab.url} 找到記憶設定: 音量 ${videoSettings.volume}%`);
          
          // 應用找到的設定
          chrome.storage.local.set({ 
            [`tabVolume_${tabId}`]: videoSettings.volume,
            [`tabMuted_${tabId}`]: videoSettings.isMuted
          });
          
          // 更新圖示和標記
          updateIconAndBadge(tabId, videoSettings.volume, videoSettings.isMuted);
          
          // 發送消息到內容腳本應用設置（但不觸發保存）
          chrome.tabs.sendMessage(tabId, {
            action: 'setVolume',
            volume: videoSettings.isMuted ? 0 : videoSettings.volume / 100,
            showNotification: false,
            isMemoryApply: true  // 新增標記，表示這是應用記憶設定
          });
        } else {
          // 沒有找到視頻記憶，使用預設值
          console.log(`視頻 ${tab.url} 沒有記憶設定，使用預設值`);
          
          const defaultVolume = 100;
          const defaultMuted = false;
          
          chrome.storage.local.set({ 
            [`tabVolume_${tabId}`]: defaultVolume,
            [`tabMuted_${tabId}`]: defaultMuted
          });
          
          // 更新圖示和標記
          updateIconAndBadge(tabId, defaultVolume, defaultMuted);
          
          // 發送消息到內容腳本應用設置
          chrome.tabs.sendMessage(tabId, {
            action: 'setVolume',
            volume: defaultVolume / 100,
            showNotification: false,
            isMemoryApply: true  // 新增標記
          });
        }
      } else {
        // 不是視頻網址，使用分頁存儲或預設值
        chrome.storage.local.get([`tabVolume_${tabId}`, `tabMuted_${tabId}`], (result) => {
          const volume = result[`tabVolume_${tabId}`] !== undefined ? result[`tabVolume_${tabId}`] : 100;
          const isMuted = result[`tabMuted_${tabId}`] || false;
          
          // 更新圖示和標記
          updateIconAndBadge(tabId, volume, isMuted);
          
          // 發送消息到內容腳本應用設置
          chrome.tabs.sendMessage(tabId, {
            action: 'setVolume',
            volume: isMuted ? 0 : volume / 100,
            showNotification: false,
            isMemoryApply: true  // 新增標記
          });
        });
      }
    } catch (error) {
      console.error('應用視頻記憶設定時出錯:', error);
    }
  }
});

// 監聽分頁切換
chrome.tabs.onActivated.addListener((activeInfo) => {
  const tabId = activeInfo.tabId;
  
  // 應用存儲的音量設置到新激活的分頁
  chrome.storage.local.get([`tabVolume_${tabId}`, `tabMuted_${tabId}`], (result) => {
    const volume = result[`tabVolume_${tabId}`] !== undefined ? result[`tabVolume_${tabId}`] : 100;
    const isMuted = result[`tabMuted_${tabId}`] || false;
    
    // 更新圖示和標記
    updateIconAndBadge(tabId, volume, isMuted);
    
    // 發送消息到內容腳本應用設置
    chrome.tabs.sendMessage(tabId, {
      action: 'setVolume',
      volume: isMuted ? 0 : volume / 100,
      showNotification: false,
      isMemoryApply: true  // 新增標記
    });
  });
});

// 初始化：為所有已開啟的分頁設置徽章
chrome.tabs.query({}, (tabs) => {
  tabs.forEach(tab => {
    chrome.storage.local.get([`tabVolume_${tab.id}`, `tabMuted_${tab.id}`], (result) => {
      const volume = result[`tabVolume_${tab.id}`] !== undefined ? result[`tabVolume_${tab.id}`] : 100;
      const isMuted = result[`tabMuted_${tab.id}`] || false;
      updateIconAndBadge(tab.id, volume, isMuted);
    });
  });
});

// 監聽來自內容腳本和popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('背景腳本收到消息:', request.action, request);
  
  // 圖示更新相關
  if (request.action === 'updateIconBadgeFromContent') {
    updateIconAndBadge(sender.tab.id, request.volume, request.isMuted);
  }
  
  if (request.action === 'updateIconBadge') {
    updateIconAndBadge(request.tabId, request.volume, request.isMuted);
  }
  
  // 視頻記憶相關 - 修復：只有當音量不是100%或靜音時才保存
  if (request.action === 'saveVolumeSettings') {
    console.log('保存音量設定:', request.url, request.volume, request.isMuted, request.videoTitle);
    
    // 重要：只有當音量不是100%或靜音時才保存
    if (request.volume !== 100 || request.isMuted) {
      saveVideoVolumeSettings(request.url, request.volume, request.isMuted, request.videoTitle);
      sendResponse({ success: true, saved: true });
    } else {
      // 如果是預設值，刪除保存的設定
      const normalizedUrl = normalizeUrl(request.url);
      if (normalizedUrl) {
        chrome.storage.local.remove([`videoVolume_${normalizedUrl}`]);
        console.log('音量為100%且未靜音，刪除保存的設定');
      }
      sendResponse({ success: true, saved: false });
    }
    return true;
  }
  
  if (request.action === 'saveVideoVolumeSettings') {
    console.log('保存視頻音量設定:', request.url, request.volume, request.isMuted);
    
    // 重要：只有當音量不是100%或靜音時才保存
    if (request.volume !== 100 || request.isMuted) {
      saveVideoVolumeSettings(request.url, request.volume, request.isMuted, request.videoTitle);
      sendResponse({ success: true, saved: true });
    } else {
      // 如果是預設值，刪除保存的設定
      const normalizedUrl = normalizeUrl(request.url);
      if (normalizedUrl) {
        chrome.storage.local.remove([`videoVolume_${normalizedUrl}`]);
        console.log('音量為100%且未靜音，刪除保存的設定');
      }
      sendResponse({ success: true, saved: false });
    }
    return true;
  }
  
  if (request.action === 'checkVideoMemory') {
    findVideoSettings(request.url).then(settings => {
      sendResponse({ hasMemory: settings !== null });
    });
    return true;
  }
  
  // 設定管理相關
  if (request.action === 'getAllSettings') {
    getAllSettings().then(settings => {
      sendResponse({ settings: settings });
    });
    return true;
  }
  
  if (request.action === 'exportSettings') {
    exportSettings().then(result => {
      sendResponse(result);
    });
    return true;
  }
  
  if (request.action === 'importSettings') {
    importSettings(request.settings).then(result => {
      sendResponse(result);
    });
    return true;
  }
  
  if (request.action === 'deleteSettings') {
    deleteSettings(request.urls).then(result => {
      sendResponse(result);
    });
    return true;
  }
  
  // 對於其他消息，確保有回應
  sendResponse({ success: false, error: '未知的操作' });
  return true;
});

// 新增：初始化記憶開關狀態
chrome.runtime.onInstalled.addListener(() => {
  console.log('分頁音量控制器已安裝');
  
  // 初始化記憶開關狀態為false（不記憶）
  chrome.storage.local.get(['memoryEnabled'], (result) => {
    if (result.memoryEnabled === undefined) {
      chrome.storage.local.set({ memoryEnabled: false });
      console.log('記憶功能初始化為：關閉');
    }
  });
});