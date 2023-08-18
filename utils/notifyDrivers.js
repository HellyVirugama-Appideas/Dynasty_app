module.exports = async function notifyDrivers(driverIds, ride) {
    const notificationTimeout = 30000; // 30 seconds

    const notifyDriver = async driverId => {
        return new Promise(resolve => {
            const driverRoomName = `${driverId}_${ride._id}`;
            const driverRoom = io.sockets.adapter.rooms.get(driverId);

            if (!driverRoom) {
                console.log(`Driver id ${driverId} is not connected.`);
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
                    console.log(`Driver ID ${driverId} accepted the ride.`);
                    cleaup();
                    resolve(true);
                }
            };

            const rejectHandler = () => {
                if (acceptTimeout) {
                    clearTimeout(acceptTimeout);
                    console.log(`Driver ID ${driverId} rejected the ride.`);
                    cleaup();
                    resolve(false);
                }
            };

            driverSocket.join(driverRoomName);

            driverSocket.emit('newRideRequest', ride);

            driverSocket.once('accept', acceptHandler);
            driverSocket.once('reject', rejectHandler);

            acceptTimeout = setTimeout(() => {
                acceptTimeout = null;
                console.log(`Driver ID ${driverId} didn't respond in time.`);
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

    for (const driverId of driverIds) {
        const accepted = await notifyDriver(driverId, ride._id);

        if (accepted) {
            // Notify the user and stop the process
            io.to(ride.user).emit('booked', ride);
            return;
        }
    }

    // If none of the drivers accepted, notify the user
    io.to(ride.user).emit('noAvailableDrivers');
};
