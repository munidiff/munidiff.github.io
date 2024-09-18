const path = require('path');

module.exports = {
    entry: './js/app.js', // Entry point of your application
    output: {
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/dist/',
        filename: 'bundle.js'
    },
    devServer: {
        static: ".",
        compress: true, // Enable gzip compression
        port: 9000
    }
};
