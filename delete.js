const WebSocketServer = require('websocket').server;
const http = require('http');
let server = http.createServer(function(request,response) {
    console.log(' received ' );
    response.writeHead(404);
    response.end();
});
ws = new WebSocketServer({ port: 8080 });


ws.on('request', function(request) {
    let connection = request.accept('echo-protocol',request.origin)
    console.log('Connection accepted.');
    connection.on('message', function(msg) {
        console.log('Received Message');
    });
});
