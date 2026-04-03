const io = require('socket.io-client');

// ✅ Replace with your actual JWT token from login API
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2OTVlNDAwMmQ1ZWMwMWZmNTBiMWEzY2IiLCJpYXQiOjE3NzA5NzQyNzMsImV4cCI6MTc3ODc1MDI3M30.r2kPm1HvM2tnea9z5-TL56IFnVIAB_E1nOyXBXtw7Po'; // Your actual token here

// ✅ Replace with your server URL
const SERVER_URL = 'http://localhost:3000';

console.log('🚀 Connecting to socket server...');

const socket = io(SERVER_URL, {
  transports: ['websocket'],
  reconnection: true,
});

socket.on('connect', () => {
  console.log('✅ Connected to server, Socket ID:', socket.id);

  // Step 1: Join room
  console.log('\n📨 Sending join event...');
  socket.emit('join', { token: TOKEN });

  // Step 2: Register driver (wait 1 second)
  setTimeout(() => {
    console.log('\n📨 Sending registerDriver event...');
    socket.emit('registerDriver', {
      token: TOKEN,
      lat: 23.0496494,  // Surat coordinates
      lng: 72.6701868
    });
  }, 1000);

  // Step 3: Set status to online (wait 2 seconds)
  setTimeout(() => {
    console.log('\n📨 Sending setStatus event (online)...');
    socket.emit('setStatus', {
      token: TOKEN,
      status: 'online'
    });
  }, 2000);

  // Step 4: Update location (wait 3 seconds)
  setTimeout(() => {
    console.log('\n📨 Sending updateLocation event...');
    socket.emit('updateLocation', {
      token: TOKEN,
      lat: 22.3631344,
      lng: 70.7516007
    });
  }, 3000);

  // Step 5: Debug check (wait 4 seconds)
  setTimeout(() => {
    console.log('\n📨 Sending debugActiveDrivers event...');
    socket.emit('debugActiveDrivers');
  }, 4000);
});

// Listen for responses
socket.on('driverRegistered', (data) => {
  console.log('\n✅ Driver Registered Response:', data);
});

socket.on('getStatus', (data) => {
  console.log('\n✅ Status Response:', data);
});

socket.on('locationUpdated', (data) => {
  console.log('\n✅ Location Updated Response:', data);
});

socket.on('debugActiveDriversResponse', (data) => {
  console.log('\n✅ Active Drivers Debug Response:', data);
});

socket.on('error', (error) => {
  console.log('\n❌ Socket Error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('\n❌ Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.log('\n❌ Connection Error:', error.message);
});

// Keep script running
console.log('\n⏳ Script running... Press Ctrl+C to exit\n');