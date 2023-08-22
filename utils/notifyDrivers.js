module.exports = async function notifyDrivers(drivers, ride) {
    const notificationTimeout = 30000; // 30 seconds

    const notifyDriver = async driver => {
        return new Promise(resolve => {
            const driverRoomName = `${driver.id}_${ride._id}`;
            const driverRoom = io.sockets.adapter.rooms.get(driver.id);

            if (!driverRoom) {
                console.log(`Driver id ${driver.id} is not connected.`);
                resolve(false);
                return;
            }

            const [driverSocketId] = driverRoom;
            const driverSocket = io.sockets.sockets.get(driverSocketId);

            if (!driverSocket) {
                console.log(`Socket id ${driverSocketId} is not available.`);
                resolve(false);
                return;
            }

            let acceptTimeout;

            const acceptHandler = () => {
                if (acceptTimeout) {
                    clearTimeout(acceptTimeout);
                    console.log(`Driver ID ${driver.id} accepted the ride.`);
                    cleaup();
                    resolve(true);
                }
            };

            const rejectHandler = () => {
                if (acceptTimeout) {
                    clearTimeout(acceptTimeout);
                    console.log(`Driver ID ${driver.id} rejected the ride.`);
                    cleaup();
                    resolve(false);
                }
            };

            driverSocket.join(driverRoomName);

            driverSocket.emit('newRideRequest', {
                ...ride._doc,
                distance: driver.distance,
            });

            driverSocket.once('accept', acceptHandler);
            driverSocket.once('reject', rejectHandler);

            acceptTimeout = setTimeout(() => {
                acceptTimeout = null;
                console.log(`Driver ID ${driver.id} didn't respond in time.`);
                cleaup();
                resolve(false);
            }, notificationTimeout);

            function cleaup() {
                driverSocket.off('accept', acceptHandler);
                driverSocket.off('reject', rejectHandler);
                driverSocket.leave(driverRoomName);
            }
        });
    };

    for (const driver of drivers) {
        const accepted = await notifyDriver(driver, ride._id);

        if (accepted) {
            // Notify the user and stop the process
            io.to(ride.user).emit('booked', ride);
            return;
        }
    }

    // If none of the drivers accepted, notify the user
    io.to(ride.user).emit('noAvailableDrivers');
};
