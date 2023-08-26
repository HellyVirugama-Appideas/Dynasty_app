const Driver = require('../models/driverModel');

module.exports = async function notifyDrivers(drivers, ride) {
    const notificationTimeout = 30000; // 30 seconds

    const notifyDriver = async (driverId, distance) => {
        return new Promise(async resolve => {
            const driver = await Driver.findById(driverId);

            if (driver.isHandlingRequest) return false;

            const driverRoomName = `${driver.id}_${ride._id}`;
            const driverRoom = io.sockets.adapter.rooms.get(driver.id);

            if (!driverRoom) {
                resolve(false);
                return;
            }

            const [driverSocketId] = driverRoom;
            const driverSocket = io.sockets.sockets.get(driverSocketId);

            if (!driverSocket) {
                resolve(false);
                return;
            }

            let acceptTimeout;

            const acceptHandler = () => {
                if (acceptTimeout) {
                    clearTimeout(acceptTimeout);
                    cleaup();
                    resolve(true);
                }
            };

            const rejectHandler = () => {
                if (acceptTimeout) {
                    clearTimeout(acceptTimeout);
                    cleaup();
                    resolve(false);
                }
            };

            driverSocket.join(driverRoomName);

            await Driver.findByIdAndUpdate(driver.id, {
                isHandlingRequest: true,
            });
            driverSocket.emit('newRideRequest', { ...ride._doc, distance });

            driverSocket.once('accept', acceptHandler);
            driverSocket.once('reject', rejectHandler);

            acceptTimeout = setTimeout(() => {
                acceptTimeout = null;
                // driverSocket.emit('timeout', ride);
                cleaup();
                resolve(false);
            }, notificationTimeout);

            async function cleaup() {
                await Driver.findByIdAndUpdate(driver.id, {
                    isHandlingRequest: false,
                });
                driverSocket.emit('timeout', ride);
                driverSocket.off('accept', acceptHandler);
                driverSocket.off('reject', rejectHandler);
                driverSocket.leave(driverRoomName);
            }
        });
    };

    for (const driver of drivers) {
        const accepted = await notifyDriver(driver.id, driver.distance);

        // Return driver id that accept
        if (accepted) return driver.id;
    }

    // If none of the drivers accepted return null
    return null;
};
