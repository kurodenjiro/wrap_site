const config = require("config");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const session = require("express-session");
const express = require("express");
const fs = require("fs");
const app = express();
const request = require("request-promise");
const NodeCache = require("node-cache");
const myCache = new NodeCache();
const proxy = config.get("proxy");
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use("/assets", express.static(__dirname + "/public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
//
const shell = require("shelljs");
// shell.config.silent = true;
const multer  = require('multer');
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
    cb(null, './public/images/tmp/');
},
    filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + functions.replaceAll(file.originalname," ","-"));
}
});
var upload = multer({ storage: storage });
function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function replaceAll(str, find, replace) {
    try {
        return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
    } catch(ex) {
        return "";
    }
}
//
app.use(cookieParser("_secret_"));
app.use(session({
    secret: "zorovhs",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24*60*60*1000 }
}));
var port = config.get("site.port");
app.use("/assets",express.static("./public"));
app.use("/static",express.static("./public"));
app.get("/1.gif", (req,res) => {
    res.redirect("/assets/1.gif");
});
const cache = config.get("site.cache");
const check = config.get("site.proxy");
//sitemap
app.get(/(recommended-apps|latest-updates|new-releases)\/feed/, (req,res) => {
    var slug = req.url;
    var value = myCache.get(`${slug}`);
    if(value == undefined) {
        request({
            url: `https://apkcombo.com${slug}`,
            proxy: `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`,
            headers: {
                "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36"
            }
        }).then(async(html) => {
            html = replaceAll(html,"https://apkcombo.com",config.get("site.domain"));
            myCache.set(`${slug}`, html, cache);
            res.type('application/xml');
            res.end(html);
        }).catch(() => {
            res.json({status:0});
        });
    } else {
        res.type('application/xml');
        res.end(value);
    }
});
app.get("/sitemap_index.xml", (req,res) => {
    var value = myCache.get("sitemap_index");
    if(value == undefined) {
        request({
            url: `https://sitemaps.apkcombo.com/sitemap_index.xml`,
            proxy: `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`,
            headers: {
                "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36"
            }
        }).then(async(html) => {
            html = replaceAll(html,"https://sitemaps.apkcombo.com/",config.get("site.domain")+"/sitemap/");
            myCache.set("sitemap_index", html, cache);
            res.type('application/xml');
            res.end(html);
        }).catch((err) => {
            console.error(err);
            res.json({status:0});
        });
    } else {
        res.type('application/xml');
        res.end(value);
    }
});
app.get("/sitemap/c-:index.xml.gz", (req,res) => {
    var index = req.params.index;
    var path = {
        compress: `./sitemap/compress/c-${index}.xml.gz`,
        xml: `./sitemap/compress/c-${index}.xml`
    }
    if(fs.existsSync(path.compress)) {
        res.download(path.compress);
    } else {
        //download file gz
        shell.exec(`wget -O "${path.compress}" "https://sitemaps.apkcombo.com/c-${index}.xml.gz"`);
        //decompress
        shell.exec(`gunzip "${path.compress}"`);
        shell.exec(`sed -i 's/apkcombo.com/${config.get("site.domain")}/g' ${path.xml}`);
        shell.exec(`gzip ${path.xml}`);
        res.download(path.compress);
    }
});
//
app.get("/*", (req,res) => {
    var path = req.originalUrl;
    var value = myCache.get(`${path}`);
    if(value == undefined) {
        if(check) {
            var options = {
                url: `https://apkcombo.com${path}`,
                proxy: `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`,
                headers: {
                    "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36"
                }
            }
        } else {
            var options = {
                url: `https://apkcombo.com${path}`,
                headers: {
                    "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36"
                }
            }
        }
        request(options).then(async(html) => {
            html = html.replace(/https\:\/\/apkcombo.com/gm,config.get("site.domain")); //replace domain
            html = html.replace(/APKCombo/gm,config.get("site.name")); //replace name
            html = html.replace(/<script async src="(.*?)ga\(\"send\"\,\"pageview\"\)\;<\/script>/gms,""); //remove google analytics
            html = html.replace(/<\/style>\n<script>(.*?)<\/script>/gms,`</style>
            <!-- Global site tag (gtag.js) - Google Analytics -->
            <script async src="https://www.googletagmanager.com/gtag/js?id=UA-155237480-1"></script>
            <script>
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());

                gtag('config', 'UA-155237480-1');
            </script>
            <script>
            (function() {
                var lazyLoad = false;
            
                function onLazyLoad() {
                    if (lazyLoad === false) {
                        lazyLoad = true;
                        document.removeEventListener('scroll', onLazyLoad);
                        document.removeEventListener('mousemove', onLazyLoad);
                        document.removeEventListener('mousedown', onLazyLoad);
                        document.removeEventListener('touchstart', onLazyLoad);
                        lazyScript('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js');
                        ! function(e, a, t, n, g, c, o) {
                            e.GoogleAnalyticsObject = g, e.ga = e.ga || function() {
                                (e.ga.q = e.ga.q || []).push(arguments)
                            }, e.ga.l = 1 * new Date, c = a.createElement(t), o = a.getElementsByTagName(t)[0], c.async = 1, c.src = "https://www.google-analytics.com/analytics.js", o.parentNode.insertBefore(c, o)
                        }(window, document, "script", 0, "ga"), ga("create", "UA-131363738-1", "auto"), ga("set", "allowAdFeatures", false), ga("send", "pageview");
                        lazyScript('//s7.addthis.com/js/300/addthis_widget.js#pubid=ra-5c7650515eb98383');
                        lazyImage('slzl')();
                        lazyCss('/static/css/screenshot.min.css');
                        lazyScript('/static/js/screenshot.js?v=3');
                    }
                }
                document.addEventListener("scroll", onLazyLoad), document.addEventListener("mousemove", onLazyLoad), document.addEventListener("mousedown", onLazyLoad), document.addEventListener("touchstart", onLazyLoad), document.addEventListener("load", function() {
                    document.body.clientHeight != document.documentElement.clientHeight && 0 == document.documentElement.scrollTop && 0 == document.body.scrollTop || onLazyLoad()
                });
            })();
            </script>`); //add google analytics
            html = html.replace(/<div class="ad-box(.*?)">(.*?)<\/script>/gms,""); //remove ads
            html = html.replace(/<script\b[^>]*ca-pub-7625565296094488[^>]*>(.*?)<\/script>/, "");
            html = html.replace(/<ins\b[^>]*ca-pub-7625565296094488[^>]*>(.*?)<\/ins>/, "");
            html = html.replace(/<b>APK<\/b>Combo<\/span>/,`<b>K</b>dedevelopers.org</span>`); //replace logo
            html = html.replace(/https\:\/\/www.facebook.com\/apkcombo/gm,config.get("site.domain"));
            html = html.replace(/https\:\/\/twitter.com\/apkcombo/gm,config.get("site.domain"));
            html = html.replace(/https\:\/\/www.messenger.com\/t\/apkcombo/gm,config.get("site.domain"));
            html = html.replace(/mailto\:support\@apkcombo.com/gm,config.get("site.domain"));
            myCache.set(`${path}`, html, cache);
            res.end(html);
        }).catch((err) => {
            console.error(err);
            res.redirect("/");
        });
    } else {
        res.end(value);
    }
});

app.post("/*", upload.single("thumb"), (req,res) => {
    var path = req.originalUrl;
    if(path.includes("/dl")) {
        var package_name = req.body.package_name;
        var token = req.body.token;
        var type = req.body.type;
        var version = req.body.version;
        if(check) {
            var options = {
                'method': 'POST',
                'url': `https://apkcombo.com${path}`,
                'headers': {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36',
                },
                form: {
                    'package_name': package_name,
                    'token': token,
                    'type': type,
                    'version': version
                },
                proxy: `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`,
            };
        } else {
            var options = {
                'method': 'POST',
                'url': `https://apkcombo.com${path}`,
                'headers': {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36',
                },
                form: {
                    'package_name': package_name,
                    'token': token,
                    'type': type,
                    'version': version
                }
            };
        }
        request(options).then(async(html) => {
            html = html.replace(/APKCombo/gm,config.get("site.name")); //replace name
            myCache.set(`${path}`, html, cache);
            res.end(html);
        }).catch((err) => {
            res.end("Cannot get download");
        });
    } else {
        res.json({status:0});
    }
});

app.listen(port,() => {
    console.log(`Start server ${port}`);
})