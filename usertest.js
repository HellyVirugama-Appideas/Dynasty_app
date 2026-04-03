// ========================================
// USER SOCKET TEST - test-user-complete.js
// ========================================

const io = require('socket.io-client');

// Connect to server
const userSocket = io('http://localhost:3000', {
    transports: ['websocket'],
});

let currentRideId = null;

// Connection events
userSocket.on('connect', () => {
    console.log('✅ User Connected! Socket ID:', userSocket.id);
    
    // Step 1: Track nearby drivers BEFORE booking
    console.log('🔍 Starting to track nearby drivers...');
    userSocket.emit('trackNearbyDriversBeforeBooking', {
        lat: 22.3631344,
        lng: 70.7516007,
        type: 'taxi',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2OTAxZDU5NTUwNzQ3OTRkZjFiNTBkMzAiLCJpYXQiOjE3NzEyMzUzNDksImV4cCI6MTc3OTAxMTM0OX0.C75UxvHgTnafV4ETn_jXkPfBbevC-jvVnil3ToEMoQ4' // USER JWT TOKEN
    });
});

// Tracking started confirmation
userSocket.on('trackingStarted', (data) => {
    console.log('✅ Tracking started:', data.message);
    console.log('Update interval:', data.updateInterval, 'ms');
});

// Receive nearby drivers updates (every 3 seconds)
userSocket.on('nearbyDriversUpdate', (data) => {
    console.log('\n📍 ====== Nearby Drivers Update ======');
    console.log('Count:', data.count);
    console.log('User Location:', data.userLocation);
    console.log('Search Radius:', data.radiusKm, 'km');
    console.log('Timestamp:', new Date(data.timestamp).toLocaleTimeString());
    
    if (data.drivers.length > 0) {
        console.log('\n🚗 Available Drivers:');
        data.drivers.forEach((driver, index) => {
            console.log(`${index + 1}. ${driver.driver?.name || 'Driver'}`);
            // console.log(`   Location: [${driver.location.lat}, ${driver.location.lng}]`);
            console.log(`   Distance: ${driver.distance} km`);
            console.log(`   Status: ${driver.status}`);
        });
    } else {
        console.log('❌ No drivers found nearby');
        console.log('💡 Make sure driver socket is running (node test-driver-socket.js)');
    }
    console.log('=====================================\n');
});

// Step 2: Listen for ride acceptance (after Postman booking)
userSocket.on('rideAccepted', (data) => {
    console.log('\n🎉 ====== RIDE ACCEPTED ======');
    console.log('Ride ID:', data.ride._id);
    console.log('Driver:', data.ride.driver.name);
    console.log('Driver Phone:', data.ride.driver.phone);
    console.log('Pickup:', data.ride.pickupAddress);
    console.log('Drop:', data.ride.endAddress);
    console.log('OTP:', data.ride.otp);
    console.log('=============================\n');
    
    currentRideId = data.ride._id;
    
    // Stop tracking nearby drivers
    console.log('🛑 Stopping nearby drivers tracking...');
    userSocket.emit('stopTrackingNearbyDrivers');
    
    // Join ride room for live tracking
    console.log('🚪 Joining ride room...');
    userSocket.emit('joinRideRoom', {
        rideId: data.ride._id,
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2OTAxZDU5NTUwNzQ3OTRkZjFiNTBkMzAiLCJpYXQiOjE3NzEyMzUzNDksImV4cCI6MTc3OTAxMTM0OX0.C75UxvHgTnafV4ETn_jXkPfBbevC-jvVnil3ToEMoQ4' // USER JWT TOKEN
    });
});

// Joined ride room confirmation
userSocket.on('joinedRideRoom', (data) => {
    console.log('✅ Joined ride room:', data.rideRoom);
    console.log('📍 Now tracking driver location in real-time...\n');
});

// Step 3: Receive driver location updates during ride (every 3 seconds)
userSocket.on('driverLocationUpdate', (data) => {
    console.log('🚗 ====== Driver Location Update ======');
    console.log('Ride ID:', data.rideId);
    console.log('Driver ID:', data.driverId);
    console.log('Location:', {
        latitude: data.location.latitude,
        longitude: data.location.longitude
    });
    console.log('Time:', new Date(data.timestamp).toLocaleTimeString());
    console.log('=======================================\n');
});

// Tracking stopped confirmation
userSocket.on('trackingStopped', (data) => {
    console.log('🛑 Tracking stopped:', data.message);
});

// Ride status updates
userSocket.on('rideStatusNotify', (data) => {
    console.log('\n📢 Ride Status Update:');
    console.log('Status:', data.rideStatus);
});

// Error handling
userSocket.on('error', (data) => {
    console.error('\n❌ Error:', data.message);
});

userSocket.on('disconnect', () => {
    console.log('❌ User Disconnected');
});

// Instructions
console.log('\n==============================================');
console.log('USER SOCKET TEST - Instructions');
console.log('==============================================');
console.log('1. This script tracks nearby drivers');
console.log('2. Book ride via Postman: POST /api/user/book_ride');
console.log('3. Driver accepts via Postman: POST /api/driver/response');
console.log('4. This script will receive rideAccepted event');
console.log('5. Driver location will be tracked in real-time');
console.log('==============================================\n');

// Keep running
console.log('🏃 User socket running...');
console.log('Press Ctrl+C to stop\n');