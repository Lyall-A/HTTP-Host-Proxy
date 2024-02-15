const http = require("http");
const https = require("https");
const fs = require("fs");
const config = require("./config.json");

loadProxy();
function loadProxy() {
    console.log("Loading proxy.json");
    proxy = JSON.parse(fs.readFileSync("./proxy.json", "utf-8"));
    Object.values(proxy).forEach(i => i.aliases?.forEach(x => proxy[x] = i)); // Aliases
    proxyKeys = Object.keys(proxy);
}
fs.watchFile("./proxy.json", () => loadProxy());

const server = (config.secure ? https : http).createServer(config.secure ? { key: fs.readFileSync(config.key, "utf-8"), cert: fs.readFileSync(config.cert, "utf-8") } : undefined);

server.on("request", (req, res) => {
    const proxyMatch = findProxyMatch(req.headers.host);
    if (!proxyMatch) return res.writeHead(400).end();
    if (config.logging) console.log(`\x1b[46m${req.headers.host}\x1b[0m > \x1b[42m${proxyMatch.host}${proxyMatch.port ? `:${proxyMatch.port}` : ""}\x1b[0m`);

    req.headers.host = proxyMatch.host;

    const proxyReq = (proxyMatch.secure ? https : http).request({
        host: proxyMatch.host,
        port: proxyMatch.port,
        path: req.url,
        method: req.method,
        headers: req.headers
    }, proxyRes => {
        res.statusCode = proxyRes.statusCode;
        res.statusMessage = proxyRes.statusMessage;
        Object.keys(proxyRes.headers).forEach(i => res.setHeader(i, proxyRes.headers[i]));

        proxyRes.on("data", i => res.write(i));
        proxyRes.on("end", () => res.end());
        proxyRes.on("error", () => { });
    });

    req.on("data", i => proxyReq.write(i));
    req.on("end", () => proxyReq.end());
    res.on("close", () => proxyReq.destroy());
    req.on("error", () => { });
    proxyReq.on("error", () => { });
});

server.listen(config.port, () => console.log(`Listening at :${config.port}`));

function findProxyMatch(host) {
    return proxy[proxyKeys.filter(i => 
        i == host ||
        i.startsWith(".") ? host.endsWith(i) : false ||
        i.endsWith(".") ? host.startsWith(i) : false
    )[0]];
}