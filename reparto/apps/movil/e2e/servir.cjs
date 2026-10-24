// Servidor estático con respaldo a index.html (rutas de expo-router).
const http = require("http"), fs = require("fs"), path = require("path");
const raiz = process.argv[2], puerto = Number(process.argv[3]);
const tipos = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".ttf": "font/ttf", ".json": "application/json", ".ico": "image/x-icon" };
http.createServer((req, res) => {
  let f = path.join(raiz, decodeURIComponent(req.url.split("?")[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = fs.existsSync(f + ".html") ? f + ".html" : path.join(raiz, "index.html");
  res.writeHead(200, { "Content-Type": tipos[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(puerto);
