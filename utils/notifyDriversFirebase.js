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
                driverId: driverId.toString(),
                userId: user._id.toString(),
                ride: JSON.stringify(ride),
                rideId: ride._id.toString(),
                distance: distance.toString(),
                time: time.toString(),
                isSchedule: isSchedule.toString(),
                title: 'New Ride Request',
                body: `You have a new ride request ${distance} (${time}).`,
            };
            // console.log(notificationData);
            const response = await sendRideNotification(
                registrationToken,
                notificationData,
                notificationData.title,
                notificationData.body
            );
            // console.log('--------------------------------');
            // console.log('response', response);
            // console.log('--------------------------------');

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
