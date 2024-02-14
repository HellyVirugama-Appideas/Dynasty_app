const Ride = require('../models/rideModel');

module.exports = async () => {
    try {
        const currentTime = new Date();

        // Find all "Upcoming" bookings with booking from date <= current date
        const ridesToUpdate = await Ride.find({
            status: 'Upcoming',
            scheduleTime: { $lte: currentTime },
        });

        if (ridesToUpdate.length > 0) {
            // Update status to 'Expired' for all expired rides
            const updatePromises = ridesToUpdate.map(async rides => {
                rides.status = 'Expired';
                return rides.save();
            });

            await Promise.all(updatePromises);
            console.log(`Updated ${updatePromises.length} rides.`);
        } else {
            console.log('No expired rides found.');
        }
    } catch (error) {
        console.log('Error while updating expired rides:', error);
    }
};
