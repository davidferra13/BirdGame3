# Menu Testing Guide

This guide helps you thoroughly test all the new menu features that were added to Bird Game 3D.

## 🎮 Testing Checklist

### Main Menu - All Buttons

When you open the game at http://localhost:5178/, you should see the main menu with 10 buttons:

---

### ✅ 1. PLAY Button
**Expected behavior:**
- Clicking starts the game
- Main menu disappears
- Game loads with the bird on a rooftop
- "Drop it." tutorial message appears

**Test:** Click PLAY and verify game starts normally

---

### ✅ 2. HOW TO PLAY Button
**Expected behavior:**
- Opens a detailed tutorial panel
- Shows 5 sections:
  - ✈️ Flight Controls (WASD, Mouse, Space, Ctrl, Q, E)
  - 💩 Poop Controls (Left Click)
  - 🎯 Gameplay (5 numbered steps)
  - 🌟 Special Features (Right Click, M, L, A, B, ESC, F1)
  - 💡 Pro Tips (5 tips)
- CLOSE button returns to main menu
- Panel is scrollable if needed
- Blue gradient background

**Test steps:**
1. Click "HOW TO PLAY"
2. Verify all sections are visible and readable
3. Scroll through the content
4. Click CLOSE
5. Verify you return to main menu

---

### ✅ 3. STATS Button
**Expected behavior:**
- Shows player statistics panel
- If game hasn't been played yet, shows zeros
- If game has been played, shows actual stats:
  - Total NPC hits by type
  - Highest heat/streak
  - Lifetime coins earned
  - Total distance flown
  - Banking stats
- CLOSE button returns to main menu

**Test steps:**
1. Click "STATS" (before playing)
2. Verify all stats show 0 or default values
3. Click CLOSE
4. Play the game and hit some NPCs
5. Return to menu (ESC → Quit to Menu)
6. Click "STATS" again
7. Verify stats are updated

---

### ✅ 4. LEADERBIRD Button
**Expected behavior:**
- **Before playing:** Shows notification "Start the game first to view LeaderBird!"
- **After game starts:** Opens LeaderBird panel with:
  - Two tabs: GLOBAL and FRIENDS
  - Displays top 50 players (if data exists)
  - Shows rank medals (🥇🥈🥉) for top 3
  - Each entry shows: Rank, Player Name, Level, Coins
  - CLOSE button returns to main menu

**Test steps:**
1. Click "LEADERBIRD" before playing
2. Verify notification appears
3. Click PLAY to start game
4. Press ESC to pause
5. Press ESC again to return to menu
6. Click "LEADERBIRD"
7. Verify panel opens
8. Click GLOBAL and FRIENDS tabs
9. Verify data loads (or shows "No players yet!")
10. Click CLOSE

---

### ✅ 5. ACHIEVEMENTS Button
**Expected behavior:**
- **Before playing:** Shows notification "Start the game first to view achievements!"
- **After game starts:** Opens achievements panel with:
  - Summary showing unlocked count and percentage
  - Grid of achievement cards
  - 12 default achievements (First Strike, Hot Streak, etc.)
  - Unlocked achievements: full color, green glow on hover
  - Locked achievements: grayscale, dim
  - Each card shows icon, name, description
  - CLOSE button returns to main menu

**Test steps:**
1. Click "ACHIEVEMENTS" before playing
2. Verify notification appears
3. Start game and play
4. Return to menu
5. Click "ACHIEVEMENTS"
6. Verify panel shows all 12 achievements
7. Hover over unlocked achievements (should glow)
8. Hover over locked achievements (no effect)
9. Click CLOSE

---

### ✅ 6. COSMETICS Button
**Expected behavior:**
- **Before playing:** Shows notification "Start the game first to access cosmetics!"
- **After game starts:** Opens the shop menu showing:
  - Available cosmetic items
  - Prices in coins or feathers
  - Equip buttons for owned items
  - Purchase buttons for unowned items
  - CLOSE button returns to main menu

**Test steps:**
1. Click "COSMETICS" before playing
2. Verify notification appears
3. Start game
4. Return to menu
5. Click "COSMETICS"
6. Verify shop opens
7. Browse items
8. Click CLOSE or ESC

---

### ✅ 7. INVITE A FRIEND Button
**Expected behavior:**
- Opens sharing panel with:
  - **Share link section:**
    - Input field with current URL
    - COPY button
    - Clicking COPY changes button to "✓ COPIED!" for 2 seconds
  - **Social media buttons (2x2 grid):**
    - 𝕏 Twitter (blue border, opens Twitter share dialog)
    - 📘 Facebook (blue border, opens Facebook share)
    - 💬 WhatsApp (green border, opens WhatsApp share)
    - 📱 Text Message (purple border, opens SMS)
  - **Native share button** (if browser supports it):
    - "📤 Share via..." button
    - Opens device's native share sheet
  - CLOSE button returns to main menu

**Test steps:**
1. Click "INVITE A FRIEND"
2. Verify panel opens
3. Test COPY button:
   - Click COPY
   - Verify button changes to "✓ COPIED!"
   - Verify it reverts after 2 seconds
4. Test Twitter button (opens popup)
5. Test Facebook button (opens popup)
6. Test WhatsApp button (opens WhatsApp or web.whatsapp.com)
7. Test Text Message button (opens SMS app)
8. If on mobile/supported browser, test native share button
9. Click CLOSE

---

### ✅ 8. SETTINGS Button
**Expected behavior:**
- **Before playing:** Shows notification "Start the game first to access settings!"
- **After game starts:** Opens settings menu with:
  - Graphics quality (Low/Medium/High)
  - Mouse sensitivity slider
  - Invert Y-axis toggle
  - Master volume slider
  - SFX volume slider
  - Music volume slider
  - Reset Tutorial button
  - CLOSE button

**Test steps:**
1. Click "SETTINGS" before playing
2. Verify notification appears
3. Start game
4. Return to menu
5. Click "SETTINGS"
6. Verify settings panel opens
7. Adjust each setting and verify changes apply
8. Click CLOSE

---

### ✅ 9. CREDITS Button
**Expected behavior:**
- Opens credits panel showing:
  - Game title and tagline
  - **Sections:**
    - Game Development (Lead Developer, Game Design, Programming)
    - Art & Design (3D Modeling, UI/UX, VFX)
    - Audio (Music, Sound Effects)
    - Technology (Three.js, TypeScript, Vite, Supabase)
    - Special Thanks
  - Footer with copyright and "Made with ❤️ and 💩"
  - CLOSE button returns to main menu

**Test steps:**
1. Click "CREDITS"
2. Verify panel opens with all sections
3. Verify all sections are readable
4. Scroll through if needed
5. Click CLOSE
6. Verify return to main menu

---

### ✅ 10. QUIT Button
**Expected behavior:**
- Shows browser confirmation dialog: "Are you sure you want to quit?"
- **If YES:**
  - Attempts to close window
  - If blocked by browser, shows notification: "Cannot close window. Refreshing page instead..."
  - After 2 seconds, reloads the page
- **If NO/Cancel:**
  - Returns to main menu

**Test steps:**
1. Click "QUIT"
2. Verify confirmation dialog appears
3. Click CANCEL - verify nothing happens
4. Click "QUIT" again
5. Click OK/Yes
6. Verify window closes or page reloads

---

## 🎨 Visual Testing

### Button Styling
All menu buttons should:
- Have semi-transparent white background
- Show on hover:
  - Lighter background
  - Scale up slightly (1.05x)
- Have smooth transitions
- Be keyboard accessible (Tab to navigate, Enter to activate)

### Panel Styling
All panels should have:
- Dark blue gradient background
- Semi-transparent dark overlay behind panel
- Rounded corners
- Smooth fade-in animation
- Scrollable content (if too tall)
- Close button at bottom
- Close button hover effect (lighter bg, scale up)

---

## 🔧 Browser Console Testing

Open browser console (F12) and verify:

### No Errors
- No red errors in console when:
  - Opening any panel
  - Clicking any button
  - Closing any panel
  - Sharing via social media

### Expected Console Logs
- ✅ "Game initialized successfully" on page load
- ⚠️ "Share cancelled or failed" - only if user cancels native share

---

## 📱 Mobile Testing

If testing on mobile:

### Responsive Design
- All panels should fit on screen
- Text should be readable
- Buttons should be tappable
- Scrolling should work smoothly

### Touch Interactions
- Tap to open panels
- Tap to close panels
- Social share buttons work with touch

### Native Share
- "📤 Share via..." button should appear
- Tapping it opens device share sheet
- Can share to installed apps

---

## 🐛 Common Issues & Solutions

### Issue: "Start the game first" notification appears
**Solution:** This is correct behavior for Achievements, LeaderBird, Settings, and Cosmetics when accessed before starting the game. Click PLAY first.

### Issue: Share buttons open popup blockers
**Solution:** This is expected browser behavior. Allow popups for localhost.

### Issue: Copy button doesn't work
**Solution:** Some browsers block clipboard access on HTTP. Use HTTPS or allow clipboard permissions.

### Issue: Native share button doesn't appear
**Solution:** Only appears on browsers/devices that support Web Share API (modern mobile browsers, some desktop browsers).

### Issue: Window won't close on QUIT
**Solution:** Browsers block window.close() for windows not opened by JavaScript. The game will reload instead.

---

## ✅ Final Checklist

- [ ] All 10 buttons visible in main menu
- [ ] All buttons clickable and responsive
- [ ] HOW TO PLAY shows complete tutorial
- [ ] STATS displays correctly
- [ ] LEADERBIRD loads (or shows appropriate message)
- [ ] ACHIEVEMENTS shows all 12 achievements
- [ ] COSMETICS opens shop menu
- [ ] INVITE A FRIEND copy button works
- [ ] INVITE A FRIEND social buttons work
- [ ] SETTINGS opens (after starting game)
- [ ] CREDITS shows all sections
- [ ] QUIT confirmation works
- [ ] All panels close properly
- [ ] All panels return to main menu
- [ ] No console errors
- [ ] Hover effects work on all buttons
- [ ] Keyboard navigation works

---

## 📝 Notes

- You can customize the Credits panel by editing `src/ui/CreditsPanel.ts`
- Share message can be customized in `src/ui/InviteFriends.ts`
- Tutorial content can be updated in `src/ui/HowToPlay.ts`
- All panels use the same styling for consistency

---

**Happy Testing! 🎮💩**
