// ========================================
// DRIVER SOCKET TEST - test-driver-complete.js
// ========================================

const io = require('socket.io-client');

// Connect to server
const driverSocket = io('http://localhost:3000', {
    transports: ['websocket'],
});

let currentLat = 23.0500000;
let currentLng = 72.6700000;
let currentRideId = null;
let generalLocationInterval = null;
let rideLocationInterval = null;

// Connection events
driverSocket.on('connect', () => {
    console.log('✅ Driver Connected! Socket ID:', driverSocket.id);
    
    // Step 1: Register driver
    console.log('🚗 Registering driver...');
    driverSocket.emit('registerDriver', {
        lat: currentLat,
        lng: currentLng,
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2OTVlNDAwMmQ1ZWMwMWZmNTBiMWEzY2IiLCJpYXQiOjE3NzEyMzk0NTgsImV4cCI6MTc3OTAxNTQ1OH0.LeTBX3r_D2ktYO7P2VZxVFlBbG_pWPCikGWEtXrHNMw' // DRIVER JWT TOKEN
    });
});

// Driver registered confirmation
driverSocket.on('driverRegistered', (data) => {
    console.log('✅ Driver Registered:', data.message);
    console.log('Active drivers count:', data.activeDriversCount);
    
    // Step 2: Start sending general location updates
    console.log('📍 Starting general location updates...\n');
    startGeneralLocationUpdates();
});

// General location updates (before ride)
function startGeneralLocationUpdates() {
    generalLocationInterval = setInterval(() => {
        // Simulate movement
        currentLat += 0.0001; // ~11 meters north
        currentLng += 0.0001; // ~11 meters east
        
        console.log(`📍 [GENERAL] Updating location: [${currentLat.toFixed(7)}, ${currentLng.toFixed(7)}]`);
        
        driverSocket.emit('updateLocation', {
            lat: currentLat,
            lng: currentLng,
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2OTVlNDAwMmQ1ZWMwMWZmNTBiMWEzY2IiLCJpYXQiOjE3NzEyMzk0NTgsImV4cCI6MTc3OTAxNTQ1OH0.LeTBX3r_D2ktYO7P2VZxVFlBbG_pWPCikGWEtXrHNMw' // DRIVER JWT TOKEN
        });
    }, 3000); // Every 3 seconds
}

// Location updated confirmation
driverSocket.on('locationUpdated', (data) => {
    if (data.success) {
        console.log('   ✓ Location updated in server');
    }
});

// Step 3: Listen for ride acceptance (after Postman acceptance)
driverSocket.on('rideAccepted', (data) => {
    console.log('\n🎉 ====== RIDE ACCEPTED ======');
    console.log('Ride ID:', data.ride._id);
    console.log('User:', data.ride.user.name);
    console.log('User Phone:', data.ride.user.phone);
    console.log('Pickup:', data.ride.pickupAddress);
    console.log('Drop:', data.ride.endAddress);
    console.log('OTP:', data.ride.otp);
    console.log('=============================\n');
    
    currentRideId = data.ride._id;
    
    // Stop general location updates
    if (generalLocationInterval) {
        clearInterval(generalLocationInterval);
        console.log('🛑 Stopped general location updates');
    }
    
    // Join ride room
    console.log('🚪 Joining ride room...');
    driverSocket.emit('joinRideRoom', {
        rideId: data.ride._id,
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2OTVlNDAwMmQ1ZWMwMWZmNTBiMWEzY2IiLCJpYXQiOjE3NzEyMzk0NTgsImV4cCI6MTc3OTAxNTQ1OH0.LeTBX3r_D2ktYO7P2VZxVFlBbG_pWPCikGWEtXrHNMw' // DRIVER JWT TOKEN
    });
    
    // Start ride-specific location updates
    setTimeout(() => {
        startRideLocationUpdates();
    }, 1000);
});

// Joined ride room confirmation
driverSocket.on('joinedRideRoom', (data) => {
    console.log('✅ Joined ride room:', data.rideRoom);
    console.log('📍 Now sending ride-specific location updates...\n');
});

// Ride location updates (during ride)
function startRideLocationUpdates() {
    if (rideLocationInterval) {
        clearInterval(rideLocationInterval);
    }
    
    rideLocationInterval = setInterval(() => {
        if (!currentRideId) return;
        
        // Simulate movement towards destination
        currentLat += 0.0002; // ~22 meters (faster during ride)
        currentLng += 0.0002;
        
        console.log(`🚗 [RIDE] Sending location for ride ${currentRideId.substring(0, 8)}...`);
        console.log(`   Location: [${currentLat.toFixed(7)}, ${currentLng.toFixed(7)}]`);
        
        driverSocket.emit('updateRideLocation', {
            rideId: currentRideId,
            lat: currentLat,
            lng: currentLng,
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2OTVlNDAwMmQ1ZWMwMWZmNTBiMWEzY2IiLCJpYXQiOjE3NzEyMzk0NTgsImV4cCI6MTc3OTAxNTQ1OH0.LeTBX3r_D2ktYO7P2VZxVFlBbG_pWPCikGWEtXrHNMw' // DRIVER JWT TOKEN
        });
    }, 3000); // Every 3 seconds
}

// Set driver status
driverSocket.on('setStatus', (data) => {
    console.log('Driver status set to:', data.status);
});

// Error handling
driverSocket.on('error', (data) => {
    console.error('\n❌ Error:', data.message);
});

driverSocket.on('disconnect', () => {
    console.log('❌ Driver Disconnected');
    
    // Cleanup intervals
    if (generalLocationInterval) clearInterval(generalLocationInterval);
    if (rideLocationInterval) clearInterval(rideLocationInterval);
});

// Instructions
console.log('\n==============================================');
console.log('DRIVER SOCKET TEST - Instructions');
console.log('==============================================');
console.log('1. This script registers driver and sends location');
console.log('2. User books ride via Postman: POST /api/user/book_ride');
console.log('3. Accept ride via Postman: POST /api/driver/response');
console.log('4. This script will receive rideAccepted event');
console.log('5. Script will start sending ride-specific location');
console.log('==============================================\n');

// Simulate setting driver status to online (optional)
setTimeout(() => {
    console.log('🟢 Setting driver status to online...');
    driverSocket.emit('setStatus', {
        status: 'online',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2OTVlNDAwMmQ1ZWMwMWZmNTBiMWEzY2IiLCJpYXQiOjE3NzEyMzk0NTgsImV4cCI6MTc3OTAxNTQ1OH0.LeTBX3r_D2ktYO7P2VZxVFlBbG_pWPCikGWEtXrHNMw' // DRIVER JWT TOKEN
    });
}, 2000);

// Keep running
console.log('🚗 Driver socket running...');
console.log('Press Ctrl+C to stop\n');