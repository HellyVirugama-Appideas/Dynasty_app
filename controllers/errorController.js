module.exports = (error, req, res, next) => {
    // console.log(error);

    if (error.code == 11000) {
        return res.status(403).json({
            code: '0',
            message: `${
                Object.keys(error.keyPattern)[0]
            } is already registered.`,
        });
    }

    if (error.name === 'ValidationError') {
        let errors = {};
        Object.keys(error.errors).forEach(key => {
            if (error.errors[key].name == 'CastError')
                errors[key] = `Invalid value for ${error.errors[key].path}`;
            else errors[key] = req.t(error.errors[key].message);
        });
        return res.status(400).json({
            code: '0',
            errors,
        });
    }

    if (error.name == 'BadRequestError' && error.message.errors) {
        let errors = {};
        Object.keys(error.message.errors).forEach(key => {
            let myKey = key;
            if (myKey.includes('.')) myKey = myKey.split('.').pop();
            errors[myKey] = error.message.errors[key].message;
        });
        return res.status(400).json({ code: '0', errors });
    }

    if (error.name == 'MulterError') error.status = 413;

    if (
        error.message.toString().includes(': ') &&
        error.name == 'BadRequestError'
    ) {
        error.message = error.message.toString().split(': ').pop();
    }
    res.status(error.status || 500).json({
        code: '0',
        message: req.t(error.message),
        errorCode: res.errorCode,
    });
};
