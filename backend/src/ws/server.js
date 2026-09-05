// we will need a helper function that will prevent repetitive json parsing/stringify calls and validate whether the web socket server is active or not

import {WebSocket, WebSocketServer} from 'ws';

function sendJson(socket, payload){
    if(socket.readyState!== WebSocket.OPEN) return;

    socket.send(JSON.stringify(payload))
}

const broadcast = (wss, payload)=>{
    for(const client of wss.clients){
        if(client.readyState!==WebSocket.OPEN) continue;

        client.send(JSON.stringify(payload));
    }
}

export const attachWebSocketServer=(server)=>{
    // new websocket server which will receive the HTTP server instance from express so that the ws server can attach itself in the same underlying server. While the HTTP server will manage CRUD operation, ws server will use the ssme server to listen for upgrade request avoiding seperate port running this server
    const wss = new WebSocketServer({
        server,
        path:'/ws', // we need to provide a path to differentiate from the HTTP server path/route 
        maxPayload: 1024*1024, // 1 megabyte | protect against memory abuse    
    })
    wss.on('connection', (socket)=>{
        // we set the socket as alive and send a pong message to the client
        socket.isAlive = true;
        socket.on('pong', ()=>{socket.isAlive = true})
        sendJson(socket, {type: 'welcome'})
        socket.on('error', console.error);
    })
    // we set an interval of 30s to run a check on each of the client and see whether they are alive, if not then we terminate these connections
    const interval = setInterval(()=>{
        wss.clients.forEach((ws)=>{
            if(ws.isAlive==false) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        })
    }, 30000);
    wss.on('close', ()=>clearInterval(interval));

    const broadcastMatchCreated = (match)=>{
        broadcast(wss, {type: 'match_created', data: match});
    }

    return {broadcastMatchCreated}
}