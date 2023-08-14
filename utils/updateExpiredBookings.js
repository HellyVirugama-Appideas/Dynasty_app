const BookingRequest = require('../models/bookingReqModel');

module.exports = async () => {
    try {
        const currentDate = new Date();

        // Find all requested bookings with booking from date <= current date
        const expiredBookingRequests = await BookingRequest.find({
            status: 'requested',
            bookedFrom: { $lte: currentDate },
        });

        if (expiredBookingRequests.length > 0) {
            // Update status to 'expired' for all expired booking requests
            const updatePromises = expiredBookingRequests.map(
                async bookingRequest => {
                    bookingRequest.status = 'expired';
                    return bookingRequest.save();
                }
            );

            await Promise.all(updatePromises);
            console.log(`Updated ${updatePromises.length} booking requests.`);
        } else {
            console.log('No expired booking requests found.');
        }
    } catch (error) {
        console.log('Error while updating expired booking requests:', error);
    }
};
