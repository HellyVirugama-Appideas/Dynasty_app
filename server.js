const mongoose = require('mongoose');
const dotenv = require('dotenv');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

const ChatMessage = require('./models/chatMessageModel');

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
    .connect(DB, {
        useNewUrlParser: true,
    })
    .then(() => console.log('DB connection successful!'));

// Socket.IO integration
const server = require('http').createServer(app);
const io = socketIO(server);

io.on('connection', socket => {
    socket.on('join', function (data) {
        const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
        socket.join(decoded._id);
    });

    // Listen for get chat messages
    socket.on('getChatMessages', async data => {
        try {
            const bookingId = data.bookingId;

            const messages = await ChatMessage.find({ bookingId });

            // Emit old messages to the client
            socket.emit('chatMessages', messages);
        } catch (error) {
            console.error('Error retrieving old messages:', error.message);
        }
    });

    // Listen for new chat messages
    socket.on('sendMessage', async data => {
        try {
            const decoded = jwt.verify(data.token, process.env.JWT_SECRET);

            const chatMessage = await ChatMessage.create({
                bookingId: data.bookingId,
                sender: decoded._id,
                receiver: data.receiver,
                message: data.message,
            });

            io.to(data.receiver).emit('receiveMessage', chatMessage);
        } catch (error) {
            console.error('Error saving message:', error.message);
        }
    });
});

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
