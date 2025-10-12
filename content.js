
// 存儲當前分頁的音頻上下文和增益節點
let audioContext = null;
let gainNode = null;
let originalVolume = 1.0;
let isInitialized = false;

// 新增：追蹤當前URL和音量狀態，避免重複保存
let currentUrl = '';
let lastSavedVolume = 100;
let lastSavedMuted = false;

// =========================================================================
// 新增: AudioContext 激活函數 (必須在用戶手勢中調用)
// =========================================================================
function activateAudioContext() {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume()
      .then(() => {
        console.log('AudioContext 已通過用戶手勢成功喚醒');
        // 喚醒後立即應用儲存的音量（如果還沒應用）
        if (gainNode) {
             gainNode.gain.value = originalVolume;
        }
        
        // 移除手勢監聽器，因為只執行一次
        removeGestureListeners();
      })
      .catch(error => {
        console.error('AudioContext 喚醒失敗:', error);
      });
  } else if (audioContext && audioContext.state === 'running') {
      // 已經在運行了，也移除監聽器
      removeGestureListeners();
  }
}

// 移除手勢監聽器
function removeGestureListeners() {
  document.removeEventListener('click', activateAudioContext, { capture: true });
  document.removeEventListener('keydown', activateAudioContext, { capture: true });
  document.removeEventListener('touchstart', activateAudioContext, { capture: true });
  console.log('AudioContext 激活監聽器已移除。');
}

// =========================================================================
// 新增: 設置用戶手勢監聽器
// =========================================================================
function setupGestureListeners() {
  // 監聽點擊、按鍵和觸摸，嘗試喚醒 AudioContext
  // capture: true 確保能在事件被頁面上的其他元素阻止之前捕捉到
  document.addEventListener('click', activateAudioContext, { capture: true });
  document.addEventListener('keydown', activateAudioContext, { capture: true });
  document.addEventListener('touchstart', activateAudioContext, { capture: true });
}

// 初始化音頻處理 (只創建，不保證喚醒)
function initAudioProcessing() {
  if (isInitialized) return;
  isInitialized = true;
  
  // 設置當前URL
  currentUrl = window.location.href;
  
  try {
    // 創建音頻上下文，此時狀態通常為 'suspended'
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // 創建增益節點
    gainNode = audioContext.createGain();
    gainNode.gain.value = originalVolume; // 設置初始值
    
    // 連接節點
    gainNode.connect(audioContext.destination);
    
    // 啟動音頻攔截
    interceptAudioElements();
    
    console.log('音頻處理已初始化。AudioContext 狀態:', audioContext.state);
    
    // 立即嘗試在初始化時喚醒一次 (如果不是在手勢上下文中，將會失敗，但無害)
    activateAudioContext();
    
  } catch (error) {
    console.error('初始化音頻處理失敗:', error);
    // 如果失敗，仍設置監聽器，以備用戶手動交互
    setupGestureListeners();
    return;
  }
  
  // 設置手勢監聽器，以備 AudioContext 處於 suspended 狀態
  if (audioContext.state === 'suspended') {
    setupGestureListeners();
  }
}

// 處理媒體元素的音頻連接
function processMediaElement(mediaElement) {
  // 檢查是否已經處理過
  if (mediaElement.__audio_gain_connected) return;
  
  // 檢查是否是音頻或帶音頻的視頻
  if (mediaElement.tagName === 'AUDIO' || mediaElement.tagName === 'VIDEO') {
    if (!audioContext || !gainNode) return;
    
    try {
      // 創建音頻源節點
      const source = audioContext.createMediaElementSource(mediaElement);
      
      // 連接：Source -> GainNode -> Destination
      source.connect(gainNode);
      
      mediaElement.__audio_gain_connected = true;
      console.log('成功連接媒體元素:', mediaElement.tagName);
      
    } catch (error) {
      console.warn('音頻連接失敗 (可能不是帶音頻的元素或已連接):', error);
    }
  }
}

// 攔截頁面上已存在的和新創建的媒體元素
function interceptAudioElements() {
  const mediaElements = document.querySelectorAll('video, audio');
  mediaElements.forEach(processMediaElement);

  // 使用 MutationObserver 監聽新的媒體元素
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        // 使用 setTimeout 延遲處理，確保元素完全初始化
        if (node.nodeType === 1 && (node.tagName === 'VIDEO' || node.tagName === 'AUDIO')) {
          setTimeout(() => processMediaElement(node), 100);
        }
        // 檢查子節點中是否有媒體元素
        if (node.querySelectorAll) {
          node.querySelectorAll('video, audio').forEach(el => {
            setTimeout(() => processMediaElement(el), 100);
          });
        }
      });
    });
    
    // 檢查 iyf.tv 元素 (如果需要的話)
    if (window.location.href.includes('iyf.tv')) {
      handleIyfTvSpecific();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// 針對 iyf.tv 網站的特殊處理
let iyfTvInterval = null;
function handleIyfTvSpecific() {
  if (iyfTvInterval) return; // 避免重複設置
  
  iyfTvInterval = setInterval(() => {
    // 查找 iyf.tv 專用的播放器元素
    const player = document.querySelector('.player-wrapper video');
    if (player && !player.__audio_gain_connected) {
      processMediaElement(player);
      // 找到並處理後，不需要頻繁檢查
      if (player.__audio_gain_connected) {
        clearInterval(iyfTvInterval);
        iyfTvInterval = null;
      }
    }
    
    // 如果長時間未找到，考慮停止檢查
    // 這裡為了簡潔暫時不加計數器
    
  }, 500); // 每 500 毫秒檢查一次
}

// 更新圖示徽章
function updateIconBadge(volume, isMuted) {
  const volumePercent = Math.round(volume * 100);
  
  // 發送消息到 background.js 更新圖示
  chrome.runtime.sendMessage({
    action: 'updateIconBadgeFromContent',
    volume: volumePercent,
    isMuted: isMuted
  });
}

// 顯示音量通知
function showVolumeNotification(volume) {
  const volumePercent = Math.round(volume * 100);
  // 在頁面右下角顯示通知
  let notification = document.getElementById('volume-notification');
  
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'volume-notification';
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 10px 15px;
      border-radius: 8px;
      z-index: 99999;
      font-size: 16px;
      transition: opacity 0.3s ease-in-out;
      pointer-events: none; /* 讓點擊穿透 */
    `;
    document.body.appendChild(notification);
  }
  
  notification.textContent = `音量: ${volumePercent}%`;
  notification.style.opacity = '1';
  
  // 設置延遲移除
  clearTimeout(notification.timeoutId);
  notification.timeoutId = setTimeout(() => {
    notification.style.opacity = '0';
  }, 2000);
}

// 設置音量（修改：根據 isMemoryApply 決定是否保存）
function setVolume(volume, showNotification = true, isMemoryApply = false) {
  if (!gainNode) return;
  
  const newVolume = Math.min(6.0, Math.max(0.0, volume));
  const volumePercent = Math.round(newVolume * 100);
  const isMuted = newVolume === 0;
  
  if (audioContext && audioContext.state === 'suspended') {
    activateAudioContext();
  }
  
  try {
    gainNode.gain.value = newVolume;
    originalVolume = newVolume;
    
    // 移除標題更新，只更新圖示徽章
    updateIconBadge(newVolume, isMuted);
    
    // 只有在不是應用記憶設定、且音量實際改變時才保存
    const shouldSave = !isMemoryApply && (volumePercent !== lastSavedVolume || isMuted !== lastSavedMuted);
    
    if (shouldSave) {
      // 獲取乾淨的影片名稱
      const videoTitle = getCleanVideoTitle();
      
      // 發送消息到 background.js 存儲音量
      chrome.runtime.sendMessage({
        action: 'saveVolumeSettings',
        url: window.location.href,
        volume: volumePercent,
        isMuted: isMuted,
        videoTitle: videoTitle
      }, (response) => {
        if (response && response.success) {
          // 更新追蹤狀態
          lastSavedVolume = volumePercent;
          lastSavedMuted = isMuted;
          console.log('音量設定已保存:', volumePercent, isMuted);
        }
      });
    } else {
      console.log('不保存音量設定:', {
        isMemoryApply,
        volumeChanged: volumePercent !== lastSavedVolume || isMuted !== lastSavedMuted,
        currentVolume: volumePercent,
        lastSavedVolume,
        currentMuted: isMuted,
        lastSavedMuted
      });
    }
      
    if (showNotification && !isMemoryApply) {
      showVolumeNotification(newVolume);
    }
  } catch (error) {
    console.error('設置音量失敗:', error);
  }
}

// 獲取乾淨的影片名稱
function getCleanVideoTitle() {
  try {
    let cleanTitle = document.title;
    
    // 針對 YouTube 的特殊處理
    if (window.location.hostname.includes('youtube.com') || 
        window.location.hostname.includes('youtu.be')) {
      
      const titleSelectors = [
        'h1.ytd-watch-metadata',
        '.title.style-scope.ytd-video-primary-info-renderer',
        'h1.title yt-formatted-string',
        'ytd-video-primary-info-renderer h1',
        '#container h1',
        'h1 yt-formatted-string'
      ];
      
      for (const selector of titleSelectors) {
        const titleElement = document.querySelector(selector);
        if (titleElement) {
          let title = titleElement.textContent || titleElement.innerText;
          if (title && title.trim()) {
            return title.trim();
          }
        }
      }
      
      // 如果選擇器都失敗，使用清理後的 document.title
      if (cleanTitle && !cleanTitle.includes('YouTube')) {
        return cleanTitle.replace(' - YouTube', '').trim();
      }
    }
    
    // 針對 iyf.tv 的特殊處理
    if (window.location.hostname.includes('iyf.tv')) {
      const titleSelectors = [
        'h1',
        '.video-title',
        '.title',
        '[class*="title"]',
        'header h1',
        '.video-info h1',
        '.player-title',
        '.play-title'
      ];
      
      for (const selector of titleSelectors) {
        const titleElement = document.querySelector(selector);
        if (titleElement) {
          let title = titleElement.textContent || titleElement.innerText;
          if (title && title.trim() && title.length > 5) {
            return title.trim();
          }
        }
      }
    }
    
    // 通用標題獲取
    const mainTitleSelectors = [
      'h1',
      '.title',
      '.heading',
      '[role="heading"]',
      'header h1',
      'main h1'
    ];
    
    for (const selector of mainTitleSelectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement) {
        let title = titleElement.textContent || titleElement.innerText;
        if (title && title.trim() && title.length > 10) {
          return title.trim().substring(0, 100); // 限制長度
        }
      }
    }
    
    // 最終回退方案
    return cleanTitle || '未知內容';
    
  } catch (error) {
    console.error('獲取影片名稱時出錯:', error);
    return document.title || '未知內容';
  }
}

// 切換靜音（修改：根據 isMemoryApply 決定是否保存）
function toggleMute(shouldMute, showNotification = true, isMemoryApply = false) {
  if (!gainNode) return;
  
  // 檢查 AudioContext 是否需要喚醒
  if (audioContext && audioContext.state === 'suspended') {
      // 同樣，嘗試喚醒
      activateAudioContext();
  }
  
  if (shouldMute) {
    if (gainNode.gain.value !== 0) {
      originalVolume = gainNode.gain.value; // 靜音前保存當前音量
    }
    setVolume(0, showNotification, isMemoryApply);
  } else {
    // 從靜音恢復
    const newVolume = originalVolume === 0 ? 1.0 : originalVolume; // 避免從 0% 靜音恢復到 0%
    setVolume(newVolume, showNotification, isMemoryApply);
  }
}

// 監聽URL變化，更新追蹤狀態
let lastUrl = window.location.href;
function checkUrlChange() {
  const newUrl = window.location.href;
  if (newUrl !== lastUrl) {
    console.log('URL變化，重置保存狀態:', newUrl);
    lastUrl = newUrl;
    currentUrl = newUrl;
    
    // 重置追蹤狀態
    lastSavedVolume = 100;
    lastSavedMuted = false;
    
    // 檢查新URL是否有記憶設定
    chrome.runtime.sendMessage({ action: 'checkVideoMemory', url: newUrl }, (response) => {
      if (response && response.hasMemory) {
        console.log('新URL有記憶設定');
        chrome.runtime.sendMessage({ action: 'getVideoVolumeSettings', url: newUrl }, (settings) => {
          if (settings && settings.volume !== undefined) {
            // 更新追蹤狀態但不保存
            lastSavedVolume = settings.volume;
            lastSavedMuted = settings.isMuted;
            console.log('更新追蹤狀態:', lastSavedVolume, lastSavedMuted);
          }
        });
      } else {
        console.log('新URL沒有記憶設定');
      }
    });
  }
}

// 定期檢查URL變化
setInterval(checkUrlChange, 1000);

// 在 content.js 中添加獲取當前狀態的消息處理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 不再在這裡強制執行 initAudioProcessing()，因為它可能會在非手勢上下文中創建 AudioContext。
  // 我們將在 DOMContentLoaded 或頁面加載完成後執行它。

  // 但如果收到了操作命令，且尚未初始化，我們仍需初始化。
  if (!isInitialized) {
    // 如果這裡執行了 initAudioProcessing，AudioContext 狀態可能是 suspended
    initAudioProcessing();
  }
  
  // 收到任何來自 popup 或 background 的消息，**如果 AudioContext 懸停，也嘗試喚醒**
  activateAudioContext();
  
  switch (request.action) {
    case 'setVolume':
      setVolume(request.volume, request.showNotification || false, request.isMemoryApply || false);
      break;
    case 'toggleMute':
      toggleMute(request.isMuted, request.showNotification || false, request.isMemoryApply || false);
      break;
    case 'getCurrentVolumeState':
      // 返回當前音量狀態
      sendResponse({
        success: true,
        volume: gainNode ? gainNode.gain.value : 1.0,
        isMuted: gainNode ? gainNode.gain.value === 0 : false
      });
      break;
    case 'getCleanVideoTitle':
      // 返回清理後的影片標題
      const title = getCleanVideoTitle();
      sendResponse({ title: title });
      break;
  }
});

// 頁面加載完成後初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAudioProcessing);
} else {
  // DOM 已經就緒，直接初始化
  initAudioProcessing();
}

// 處理頁面可見性變化
document.addEventListener('visibilitychange', () => {
  // 如果分頁隱藏了，部分瀏覽器可能會暫停 AudioContext
  if (audioContext && document.hidden) {
    // 可以在這裡暫停或不做處理
    // audioContext.suspend(); 
  } else if (audioContext && audioContext.state === 'suspended' && !document.hidden) {
    // 分頁再次可見時，嘗試喚醒（但不保證成功，因為不是手勢）
    audioContext.resume().catch(e => console.log("分頁可見性變化喚醒失敗:", e));
  }
});

// 初始化時設置一次快捷鍵監聽器
setupGestureListeners();