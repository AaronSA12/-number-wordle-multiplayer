# Number Wordle - Multiplayer Internet Edition 🌐🎯

A real-time multiplayer number guessing game that you can play with anyone across the internet! Think of it as Wordle, but with numbers and real-time multiplayer gameplay.

## ✨ **New Multiplayer Features:**

- 🌐 **Real-time internet play** - Play with anyone anywhere in the world
- 🔒 **Private game rooms** - Each game has a unique 6-character code
- 👥 **Player names** - Customize your identity in each game
- 📱 **Live updates** - See opponent's moves in real-time
- 🔄 **Turn-based gameplay** - Automatic turn switching
- 📊 **Separate history tabs** - View your guesses vs. opponent's guesses
- 🚫 **No cheating** - Players can't see each other's secret numbers
- 📡 **Connection status** - Real-time connection monitoring

## 🚀 **How to Play Online:**

### 1. **Start the Server**
```bash
# Install dependencies
npm install

# Start the server
npm start

# Or for development with auto-restart
npm run dev
```

### 2. **Join a Game**
- **Player 1**: Creates a new game and gets a 6-character game code
- **Player 2**: Joins using the game code
- Both players enter their names and secret 5-digit sequences
- Game starts automatically when both players are ready

### 3. **Gameplay**
- Players take turns guessing each other's number sequences
- **Unlimited guesses** until someone wins
- **Real-time feedback** on each guess
- **Turn indicators** show whose turn it is
- **History tabs** let you see your guesses vs. opponent's guesses

### 4. **Winning**
- First player to correctly guess the complete sequence wins!
- Game ends immediately when someone gets all 5 numbers in the right positions

## 🎮 **Game Rules:**

- **Secret Numbers**: Each player sets a 5-digit sequence (0-9)
- **Guessing**: Players alternate turns guessing the other's sequence
- **Feedback**: After each guess, you see:
  - **Correct Numbers**: How many numbers appear in the target sequence
  - **Correct Positions**: How many numbers are in the exact right position
- **Privacy**: You can't see the other player's secret numbers
- **History**: View all previous guesses with feedback

## 🛠 **Technical Setup:**

### **Requirements:**
- Node.js (version 14 or higher)
- Modern web browser
- Internet connection

### **Installation:**
```bash
# Clone or download the game files
cd "Number game"

# Install dependencies
npm install

# Start the server
npm start
```

### **Access the Game:**
- Open your browser and go to: `http://localhost:3000`
- The server will be accessible from your local network
- For internet play, you'll need to deploy to a hosting service

## 🌍 **Playing Over the Internet:**

### **Option 1: Local Network (Same WiFi)**
- Both players connect to the same WiFi network
- Use the host computer's local IP address
- Example: `http://192.168.1.100:3000`

### **Option 2: Internet Deployment**
- Deploy to services like:
  - **Heroku** (free tier available)
  - **Railway** (free tier available)
  - **Render** (free tier available)
  - **DigitalOcean** (paid)
  - **AWS/GCP** (paid)

### **Option 3: Port Forwarding**
- Configure your router to forward port 3000
- Use your public IP address
- **Note**: This exposes your computer to the internet

## 📁 **File Structure:**
```
Number game/
├── index.html          # Game interface
├── styles.css          # Styling and animations
├── script.js           # Client-side game logic
├── server.js           # Multiplayer server
├── package.json        # Dependencies and scripts
└── README.md           # This file
```

## 🔧 **Server Configuration:**

### **Environment Variables:**
```bash
PORT=3000              # Server port (default: 3000)
NODE_ENV=production    # Environment mode
```

### **Customization:**
- Change port in `server.js`
- Modify game rules in the `Game` class
- Add authentication if needed
- Implement persistent storage for game history

## 🎯 **Game Strategy Tips:**

- Start with common patterns (12345, 00000, 11111)
- Use feedback to eliminate possibilities systematically
- Pay attention to both "correct numbers" and "correct positions"
- Think about number frequency and placement
- Don't rush - take time to analyze feedback

## 🚨 **Security Notes:**

- The game is designed for friendly play
- No authentication or anti-cheat measures
- Players can potentially inspect network traffic
- Consider adding rate limiting for production use
- Implement proper security measures for public deployment

## 🐛 **Troubleshooting:**

### **Common Issues:**
- **"Cannot connect to server"**: Check if server is running
- **"Game not starting"**: Ensure both players have set their numbers
- **"Disconnected"**: Check internet connection and refresh page
- **"Port already in use"**: Change port number in server.js

### **Browser Compatibility:**
- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile browsers

## 🎉 **Ready to Play!**

1. **Start the server** with `npm start`
2. **Open the game** in your browser
3. **Create or join** a game
4. **Share the game code** with your opponent
5. **Start playing** and have fun!

---

**Enjoy your multiplayer Number Wordle adventure!** 🚀💕 