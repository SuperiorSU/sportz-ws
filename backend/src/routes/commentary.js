import { Router } from "express";
import { matchIdParamSchema } from "../validation/matches.js";
import { createCommentarySchema, listCommentaryQuerySchema } from "../validation/commentary.js";
import { db } from "../db/db.js";
import { commentary } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
export const commentaryRouter = Router({
    mergeParams: true
});

const MAX_LIMIT = 100;


commentaryRouter.get('/', async(req, res)=>{
    const paramResult = matchIdParamSchema.safeParse(req.params);
    if(!paramResult.success){
        return res.status(400).json({
            error: "Invalid match ID",
            details:paramResult.error.issues
        });
    }
    const queryResult= listCommentaryQuerySchema.safeParse(req.query);
    if(!queryResult.success){
        return res.status(400).json({
            error: "Invalid query parameters",
            details:queryResult.error.issues
        });
    }

    try{
        const {id: matchId} = paramResult.data;
        const {limit = 10} = queryResult.data;
        
        const safeLimit =Math.min(limit, MAX_LIMIT);

        const result = await db.select().from(commentary).where(eq(commentary.matchId, matchId)).orderBy(desc(commentary.createdAt)).limit(safeLimit);
        res.status(200).json({
            message:'Commentary list',
            data: result
        });
    }
    catch(err){
        console.log('Failed to fetch commentary', err);
        res.status(500).json({
            error: 'Failed to fetch commentary'
        })
    }
});

commentaryRouter.post('/', async(req, res)=>{
    const paramResult = matchIdParamSchema.safeParse(req.params);
    if(!paramResult.success){
        return res.status(400).json({
            error: 'Invalid Match ID',
            details: paramResult.error.issues
        });
    }

    const bodyResult = createCommentarySchema.safeParse(req.body);
    if(!bodyResult.success){
        return res.status(400).json({
            error: 'Invalid commentary payload',
            details: bodyResult.error.issues
        });
    }

    try{
        const [result] = await db.insert(commentary).values({
            matchId: paramResult.data.id,
            ...bodyResult.data
        }).returning();
        if(res.app.locals.broadcastCommentary){
            res.app.locals.broadcastCommentary(result.matchId, result);
        }

        res.status(201).json({
            message:'Comment Created',
            data: result
        });
    }
    catch(error){
        console.log('Failed to create commentary');
        res.status(500).json({
            error: 'Failed to create commentary'
        });
    }
});