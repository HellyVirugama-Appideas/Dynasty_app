const multilingual = require('../../utils/multilingual');

const Car = require('../../models/carModel');

exports.listCars = async (req, res, next) => {
    try {
        const filter = {};
        const sort = { _id: -1 };

        let cars = await Car.find(filter)
            .sort(sort)
            .populate('type')
            .select('-__v')
            .lean();

        cars = cars.map(car => {
            return { ...car, type: multilingual(car.type, req).name };
        });

        res.json({ code: '1', message: req.t('success'), cars });
    } catch (error) {
        next(error);
    }
};
