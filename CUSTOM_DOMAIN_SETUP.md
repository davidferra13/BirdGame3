# 🌐 Custom Local Domain Setup - birdgame3.local

This guide shows you how to run your Bird Game 3D on a custom local domain instead of `localhost`.

## ✅ Setup Complete!

Your Vite config has been updated to support custom hostnames.

---

## 📝 One-Time Setup Instructions

### Windows Setup:

1. **Open Notepad as Administrator**
   - Search for "Notepad" in Start Menu
   - Right-click → "Run as administrator"

2. **Open the Hosts File**
   - Click File → Open
   - Navigate to: `C:\Windows\System32\drivers\etc`
   - Change filter from "Text Documents" to "All Files"
   - Open the file named `hosts` (no extension)

3. **Add Custom Domain**
   - Scroll to the bottom
   - Add this line:
     ```
     127.0.0.1    birdgame3.local
     ```

4. **Save and Close**
   - File → Save
   - Close Notepad

---

## 🚀 Running the Game

Now when you run:

```bash
npm run dev
```

or

```bash
pnpm dev
```

The game will automatically open at:

**🎮 http://birdgame3.local:5175**

You can also access it at:
- http://localhost:5175 (still works)
- http://127.0.0.1:5175 (still works)
- http://birdgame3.local:5175 (**NEW!**)

---

## 🎯 Why Use a Custom Domain?

- ✅ Looks more professional
- ✅ Easier to remember
- ✅ Better for testing with friends on your network
- ✅ Can share with others: `http://YOUR_IP:5175` or `http://birdgame3.local:5175` (on same network)

---

## 🌍 Share with Friends on Your Network

If you want friends on the same WiFi to play:

1. Find your local IP address:
   ```bash
   ipconfig
   ```
   Look for "IPv4 Address" (something like `192.168.1.100`)

2. Share this URL with friends:
   ```
   http://YOUR_IP:5175
   ```
   Example: `http://192.168.1.100:5175`

3. They can play the game from their browser!

---

## 🔧 Troubleshooting

### Can't access birdgame3.local?

1. **Check hosts file** - Make sure you saved it correctly
2. **Restart browser** - Close all browser windows and reopen
3. **Clear DNS cache** (Windows):
   ```bash
   ipconfig /flushdns
   ```

### Port 5175 already in use?

Change the port in [vite.config.ts](vite.config.ts):
```ts
server: {
  port: 5176, // Change to any available port
  // ...
}
```

---

## 🎮 Ready to Play!

Your game is now accessible at **http://birdgame3.local:5175**

Enjoy your smooth, lag-free Bird Game 3D! 🐦✨
