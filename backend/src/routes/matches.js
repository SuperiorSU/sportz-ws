import { Router } from "express";
import { desc } from "drizzle-orm";
import { createMatchSchema, listMatchesQuerySchema } from "../validation/matches.js";
import { matches } from "../db/schema.js";
import { db } from "../db/db.js";
import { getMatchStatus } from "../utils/match-status.js";


export const matchRouter = Router();

matchRouter.get('/', async(req, res)=>{
    const parsedData = listMatchesQuerySchema.safeParse(req.query);
    if(!parsedData.success){
        return res.status(400).json({
            success:"FALSE",
            error: "Invalid payload",
            details: parsedData.error.issues
        });
    }
    const MAX_LIMIT = 100;
    const limit = Math.min(parsedData.data.limit??50, MAX_LIMIT);
    try{
        const data=await db.select().from(matches).orderBy((desc(matches.createdAt))).limit(limit);
        res.status(200).json({
            success: "TRUE",
            message: "Matches List",
            data: {data}
        });
    }
    catch(error){
        res.status(500).json({
            success: "FALSE",
            error: "Failed to retrieve the match data",
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

matchRouter.post('/', async(req, res)=>{
    const parsedData = createMatchSchema.safeParse(req.body);
    if(!parsedData.success){
        return res.status(400).json({
            success:"FALSE",
            error: "Invalid payload",
            details: parsedData.error.issues
        });
    }

    try{
        const [event] = await db.insert(matches).values({
            ...parsedData.data,
            startTime: new Date(parsedData.data.startTime),
            endTime: new Date(parsedData.data.endTime),
            homeScore: parsedData.data.homeScore,
            awayScore: parsedData.data.awayScore,
            status: getMatchStatus(parsedData.data.startTime, parsedData.data.endTime)
        }).returning();

        res.status(201).json({
            success:"TRUE",
            data: event
        })
        if(res.app.locals.broadcastMatchCreated){
            // pass the event created to the broadcastMatchCreated
            res.app.locals.broadcastMatchCreated(event);
        }
    }
    catch(error){
        res.status(500).json({
            success: "FALSE",
            error: "Failed to create the match",
            details: JSON.stringify(error),
        });
    }
});
