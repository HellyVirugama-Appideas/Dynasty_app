// utils/rideQueueManager.js

const activeQueues = new Map(); // rideId → queue state

/**
 * Ek naya queue start karo ride ke liye
 * @param {string} rideId 
 * @param {string[]} driverIds - sorted by distance
 * @param {Function} onNextDriver - callback(driverId) jab next driver ko bhejo
 * @param {Function} onNoDrivers - callback() jab sab ne reject kiya
 */
function startQueue(rideId, driverIds, onNextDriver, onNoDrivers) {
    // Agar pehle se queue chal rahi hai toh cancel karo
    cancelQueue(rideId);

    const state = {
        driverIds: [...driverIds],
        currentIndex: 0,
        timeoutHandle: null,
        cancelled: false,
    };

    activeQueues.set(rideId, state);
    console.log(`🚦 Queue started for ride ${rideId} with ${driverIds.length} drivers`);

    // Pehle driver ko bhejo
    sendToNext(rideId, state, onNextDriver, onNoDrivers);
}

function sendToNext(rideId, state, onNextDriver, onNoDrivers) {
    if (state.cancelled) return;

    // Sab drivers exhaust ho gaye?
    if (state.currentIndex >= state.driverIds.length) {
        console.log(`❌ No drivers available for ride ${rideId}`);
        activeQueues.delete(rideId);
        onNoDrivers();
        return;
    }

    const driverId = state.driverIds[state.currentIndex];
    state.currentIndex++;

    console.log(`📤 Sending ride ${rideId} to driver ${driverId} (attempt ${state.currentIndex}/${state.driverIds.length})`);

    // Driver ko notify karo
    onNextDriver(driverId);

    // 30 second timeout — agar driver ne respond nahi kiya
    state.timeoutHandle = setTimeout(() => {
        if (state.cancelled) return;
        console.log(`⏰ Driver ${driverId} timed out for ride ${rideId}`);
        sendToNext(rideId, state, onNextDriver, onNoDrivers);
    }, 30000); // 30 seconds
}

/**
 * Jab driver accept kare ya ride cancel ho — queue band karo
 */
function cancelQueue(rideId) {
    const state = activeQueues.get(rideId);
    if (state) {
        state.cancelled = true;
        if (state.timeoutHandle) clearTimeout(state.timeoutHandle);
        activeQueues.delete(rideId);
        console.log(`🛑 Queue cancelled for ride ${rideId}`);
    }
}

/**
 * Driver ne reject kiya — manually next pe move karo
 */
function driverRejected(rideId, onNextDriver, onNoDrivers) {
    const state = activeQueues.get(rideId);
    if (!state || state.cancelled) return;

    // Timeout clear karo, manually next bhejo
    if (state.timeoutHandle) clearTimeout(state.timeoutHandle);
    sendToNext(rideId, state, onNextDriver, onNoDrivers);
}

/**
 * Current driver kaun hai is ride ke liye
 */
function getCurrentDriver(rideId) {
    const state = activeQueues.get(rideId);
    if (!state || state.cancelled) return null;
    // currentIndex already increment ho chuka hai sendToNext mein
    return state.driverIds[state.currentIndex - 1];
}

module.exports = { startQueue, cancelQueue, driverRejected, getCurrentDriver };