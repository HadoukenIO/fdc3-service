const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

var gv = require('genversion');

function createWebpackConfigForProviderUI() {
    return Object.assign({
        entry: {
            'ui': './src/provider/Selector.tsx'
        },
        output: {
            path: path.resolve(__dirname, './build/ui/pack'),
            filename: '[name]-bundle.js'
        },
        resolve: {
            extensions: ['.ts', '.tsx', '.js']
        },
        devtool:'source-map',
        module: {
            rules: [
                {
                    test: /\.css$/,
                    use: [
                        {
                            loader: MiniCssExtractPlugin.loader
                        },
                        "css-loader"
                    ]
                },
                {
                    test: /\.(png|jpg|gif|otf|svg)$/,
                    use: [
                        {
                            loader: 'url-loader',
                            options: {
                                limit: 8192
                            }
                        }
                    ]
                },
                {
                    test: /\.tsx?$/,
                    loader: 'ts-loader'
                }
            ]
        },
        plugins: [
            new MiniCssExtractPlugin({ filename: 'bundle.css' })
        ]
    });
}


/**
 * build webpack config for the provider side
 * @return {Object} A webpack module
 */
function createWebpackConfigForProvider() {
    return {  
        entry: {
            'provider': './staging/provider/index.js'
        },
        output: {
            path: path.resolve(__dirname, './build')
        },
        plugins: [
            new CopyWebpackPlugin([
                { from: './src/ui', to: 'ui/' },
                { from: './src/provider.html' }
            ]),
            new CopyWebpackPlugin([
                { from: './src/app.template.json', to: 'app.json', transform: (content) => {
                    const config = JSON.parse(content);
                    const newConfig = prepConfig(config);
                    return JSON.stringify(newConfig, null, 4);
                }}
            ])
        ]
    };
}

function prepConfig(config) {
    const newConf = Object.assign({}, config);
    if (typeof process.env.GIT_SHORT_SHA != 'undefined' && process.env.GIT_SHORT_SHA != "" ) {
        newConf.startup_app.url = 'https://cdn.openfin.co/services/openfin/fdc3/' + process.env.GIT_SHORT_SHA + '/provider.html';
        newConf.startup_app.autoShow = false;
    } else if (typeof process.env.CDN_ROOT_URL != 'undefined' && process.env.CDN_ROOT_URL != "" ) {
        newConf.startup_app.url = process.env.CDN_ROOT_URL + '/provider.html';
    } else {
        newConf.startup_app.url = 'http://localhost:3012/provider.html';
    }
    return newConf;
}

/**
 * Modules to be exported
 */
module.exports = [
    createWebpackConfigForProvider(),
    createWebpackConfigForProviderUI(),
];
