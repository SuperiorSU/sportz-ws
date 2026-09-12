// we will need a helper function that will prevent repetitive json parsing/stringify calls and validate whether the web socket server is active or not
import {WebSocket, WebSocketServer} from 'ws';
import { wsArcjet } from '../arcjet.js';


const matchSubscribers = new Map(); // this allows to avoid duplicate match

const subscribe = (matchId, socket)=>{
    if(!matchSubscribers.has(matchId)){
        matchSubscribers.set(matchId, new Set());
    }

    matchSubscribers.get(matchId).add(socket)
}

// unsubscribe the match
const unsubscribe = (matchId, socket)=>{
    const subscribers = matchSubscribers.get(matchId)
    if(!subscribers) return;

    subscribers.delete(socket);

    if(subscribers.size ==0){
        matchSubscribers.delete(matchId);
    }
}
// clean up subscription of the user to specific match
const cleanupSubscription = (socket)=>{
    for(const matchId of socket.subscriptions){
        unsubscribe(matchId, socket);
    }
}


function sendJson(socket, payload){
    if(socket.readyState!== WebSocket.OPEN) return;
    
    socket.send(JSON.stringify(payload))
}

const broadcastToAll = (wss, payload)=>{
    for(const client of wss.clients){
        if(client.readyState!==WebSocket.OPEN) continue;
        
        client.send(JSON.stringify(payload));
    }
}

// takes on the specific match id and send the broadcast data specific to it.
const broadcastToMatch =(matchId, payload)=>{
    const subscribers = matchSubscribers.get(matchId);

    if(!subscribers || subscribers.size==0) return;

    const message = JSON.stringify(payload);
    for(const client of subscribers){
        if(client.readyState == WebSocket.OPEN){
            client.send(message);
        }
    }
}
// data formatting helper function--helps to manage different format of message
const handleMessage = (socket, data)=>{
    let message;
    try{
        message = JSON.parse(data.toString());

    }
    catch(err){
        console.log('Error in handling message');
        sendJson(socket, {type:'error', detail:'Invalid Message Format'})
    }

    if(message?.type == 'subscribe' && Number.isInteger(message.matchId)){
        subscribe(message.matchId, socket);
        socket.subscriptions.add(message.matchId);
        sendJson(socket, {type:'subscribed', matchId: message.matchId});
    }
    
    if(message?.type == 'unsubscribe' && Number.isInteger(message.matchId)){
        unsubscribe(message.matchId, socket);
        socket.subscriptions.delete(message.matchId);
        sendJson(socket, {type:'unsubscribed', matchId: message.matchId});
    }

}


export const attachWebSocketServer=(server)=>{
    // new websocket server which will receive the HTTP server instance from express so that the ws server can attach itself in the same underlying server. While the HTTP server will manage CRUD operation, ws server will use the ssme server to listen for upgrade request avoiding seperate port running this server
    const wss = new WebSocketServer({
        server,
        path:'/ws', // we need to provide a path to differentiate from the HTTP server path/route 
        maxPayload: 1024*1024, // 1 megabyte | protect against memory abuse    
    })

    // here we will apply the wsArcjet security layer 
    wss.on('connection', async(socket, req)=>{

        if(wsArcjet){
            try {
                const decision = await wsArcjet.protect(req);

                if(decision.isDenied()){
                    const code = decision.reason.isRateLimit()?1013: 1008;
                    const reason = decision.reason.isRateLimit()? 'Rate Limit Exceeded':'Access Denied';

                    socket.close(code, reason);
                    return;
                }
            } catch (error) {
                console.log('WS connection error', error);
                socket.close(1011, 'Server Security Error'); // general error
                return;
            }
        }

        // we set the socket as alive and send a pong message to the client
        socket.isAlive = true;
        socket.subscriptions = new Set();
        socket.on('pong', ()=>{socket.isAlive = true})
        sendJson(socket, {type: 'welcome'})

        socket.on('message', (data)=>{
            handleMessage(socket,data)
        })
        socket.on('close', ()=>{
            cleanupSubscription(socket);
        })
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
        broadcastToAll(wss, {type: 'match_created', data: match});
    }

    // broadcast match to only the subscriber
    const broadcastCommentary=(matchId, comment)=>{
        broadcastToMatch(matchId, {type: 'commentary', data: comment})
    }

    return {broadcastMatchCreated, broadcastCommentary}
}