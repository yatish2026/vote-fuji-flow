# 🗳️ Avalanche Voting Platform

A decentralized, transparent, and secure blockchain voting platform built on Avalanche Fuji Testnet.

## project :http://vote-fuji-flow.netlify.app
make sure to have wallet to explore in deatil


## 🌟 Features

- **🔗 Blockchain Integration**: Built on Avalanche C-Chain for transparency and immutability
- **🔐 Wallet Authentication**: MetaMask/Core Wallet integration for secure voting
- **📊  AI AGNET Real-time Analytics**: Live dashboard with comprehensive voting 
- **👥 Admin Management**: Secure admin-only analytics and election management
- **🔐 Multi-language support** for a seamless user experience
- **📊 voice input**: for hands-free interaction.
- **👥 Admin Management**:Dual-login options: connect via crypto wallet or verify with Voter ID, PAN, or Aadhaar.
- **📱 Responsive Design**: Beautiful, mobile-friendly interface
- **⚡ Fast & Scalable**: Optimized for performance on Avalanche network

## 🏗️ AVALANCHE TECH USED:

Blockchain & Security

✅ Smart Contracts on Avalanche C-Chain using Solidity via Remix AI.

✅ Dual login: WalletConnect + Voter ID / PAN / Aadhaar verification.

✅ Zero-knowledge proof (ZK): Ensures anonymous vote verification.

✅ Proof of Vote NFT: Users get a proof NFT for participation (no vote data exposed).

Transparency / Audit

✅ Public audit page: Displays election smart contract address, transaction hashes, and block explorer links.

✅ Immutable results: All votes recorded on Avalanche, cannot be tampered.

Scalability & Future Vision

🔹 Cross-chain ready: Avalanche → Polygon → Ethereum (future expansion).

Accessibility & UX

🌐 Multi-language UI: English, Hindi, and more.

🎤 Voice input support for casting votes.

📱 Mobile-first design with simple, intuitive interface.

🔊 Text-to-speech support for accessibility.

AI Insights

we have built AND TRAINED AN AI AGENT  to analyze voters data pls do check out ,                 
https://avalanche-analytics-agentic-ai.onrender.com/

🤖 After election closes, AI generates insights like:

Turnout trends (e.g., +30% vs last election)

Most popular login method (WalletConnect, email, etc.)

Bridges AI + Blockchain storytelling for hackathons

### Frontend (React + TypeScript + Tailwind)
- **Voter Interface**: Public voting page with candidate selection
- **Admin Dashboard**: Protected analytics dashboard with charts and insights
- **Web3 Integration**: ethers.js for blockchain interactions


### Backend (Node.js + Express)
- **REST API**: Comprehensive endpoints for voting data and analytics
- **Smart Contract Integration**: Direct connection to **Avalanche Fuji**
- **JWT Authentication**: Secure admin access with wallet signature verification
- **Analytics Engine**: Real-time vote tracking and demographic analysis

### Smart Contract
- **Address**: `0xa982db91EaF445C7928d30e37FfE4575125F8523`
- **Network**: Avalanche Fuji Testnet
- **Features**: Vote recording, election timing, admin controls,Analytics Engine 
- **
## 🚀 Quick Start
### Prerequisites
- Access to Avalanche Fuji Testnet
- Node.js 18+ and npm
- MetaMask or Core Wallet browser extension



## 📊 Analytics Features

### Vote Analytics
- Real-time vote counts and percentages
- Interactive bar and pie charts
- Winner determination and margins
- Candidate-specific insights

### Demographic Analytics
- Age group distributions
- Gender ratios
- Geographic voting patterns
- Turnout analysis

### Admin Tools
- CSV data export
- Election management
- Voter verification
- Live monitoring

### Integration Tests
```bash
# Test contract connectivity
cd backend
npm run test:integration
```

### Manual Testing Checklist
- [ ] Wallet connection works
- [ ] Voting transaction submits successfully
- [ ] Admin authentication works
- [ ] Analytics dashboard loads
- [ ] Charts display correctly
- [ ] CSV export functions
- [ ] Election timer updates


   ```


## 🔧 Development
### Project Structure
```
avalanche-voting-platform/
├── src/                    # Frontend React app
│   ├── components/         # Reusable UI components
│   ├── pages/             # Vote and Admin pages
│   ├── lib/               # Contract integration
│   └── hooks/             # Custom React hooks
├── backend/               # Node.js backend
│   ├── routes/            # API endpoints
│   ├── analytics/         # Analytics engine
│   ├── tests/             # Unit and integration tests
│   └── server.js          # Express server
├── public/                # Static assets
└── docs/                  # Additional documentation
```

### Key Technologies
- **Frontend**: React 18, TypeScript, Tailwind CSS, ethers.js, Recharts
- **Backend**: Node.js, Express, JWT, ethers.js
- **Blockchain**: Avalanche C-Chain, Solidity Smart Contract
- **Tools**: Vite, Docker, Jest, ESLint

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request


## 🆘 Support

- **Documentation**: Check this README and inline code comments

## 🏆 Hackathon Submission
This project demonstrates:
- ✅ **Blockchain Integration**: Native Avalanche C-Chain integration
- ✅ **Decentralized Architecture**: Smart contract-based vote storage
- ✅ **Security**: Wallet-based authentication and signature verification  
- ✅ **User Experience**: Intuitive voting interface and admin dashboard
- ✅ **Analytics**: Comprehensive real-time vote tracking and insights
- ✅ **Production Ready**: 

---

**Built with ❤️ for the Avalanche ecosystem**

## 👥 Team

- [Yatish](https://github.com/yatish2026)
- [Raj](https://github.com/yatish2026)
- [Shaz](https://github.com/khateebshaziya26)
- [Dia](https://github.com/Dcodex26)
