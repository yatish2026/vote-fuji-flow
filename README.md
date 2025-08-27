# 🗳️ Avalanche Voting Platform

A decentralized, transparent, and secure blockchain voting platform built on Avalanche Fuji Testnet.

## 🌟 Features

- **🔗 Blockchain Integration**: Built on Avalanche C-Chain for transparency and immutability
- **🔐 Wallet Authentication**: MetaMask/Core Wallet integration for secure voting
- **📊 Real-time Analytics**: Live dashboard with comprehensive voting analytics
- **👥 Admin Management**: Secure admin-only analytics and election management
- **📱 Responsive Design**: Beautiful, mobile-friendly interface
- **⚡ Fast & Scalable**: Optimized for performance on Avalanche network

## 🏗️ Architecture

### Frontend (React + TypeScript + Tailwind)
- **Voter Interface**: Public voting page with candidate selection
- **Admin Dashboard**: Protected analytics dashboard with charts and insights
- **Web3 Integration**: ethers.js for blockchain interactions

### Backend (Node.js + Express)
- **REST API**: Comprehensive endpoints for voting data and analytics
- **Smart Contract Integration**: Direct connection to Avalanche Fuji
- **JWT Authentication**: Secure admin access with wallet signature verification
- **Analytics Engine**: Real-time vote tracking and demographic analysis

### Smart Contract
- **Address**: `0xa982db91EaF445C7928d30e37FfE4575125F8523`
- **Network**: Avalanche Fuji Testnet
- **Features**: Vote recording, election timing, admin controls

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- MetaMask or Core Wallet browser extension
- Access to Avalanche Fuji Testnet

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd avalanche-voting-platform

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
```

### 2. Environment Setup

```bash
# Backend configuration
cd backend
cp .env.example .env

# Edit .env with your configuration:
# - Set JWT_SECRET to a strong random string
# - Optionally set ADMIN_PRIVATE_KEY for development
```

### 3. Start Development Servers

```bash
# Terminal 1: Start backend server
cd backend
npm run dev

# Terminal 2: Start frontend development server
cd ../
npm run dev
```

### 4. Access the Application

- **Voter Interface**: http://localhost:8080
- **Admin Dashboard**: http://localhost:8080/admin
- **Backend API**: http://localhost:3001

## 📋 API Endpoints

### Public Endpoints
- `GET /api/health` - Server health check
- `GET /api/candidates` - List of candidates
- `GET /api/status` - Election status and timing
- `GET /api/results` - Current voting results
- `GET /api/candidate/:index/analytics` - Candidate-specific analytics

### Admin Endpoints (Protected)
- `POST /api/admin/nonce` - Generate authentication nonce
- `POST /api/admin/auth` - Authenticate with wallet signature
- `GET /api/analytics` - Comprehensive analytics data
- `GET /api/admin/voter/:address` - Voter information
- `GET /api/admin/export` - Export results as CSV
- `POST /api/admin/end-election` - End election (requires admin key)

## 🔐 Admin Authentication Flow

1. **Connect Wallet**: Admin connects MetaMask/Core Wallet
2. **Verify Address**: System checks if connected address matches contract admin
3. **Sign Nonce**: Admin signs a random nonce message
4. **JWT Token**: Server issues JWT token for authenticated sessions
5. **Access Dashboard**: Admin can access protected analytics and controls

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

## 🐳 Docker Deployment

### Build and Run with Docker

```bash
# Build backend image
cd backend
docker build -t avalanche-voting-backend .

# Run backend container
docker run -p 3001:3001 --env-file .env avalanche-voting-backend

# Build and serve frontend (production)
cd ../
npm run build
npx serve -s dist -l 8080
```

### Docker Compose (Full Stack)

```bash
# Create docker-compose.yml and run
docker-compose up -d
```

## 🧪 Testing

### Unit Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests (if implemented)
cd ../
npm test
```

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

## 🌐 Deployment

### Backend Deployment (Render/Heroku/Railway)

1. **Environment Variables**:
   ```
   PORT=3001
   NODE_ENV=production
   FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
   CONTRACT_ADDRESS=0xa982db91EaF445C7928d30e37FfE4575125F8523
   JWT_SECRET=your-production-secret
   ```

2. **Deploy Commands**:
   ```bash
   npm install
   npm start
   ```

### Frontend Deployment (Vercel/Netlify)

1. **Build Settings**:
   - Build Command: `npm run build`
   - Output Directory: `dist`

2. **Environment Variables**: (None required for frontend)

## 🎥 Demo Script (2-3 minutes)

### Slide 1: Problem & Solution (30s)
"Traditional voting systems lack transparency and trust. Our platform uses Avalanche blockchain for immutable, verifiable elections."

### Demo Flow (2 minutes)

1. **Voter Experience** (60s):
   - Show election timer and candidate list
   - Connect MetaMask wallet
   - Cast vote and show transaction confirmation
   - Display "Vote Recorded" confirmation

2. **Admin Dashboard** (60s):
   - Connect admin wallet with signature authentication
   - Show real-time analytics dashboard
   - Highlight key metrics: total votes, winner, demographics
   - Demonstrate CSV export functionality
   - Show transparency by opening contract on SnowTrace

### Closing (30s)
"Complete transparency, secure authentication, and powerful analytics - built for the future of democratic processes on Avalanche."

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

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Create GitHub issues for bugs or feature requests
- **Contract**: View on [SnowTrace](https://testnet.snowtrace.io/address/0xa982db91EaF445C7928d30e37FfE4575125F8523)

## 🏆 Hackathon Submission

This project demonstrates:
- ✅ **Blockchain Integration**: Native Avalanche C-Chain integration
- ✅ **Decentralized Architecture**: Smart contract-based vote storage
- ✅ **Security**: Wallet-based authentication and signature verification  
- ✅ **User Experience**: Intuitive voting interface and admin dashboard
- ✅ **Analytics**: Comprehensive real-time vote tracking and insights
- ✅ **Production Ready**: Docker deployment, testing, and documentation

---

**Built with ❤️ for the Avalanche ecosystem**