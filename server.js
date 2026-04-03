const mongoose = require('mongoose');
const dotenv = require('dotenv');
const socketIO = require('socket.io');
const driverPaymentRoutes = require('./routes/driver/paymentRoutes');
// const webhookRoutes = require('./routes/webhookRoutes');
const socketHandler = require('./utils/socketHandler');

process.on('uncaughtException', err => {
    console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.log(err);
    process.exit(1);
});

dotenv.config();
const app = require('./app');

const DB = process.env.DATABASE.replace(
    '<password>',
    process.env.DATABASE_PASSWORD
);

mongoose.set('strictQuery', false);
mongoose
    .connect(DB, { useNewUrlParser: true })
    .then(() => console.log('⚙️ DB connection successful!'));

// Socket.IO integration
// const server = require('http').createServer(app);
// global.io = socketIO(server);

// socketHandler(io);

const http = require('http');
const socketIo = require('socket.io');

// Create HTTP server from Express app
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
    cors: {
        origin: '*', // Allow all origins (adjust for production)
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
});

// ✅ CRITICAL: Make io globally accessible
global.io = io;

// Initialize socket handlers
require('./utils/socketHandler')(io);

console.log('✅ Socket.IO initialized');

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`App running on port ${port}...`);
});

process.on('unhandledRejection', err => {
    console.log('UNHANDLED REJECTION! 💥 Shutting down...');
    console.log(err);
    server.close(() => {
        process.exit(1);
    });
});

process.on('SIGTERM', () => {
    console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
    server.close(() => {
        console.log('💥 Process terminated!');
    });
});
