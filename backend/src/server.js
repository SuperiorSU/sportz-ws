import express from 'express';
import { matchRouter } from './routes/matches.js';
import 'dotenv/config';
import http from 'http';
import { attachWebSocketServer } from './ws/server.js';
import { securityMiddleware } from './arcjet.js';

const PORT = Number(process.env.PORT) || 8000;
const HOST= process.env.HOST || '0.0.0.0';

const app = express();
const server = http.createServer(app);

app.use(express.json());

app.get('/', (req, res)=>{
    res.send("Welcome to local server.");
})
// after creating wss/server.js with logic in it, we need to hook it up with HTTP server. Since Express is built on Node, we need to explicitly create the HTTP server so that ws server can use it. After creating a server instance, we destructure the created broadcated match from the attachWebSeocketServer and pass it to the app.locals.broadcastMatchCreated. After this, we need to assign the trigger that can initiate whenever the match is created i.e at the post router

// using arcjet security middleware for HTTP requests, move to ws server as well to apply wsArcject
app.use(securityMiddleware());
app.use('/matches', matchRouter)

const {broadcastMatchCreated} = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

server.listen(PORT, HOST, ()=>{
    const baseUrl= HOST==='0.0.0.0'? `http://localhost:${PORT}`:`https://${HOST}:${PORT}`
    console.log(`Server is running on ${baseUrl}`);
    console.log(`WebSocket server is running on ${baseUrl.replace('http', 'ws')}/ws`);
});