// Centralised Security logic -- for HTTP and WebSocket
import 'dotenv/config';
import arcject, {detectBot, shield, slidingWindow} from '@arcjet/node'
const arcjetKey = process.env.ARCJET_KEY
const arcjetMode = process.env.ARCJET_MODE === 'DRY_RUN'?'DRY_RUN':'LIVE';


if(!arcjetKey){
    throw new Error('Invalid arcjetKey or missing');
}

export const httpArcjet = arcjet ?
arcject({
    key: arcjectKey,
    rules: [
        shield({node: arcjetMode}), // analyzes the structure and prevents attacks such as SQL Injections, DDoS, Cross Scripting
        detectBot({mode: arcjetMode, allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:PREVIEW']}), // disallow bots from data scrapping except for search engine and preview category bots, there are many options as well
        slidingWindow({mode: arcjectMode, interval: '10s', max:50}) // rate limiting rule/algorithm that tracks the requests over a moving time frame: Here we are allowing 50 requests max in 10s per IP address
    ]
}): null

export const wsArcjet = arcjetKey ?
arcject({
    rules:[
        shield({node: arcjetMode}), // analyzes the structure and prevents attacks such as SQL Injections, DDoS, Cross Scripting
        detectBot({mode: arcjetMode, allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:PREVIEW']}), // disallow bots from data scrapping except for search engine and preview category bots, there are many options as well
        slidingWindow({mode: arcjectMode, interval: '2s', max:5}) // rate limiting rule/algorithm that tracks the requests over a moving time frame: Here we are allowing 5 requests max in 2s per IP address
    ]
}): null;

// middleware for HTTP routes, the function returns an async function
export const securityMiddleware =()=>{
    return async(req, res, next)=>{
        if(!httpArcjet) return next(); // if the protection helper instance is not there, bounce off the req
        
        try{
            const decision = await httpArcjet.protect(req); // here the decision will consist a value based on the rules defined in the httpArcject[customizable]
            if(decision.isDenied()){
                if(decision.reason.isRateLimit){
                    return res.status(429).json({
                        error: 'Too Many Requests'
                    });
                }
                return res.status(403).json({
                    error:'Forbidden'
                });
            }
        }
        catch(err){
            console.log('Arcjet middleware error');
            return res.status(503).json({
                error:'Service Unavailable'
            });
        }
        next(); //all well so move to next function
    }
    
}