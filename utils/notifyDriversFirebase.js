const { sendRideNotification } = require('./sendNotification');
const Driver = require('../models/driverModel');

module.exports = async function notifyDrivers(drivers, ride, isSchedule, user) {
    const notifyDriver = async (driverId, distance, time) => {
        try {
            const driver = await Driver.findById(driverId);
            if (driver.isHandlingRequest) {
                return false;
            }

            const registrationToken = driver.fcmToken;
            if (!registrationToken) {
                return false;
            }

            const notificationData = {
                driverId: driverId,
                userId: user.id,
                ride: ride,
                rideId: ride.id,
                distance: distance,
                time: time,
                isSchedule: isSchedule,
                title: 'New Ride Request',
                body: `You have a new ride request ${distance} (${time}).`,
            };

            const response = await sendRideNotification(
                registrationToken,
                notificationData
            );
            console.log('response', response);
            return true;
        } catch (error) {
            console.error('Error notifying driver:', error);
            return false;
        }
    };

    for (const driver of drivers) {
        await notifyDriver(driver.id, driver.distance, driver.time);
    }

    return false;
};
