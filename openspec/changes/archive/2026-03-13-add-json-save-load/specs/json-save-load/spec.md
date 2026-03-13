## ADDED Requirements

### Requirement: 遊戲狀態會自動暫存到 localStorage
系統應在每次有效遊戲互動完成後，自動將目前遊戲狀態寫入 localStorage，讓使用者重新整理頁面後仍可續玩。

#### Scenario: 互動後更新自動暫存
- **WHEN** 玩家完成一個會改變遊戲狀態的互動，例如開局、擲骰結算、買地、升級、抽牌、結束回合或載入存檔
- **THEN** 系統應將最新的遊戲快照寫入 localStorage

### Requirement: 玩家可以匯出 JSON 存檔
系統應允許玩家將目前遊戲狀態匯出成 JSON 檔案下載到本機。

#### Scenario: 匯出目前局面
- **WHEN** 玩家在遊戲進行中執行匯出存檔操作
- **THEN** 系統應產生包含版本資訊與完整遊戲狀態的 JSON 檔案供使用者下載

### Requirement: 玩家可以從 JSON 檔案載入遊戲
系統應允許玩家選擇一個 JSON 存檔檔案，並在驗證成功後載入該遊戲狀態。

#### Scenario: 載入有效的 JSON 存檔
- **WHEN** 玩家選擇一個格式正確且通過驗證的 JSON 存檔
- **THEN** 系統應還原其中的遊戲狀態到目前畫面中

### Requirement: 匯入前必須提醒覆蓋目前進度與自動暫存
在匯入 JSON 存檔之前，系統應提醒使用者此操作會覆蓋目前畫面中的遊戲進度與 localStorage 自動暫存，並要求使用者明確同意。

#### Scenario: 匯入前顯示覆蓋確認
- **WHEN** 使用者選擇一個通過驗證的 JSON 存檔準備載入
- **THEN** 系統應先顯示覆蓋提醒與確認流程，只有在使用者同意後才正式套用並覆蓋 localStorage

### Requirement: 系統必須拒絕無效或不相容的存檔
系統應驗證 JSON 存檔的版本、必要欄位與資料結構，若驗證失敗則不得套用任何狀態。

#### Scenario: 拒絕無效存檔
- **WHEN** 使用者載入一個缺少必要欄位、格式錯誤或版本不相容的 JSON 存檔
- **THEN** 系統應拒絕載入，保留目前畫面與 localStorage 內容不變，並顯示錯誤訊息