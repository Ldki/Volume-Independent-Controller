// 獲取DOM元素
const volumeSlider = document.getElementById('volume-slider');
const volumeValue = document.getElementById('volume-value');
const volumeWarning = document.getElementById('volume-warning');
const muteBtn = document.getElementById('mute-btn');
const resetBtn = document.getElementById('reset-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');
const changeShortcutsBtn = document.getElementById('change-shortcuts');
const tabTitle = document.getElementById('tab-title');
const settingsList = document.getElementById('settings-list');
const settingsCount = document.getElementById('settings-count');
const selectAllBtn = document.getElementById('select-all-btn');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const memoryToggle = document.getElementById('memory-toggle'); // 新增

// 存儲所有設定項目的數據
let settingsData = [];

// 新增：加載記憶開關狀態
function loadMemoryToggleState() {
  chrome.storage.local.get(['memoryEnabled'], (result) => {
    // 預設為不記憶（false）
    memoryToggle.checked = result.memoryEnabled || false;
    updateMemoryToggleDisplay();
  });
}

// 新增：更新記憶開關顯示
function updateMemoryToggleDisplay() {
  const toggleLabel = document.querySelector('.toggle-label');
  if (memoryToggle.checked) {
    toggleLabel.textContent = '記憶音量設定 ✓';
    toggleLabel.style.color = '#27ae60';
  } else {
    toggleLabel.textContent = '記憶音量設定';
    toggleLabel.style.color = '#2c3e50';
  }
}

// 新增：保存記憶開關狀態
function saveMemoryToggleState(enabled) {
  chrome.storage.local.set({ memoryEnabled: enabled });
}

// 更新音量顯示和警告
function updateVolumeDisplay(volume, isMuted) {
  if (isMuted) {
    volumeValue.textContent = '靜音';
    volumeValue.style.color = '#e74c3c';
    volumeWarning.style.display = 'none';
  } else {
    volumeValue.textContent = `${volume}%`;
    
    if (volume > 100) {
      volumeValue.style.color = '#e67e22';
      volumeWarning.style.display = 'block';
    } else {
      volumeValue.style.color = '#2ecc71';
      volumeWarning.style.display = 'none';
    }
  }
}

// 更新圖示徽章
function updateIconBadge(tabId, volume, isMuted) {
  chrome.runtime.sendMessage({
    action: 'updateIconBadge',
    tabId: tabId,
    volume: parseInt(volume),
    isMuted: isMuted
  });
}

// 保存視頻音量設定（新增：檢查記憶開關狀態）
function saveVideoVolumeSettings(tabId, url, volume, isMuted) {
  // 檢查記憶開關狀態，如果不啟用記憶則不保存
  if (!memoryToggle.checked) {
    console.log('記憶功能已關閉，不保存音量設定');
    return;
  }
  
  chrome.runtime.sendMessage({
    action: 'saveVideoVolumeSettings',
    tabId: tabId,
    url: url,
    volume: volume,
    isMuted: isMuted
  });
}

// 檢查視頻記憶狀態
function checkVideoMemory(url) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'checkVideoMemory',
      url: url
    }, (response) => {
      resolve(response ? response.hasMemory : false);
    });
  });
}

// 更新記憶狀態顯示
function updateMemoryIndicator(hasMemory) {
  let memoryIndicator = document.getElementById('memory-indicator');
  
  if (hasMemory) {
    if (!memoryIndicator) {
      memoryIndicator = document.createElement('div');
      memoryIndicator.id = 'memory-indicator';
      memoryIndicator.style.cssText = 'font-size: 12px; color: #27ae60; text-align: center; margin-top: 5px;';
      document.querySelector('.volume-container').appendChild(memoryIndicator);
    }
    memoryIndicator.textContent = '🔗 已記憶此視頻音量';
  } else if (memoryIndicator) {
    memoryIndicator.remove();
  }
}

// 載入設定列表
function loadSettingsList() {
  chrome.runtime.sendMessage({ action: 'getAllSettings' }, (response) => {
    settingsData = response.settings || [];
    renderSettingsList();
  });
}

// 渲染設定列表
function renderSettingsList() {
  settingsList.innerHTML = '';
  
  if (settingsData.length === 0) {
    settingsList.innerHTML = '<div class="empty-settings">尚未記憶任何網站的音量設定</div>';
    settingsCount.textContent = '(0)';
    return;
  }
  
  settingsCount.textContent = `(${settingsData.length})`;
  
  settingsData.forEach((setting, index) => {
    const settingItem = document.createElement('div');
    settingItem.className = 'setting-item';
    
    // 決定顯示的文字
    let displayText = '';
    
    if (setting.title) {
      // 如果有影片名稱，使用影片名稱
      displayText = setting.title;
    } else if (setting.url.startsWith('youtube:')) {
      // 如果沒有名稱但有YouTube ID，顯示格式化的ID
      const videoId = setting.url.replace('youtube:', '');
      displayText = `YouTube: ${videoId}`;
    } else {
      // 其他情況顯示網址
      displayText = setting.url;
    }
    
    // 限制文字長度，防止超出UI寬度
    if (displayText.length > 40) {
      displayText = displayText.substring(0, 37) + '...';
    }
    
    // 格式化時間
    const timeAgo = formatTimeAgo(setting.timestamp);
    
    settingItem.innerHTML = `
      <input type="checkbox" id="setting-${index}" data-url="${setting.url}">
      <div style="flex: 1; min-width: 0;">
        <div class="setting-url" title="${setting.title || setting.url}">${displayText}</div>
        ${false ? `<div class="setting-time">${timeAgo}</div>` : ''}
      </div>
      <span class="setting-volume">${setting.isMuted ? '靜音' : setting.volume + '%'}</span>
    `;
    
    settingsList.appendChild(settingItem);
  });
}

// 時間格式化函數
function formatTimeAgo(timestamp) {
  if (!timestamp) return '時間未知';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;
  
  if (diff < minute) {
    return '剛剛';
  } else if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes} 分鐘前`;
  } else if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours} 小時前`;
  } else if (diff < week) {
    const days = Math.floor(diff / day);
    return `${days} 天前`;
  } else if (diff < month) {
    const weeks = Math.floor(diff / week);
    return `${weeks} 週前`;
  } else if (diff < year) {
    const months = Math.floor(diff / month);
    return `${months} 月前`;
  } else {
    const years = Math.floor(diff / year);
    return `${years} 年前`;
  }
}

// 匯出設定
function exportSettings() {
  chrome.runtime.sendMessage({ action: 'exportSettings' }, (response) => {
    if (response.success) {
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `volume-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('設定已成功匯出！');
    } else {
      alert('匯出設定時發生錯誤：' + response.error);
    }
  });
}

// 匯入設定
function importSettings(file) {
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      const settings = JSON.parse(e.target.result);
      
      chrome.runtime.sendMessage({ 
        action: 'importSettings', 
        settings: settings 
      }, (response) => {
        if (response.success) {
          alert(`設定已成功匯入！已載入 ${response.importedCount} 個設定項目。`);
          loadSettingsList(); // 重新載入設定列表
        } else {
          alert('匯入設定時發生錯誤：' + response.error);
        }
      });
    } catch (error) {
      alert('檔案格式錯誤，請選擇有效的JSON檔案。');
    }
  };
  
  reader.readAsText(file);
}

// 刪除選取的設定
function deleteSelectedSettings() {
  const selectedUrls = [];
  const checkboxes = settingsList.querySelectorAll('input[type="checkbox"]:checked');
  
  checkboxes.forEach(checkbox => {
    selectedUrls.push(checkbox.getAttribute('data-url'));
  });
  
  if (selectedUrls.length === 0) {
    alert('請先選擇要刪除的設定項目。');
    return;
  }
  
  if (confirm(`確定要刪除 ${selectedUrls.length} 個設定項目嗎？此操作無法復原。`)) {
    chrome.runtime.sendMessage({ 
      action: 'deleteSettings', 
      urls: selectedUrls 
    }, (response) => {
      if (response.success) {
        alert(`已成功刪除 ${response.deletedCount} 個設定項目。`);
        loadSettingsList(); // 重新載入設定列表
      } else {
        alert('刪除設定時發生錯誤：' + response.error);
      }
    });
  }
}

// 全選/取消全選
function toggleSelectAll() {
  const checkboxes = settingsList.querySelectorAll('input[type="checkbox"]');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = !allChecked;
  });
  
  selectAllBtn.textContent = allChecked ? '全選' : '取消全選';
}

// 獲取當前分頁資訊
chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
  if (tabs[0]) {
    const tab = tabs[0];
    tabTitle.textContent = tab.title ? tab.title.replace(/^[🔇🔊🔈]\d*%?\s*/, '') : '無標題';
    
    // 從分頁專用存儲加載設置
    const tabId = tab.id;
    chrome.storage.local.get([`tabVolume_${tabId}`, `tabMuted_${tabId}`], async (result) => {
      const volume = result[`tabVolume_${tabId}`] !== undefined ? result[`tabVolume_${tabId}`] : 100;
      const isMuted = result[`tabMuted_${tabId}`] || false;
      
      volumeSlider.value = volume;
      updateVolumeDisplay(volume, isMuted);
      
      if (isMuted) {
        muteBtn.classList.add('active');
        muteBtn.textContent = '取消靜音';
      } else {
        muteBtn.classList.remove('active');
        muteBtn.textContent = '靜音';
      }
      
      // 檢查並顯示視頻記憶狀態
      if (tab.url) {
        const hasMemory = await checkVideoMemory(tab.url);
        updateMemoryIndicator(hasMemory);
      }
    });
  }
  
  // 載入設定列表
  loadSettingsList();
  
  // 新增：載入記憶開關狀態
  loadMemoryToggleState();
});

// 新增：記憶開關事件監聽
memoryToggle.addEventListener('change', () => {
  updateMemoryToggleDisplay();
  saveMemoryToggleState(memoryToggle.checked);
  
  // 如果關閉記憶功能，顯示提示
  if (!memoryToggle.checked) {
    const notification = document.createElement('div');
    notification.textContent = '記憶功能已關閉，新的音量設定將不會被保存';
    notification.style.cssText = 'position: fixed; top: 10px; left: 50%; transform: translateX(-50%); background: #f39c12; color: white; padding: 8px 12px; border-radius: 4px; z-index: 1000; font-size: 12px;';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
});

// 音量滑塊事件
volumeSlider.addEventListener('input', () => {
  const volume = volumeSlider.value;
  updateVolumeDisplay(volume, false);
  
  // 保存設置到當前分頁
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0]) {
      const tab = tabs[0];
      const tabId = tab.id;
      
      chrome.storage.local.set({ 
        [`tabVolume_${tabId}`]: parseInt(volume),
        [`tabMuted_${tabId}`]: false
      });
      
      // 保存到視頻記憶（新增：檢查記憶開關狀態）
      if (tab.url) {
        saveVideoVolumeSettings(tabId, tab.url, parseInt(volume), false);
      }
      
      // 更新圖示徽章
      updateIconBadge(tabId, volume, false);
      
      // 更新記憶狀態顯示
      checkVideoMemory(tab.url).then(hasMemory => {
        updateMemoryIndicator(hasMemory);
      });
      
      // 重新載入設定列表（可能有新項目）
      loadSettingsList();
      
      // 發送消息到當前分頁
      chrome.tabs.sendMessage(tabId, {
        action: 'setVolume',
        volume: parseInt(volume) / 100
      });
    }
  });
  
  muteBtn.classList.remove('active');
  muteBtn.textContent = '靜音';
});

// 靜音按鈕事件
muteBtn.addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0]) {
      const tab = tabs[0];
      const tabId = tab.id;
      
      chrome.storage.local.get([`tabMuted_${tabId}`], (result) => {
        const isMuted = !result[`tabMuted_${tabId}`];
        
        chrome.storage.local.set({ [`tabMuted_${tabId}`]: isMuted });
        
        // 保存到視頻記憶（新增：檢查記憶開關狀態）
        if (tab.url) {
          const currentVolume = volumeSlider.value;
          saveVideoVolumeSettings(tabId, tab.url, parseInt(currentVolume), isMuted);
        }
        
        if (isMuted) {
          muteBtn.classList.add('active');
          muteBtn.textContent = '取消靜音';
        } else {
          muteBtn.classList.remove('active');
          muteBtn.textContent = '靜音';
        }
        
        updateVolumeDisplay(volumeSlider.value, isMuted);
        
        // 更新圖示徽章
        updateIconBadge(tabId, volumeSlider.value, isMuted);
        
        // 更新記憶狀態顯示
        checkVideoMemory(tab.url).then(hasMemory => {
          updateMemoryIndicator(hasMemory);
        });
        
        // 重新載入設定列表
        loadSettingsList();
        
        // 發送消息到當前分頁
        chrome.tabs.sendMessage(tabId, {
          action: 'toggleMute',
          isMuted
        });
      });
    }
  });
});

// 重置按鈕事件
resetBtn.addEventListener('click', () => {
  volumeSlider.value = 100;
  updateVolumeDisplay(100, false);
  
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0]) {
      const tab = tabs[0];
      const tabId = tab.id;
      
      chrome.storage.local.set({ 
        [`tabVolume_${tabId}`]: 100,
        [`tabMuted_${tabId}`]: false
      });
      
      // 保存到視頻記憶（重置為預設值）
      if (tab.url) {
        saveVideoVolumeSettings(tabId, tab.url, 100, false);
      }
      
      // 更新圖示徽章
      updateIconBadge(tabId, 100, false);
      
      // 更新記憶狀態顯示
      checkVideoMemory(tab.url).then(hasMemory => {
        updateMemoryIndicator(hasMemory);
      });
      
      // 重新載入設定列表
      loadSettingsList();
      
      muteBtn.classList.remove('active');
      muteBtn.textContent = '靜音';
      
      // 發送消息到當前分頁
      chrome.tabs.sendMessage(tabId, {
        action: 'setVolume',
        volume: 1.0
      });
    }
  });
});

// 匯出按鈕事件
exportBtn.addEventListener('click', exportSettings);

// 匯入按鈕事件
importBtn.addEventListener('click', () => {
  importFile.click();
});

// 檔案選擇事件
importFile.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    importSettings(e.target.files[0]);
    e.target.value = ''; // 重置input，允許選擇相同檔案
  }
});

// 更改快捷鍵按鈕事件
changeShortcutsBtn.addEventListener('click', () => {
  chrome.tabs.create({url: 'chrome://extensions/shortcuts'});
});

// 全選按鈕事件
selectAllBtn.addEventListener('click', toggleSelectAll);

// 刪除選取項目按鈕事件
deleteSelectedBtn.addEventListener('click', deleteSelectedSettings);