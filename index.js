console.log("Node Version: " + process.version);

let express = require('express');
let app = express();
let http = require('http');
let server = http.Server(app);
let bodyParser = require("body-parser");
let path = require("path");
let Pageres = require("pageres");
let findRemoveSync = require("find-remove");
let config = require("./config");
let port = process.env.PORT || config.port || 3025;

const DEFAULT_OPTIONS =
    {
        delay: 1,
        crop: false,
        transparent: false,
        format: "png",
        selector: "html",
        hide: [],
        sizes: "w3counter",
        scale: 1
    };

app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        res.header("Access-Control-Allow-Headers", "X-Requested-With, Accept, Content-Type, Origin");
        res.header("Access-Control-Request-Headers", "X-Requested-With, Accept, Content-Type, Origin");
        return res.sendStatus(200);
    } else {
        return next();
    }
});

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json())

app.use(function (req, res, next) {
    req.realAddress = req.header("x-real-ip") || req.realAddress;
    next();
});

app.use(express.static(__dirname, {dotfiles: 'allow'}));

app.get("/", function (req, res) {
    res.send("Hi!").end()
});

app.all("/render", function (req, res) {
    let url = req.query.url || req.body.url;
    let options = Object.assign({}, DEFAULT_OPTIONS, JSON.parse(req.query.options || req.body.options || "{}"));
    let redirect = req.query.redirect || req.body.redirect || false;
    if (!url) {
        res.status(400).json({error: "Missing URL"});
        return;
    }
    console.log(typeof url);
    /*
    if (!url.startsWith("http")) {
        res.status(400).json({error: "Invalid URL"});
        return;
    }
    if (url.toLowerCase().contains("localhost")) {
        res.status(400).json({error: "Invalid URL"});
        return;
    }
    */
    console.log("Render " + url);

    let start = Date.now();

    if (options.sizes) {
        if (!Array.isArray(options.sizes)) {
            options.sizes = [options.sizes];
        }
    }

    new Pageres({
        delay: options.delay,
        crop: options.crop,
        selector: options.selector,
        hide: options.hide,
        scale: options.scale,
        userAgent: "Webrender.co Bot",

        filename: "<%= date %>_<%= time %>_<%= url %>-<%= size %><%= crop %>"
    })
        .src(url, options.sizes || [options.width + "x" + options.height])
        .dest(path.join(__dirname, "renders"))
        .run()
        .then((r) => {
            console.log("rendered " + url + " in " + (Date.now() - start) + "ms");
            let fileUrl = "https://img.webrender.co/" + r[0].filename;
            if (redirect) {
                res.redirect(fileUrl);
            } else {
                let urls = [];
                for (let i = 0; i < r.length; i++) {
                    urls.push("https://img.webrender.co/" + r[i].filename)
                }
                res.json({
                    url: url,
                    image: fileUrl,
                    images: urls,
                    options: options
                })
            }
        })
        .catch((err) => {
            console.warn(err);
            res.status(500).json({
                error: err
            })
        })
});

app.get("/renders/:path?", function (req, res) {
    res.redirect("https://img.webrender.co/" + req.params.path);
});

// Cleanup
setInterval(cleanup, 3600000);

function cleanup() {
    console.log("Cleaning up renders...");
    console.debug(path.join(__dirname, "renders"))
    let removed = findRemoveSync(path.join(__dirname, "renders"), {age: {seconds: 3600}, files: "*.png*"});
    console.log(removed)
    if (removed.length > 0) {
        console.log('removed:', removed);
    }
}

cleanup();// Initial cleanup

function exitHandler(err) {
    if (err) {
        console.log("\n\n\n\n\n\n\n\n");
        console.log(err);
        console.log("\n\n\n");
    }
    process.exit();
}


server.listen(port, function () {
    console.log('listening on *:' + port);
});

process.on("exit", exitHandler);
process.on("SIGINT", exitHandler);
process.on("uncaughtException", exitHandler);
